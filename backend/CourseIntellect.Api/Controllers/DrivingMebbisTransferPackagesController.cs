using System.Data;
using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CourseIntellect.Api.Authorization;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/driving-school/mebbis/transfer-packages")]
public sealed class DrivingMebbisTransferPackagesController(
    CourseIntellectDbContext db,
    IDrivingPermissionService permissions,
    IFileStorageService storage,
    IAuditLogService audit) : ControllerBase
{
    [HttpGet]
    [RequireDrivingPermission(DrivingPermissions.MebbisView)]
    public async Task<IActionResult> List([FromQuery] Guid? groupId, [FromQuery] string? type, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (!string.IsNullOrWhiteSpace(type) && (!Enum.TryParse<DrivingMebbisTransferPackageType>(type, true, out var parsed) || !Enum.IsDefined(parsed)))
            return BadRequest(new { message = "Paket türü geçersiz." });
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.DrivingMebbisTransferPackages.AsNoTracking().AsQueryable();
        if (groupId.HasValue) query = query.Where(x => x.StudentGroupId == groupId);
        if (!string.IsNullOrWhiteSpace(type)) { var parsedFilter = Enum.Parse<DrivingMebbisTransferPackageType>(type, true); query = query.Where(x => x.PackageType == parsedFilter); }
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.CreatedAtUtc).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new { x.Id, packageType = x.PackageType.ToString(), x.StudentGroupId, x.TermYear, x.TermNumber, x.MebbisTermCode, x.FileVersion, x.RowCount, x.StudentCount, x.FileName, x.FileSize, x.Sha256, status = x.Status.ToString(), x.ErrorResult, x.StatusVersion, x.CreatedByName, x.CreatedAtUtc, x.UpdatedAtUtc, x.TransferredAtUtc }).ToListAsync(ct);
        var groups = await db.DrivingStudentGroups.AsNoTracking().OrderByDescending(x => x.TermYear).ThenByDescending(x => x.TermNumber)
            .Select(x => new { x.Id, x.Name, x.TermYear, x.TermNumber, x.MebbisTermCode, x.IsActive }).ToListAsync(ct);
        return Ok(new { items, total, page, pageSize, groups, types = Enum.GetNames<DrivingMebbisTransferPackageType>() });
    }

    [HttpPost]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    public async Task<IActionResult> Create([FromBody] CreateTransferPackageRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (!await permissions.HasAsync(User, DrivingPermissions.ReportExport, ct)) return Forbid();
        if (!Enum.TryParse<DrivingMebbisTransferPackageType>(request.PackageType, true, out var type) || !Enum.IsDefined(type))
            return BadRequest(new { message = "Paket türü geçersiz." });
        var group = await db.DrivingStudentGroups.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.StudentGroupId, ct);
        if (group is null) return BadRequest(new { message = "Dönem bulunamadı." });

        var data = await BuildAsync(type, group.Id, ct);
        if (data.Rows.Count == 0) return Conflict(new { message = "Seçilen dönem ve paket türü için aktarılacak kayıt bulunamadı." });
        if (data.Rows.Count > 100_000) return Conflict(new { message = "Paket 100.000 satır sınırını aşıyor; dönemi bölerek aktarın." });
        var bytes = DrivingTransferCsv.Build(data.Headers, data.Rows);
        var hash = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var version = (await db.DrivingMebbisTransferPackages.Where(x => x.PackageType == type && x.StudentGroupId == group.Id)
            .MaxAsync(x => (int?)x.FileVersion, ct) ?? 0) + 1;
        var stem = $"{TypeSlug(type)}-{group.TermYear ?? DateTime.UtcNow.Year}-{group.TermNumber ?? 0}-v{version}";
        await using var stream = new MemoryStream(bytes, writable: false);
        var saved = await storage.SaveAsync(stream, $"{stem}.csv", "text/csv; charset=utf-8", $"driving-transfers/{db.CurrentTenantId:N}", string.Empty, ct);
        var entity = new DrivingMebbisTransferPackage
        {
            PackageType = type, StudentGroupId = group.Id, TermYear = group.TermYear, TermNumber = group.TermNumber,
            MebbisTermCode = group.MebbisTermCode, FileVersion = version, RowCount = data.Rows.Count,
            StudentCount = data.StudentIds.Distinct().Count(), FileName = $"{stem}.csv", FileUrl = saved.FileUrl,
            ContentType = saved.ContentType, FileSize = saved.Size, Sha256 = hash, CreatedByUserId = CurrentUserId(),
            CreatedByName = CurrentUserName(),
        };
        db.DrivingMebbisTransferPackages.Add(entity);
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        await audit.LogChangeAsync("MEBBİS aktarım paketi oluşturuldu", "DrivingSchool", nameof(DrivingMebbisTransferPackage), entity.Id.ToString(),
            $"{type} v{version}: {entity.RowCount} satır, {entity.StudentCount} kursiyer.", null,
            new { entity.PackageType, entity.StudentGroupId, entity.FileVersion, entity.RowCount, entity.StudentCount, entity.Sha256 }, ct);
        return Ok(new { entity.Id, packageType = type.ToString(), entity.FileVersion, entity.RowCount, entity.StudentCount, entity.FileName, entity.Sha256, status = entity.Status.ToString(), entity.StatusVersion, entity.CreatedAtUtc });
    }

    [HttpGet("{id:guid}/download")]
    [RequireDrivingPermission(DrivingPermissions.MebbisView)]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (!await permissions.HasAsync(User, DrivingPermissions.ReportView, ct)) return Forbid();
        var entity = await db.DrivingMebbisTransferPackages.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound(new { message = "Aktarım paketi bulunamadı." });
        var bytes = await storage.ReadBytesAsync(entity.FileUrl, ct);
        if (bytes is null) return NotFound(new { message = "Arşiv dosyası bulunamadı." });
        var actual = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        if (!CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(actual), Encoding.ASCII.GetBytes(entity.Sha256)))
            return Problem(statusCode: 409, title: "Dosya bütünlüğü doğrulanamadı", detail: "Arşiv dosyası değiştirilmiş veya bozulmuş olabilir. Paketi yeniden oluşturun.");
        return File(bytes, entity.ContentType, entity.FileName);
    }

    [HttpPut("{id:guid}/status")]
    [RequireDrivingPermission(DrivingPermissions.MebbisManage)]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateTransferPackageStatusRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (!Enum.TryParse<DrivingMebbisTransferStatus>(request.Status, true, out var status) || !Enum.IsDefined(status)) return BadRequest(new { message = "Aktarım durumu geçersiz." });
        var entity = await db.DrivingMebbisTransferPackages.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (entity is null) return NotFound(new { message = "Aktarım paketi bulunamadı." });
        if (entity.StatusVersion != request.ExpectedVersion) return Conflict(new { message = "Paket başka bir kullanıcı tarafından güncellendi. Listeyi yenileyin." });
        var transitionAllowed = entity.Status switch
        {
            DrivingMebbisTransferStatus.Generated => status is DrivingMebbisTransferStatus.Transferred or DrivingMebbisTransferStatus.Failed or DrivingMebbisTransferStatus.Cancelled,
            DrivingMebbisTransferStatus.Failed => status is DrivingMebbisTransferStatus.Generated or DrivingMebbisTransferStatus.Cancelled,
            _ => false,
        };
        if (!transitionAllowed) return Conflict(new { message = $"{entity.Status} durumundan {status} durumuna geçilemez. Aktarılmış/iptal edilmiş paket arşiv kaydıdır ve değiştirilemez." });
        var error = request.ErrorResult?.Trim() ?? string.Empty;
        if (status == DrivingMebbisTransferStatus.Failed && error.Length is < 10 or > 2000) return BadRequest(new { message = "Başarısız aktarım için 10-2000 karakter hata sonucu zorunludur." });
        if (status != DrivingMebbisTransferStatus.Failed && error.Length > 0) return BadRequest(new { message = "Hata sonucu yalnız başarısız durumda girilebilir." });
        var before = new { entity.Status, entity.ErrorResult, entity.StatusVersion };
        entity.Status = status; entity.ErrorResult = error; entity.StatusVersion++; entity.UpdatedAtUtc = DateTime.UtcNow; entity.UpdatedByUserId = CurrentUserId();
        entity.TransferredAtUtc = status == DrivingMebbisTransferStatus.Transferred ? DateTime.UtcNow : entity.TransferredAtUtc;
        await db.SaveChangesAsync(ct);
        await audit.LogChangeAsync("MEBBİS aktarım durumu güncellendi", "DrivingSchool", nameof(DrivingMebbisTransferPackage), entity.Id.ToString(), $"{entity.FileName}: {status}.", before, new { entity.Status, entity.ErrorResult, entity.StatusVersion }, ct);
        return Ok(new { status = entity.Status.ToString(), entity.ErrorResult, entity.StatusVersion, entity.UpdatedAtUtc, entity.TransferredAtUtc });
    }

    private async Task<PackageData> BuildAsync(DrivingMebbisTransferPackageType type, Guid groupId, CancellationToken ct)
    {
        var baseStudents = await db.StudentDrivingProfiles.AsNoTracking().Where(x => x.StudentGroupId == groupId)
            .Join(db.Students.AsNoTracking(), p => p.StudentId, s => s.Id, (p, s) => new { p, s.FullName, s.TcNo, s.BirthDate, s.UserId })
            .OrderBy(x => x.p.StudentNumber).ToListAsync(ct);
        var profileIds = baseStudents.Select(x => x.p.Id).ToList();
        var userIds = baseStudents.Select(x => x.UserId).ToList();
        if (type is DrivingMebbisTransferPackageType.CandidateRegistration or DrivingMebbisTransferPackageType.TermStudentList)
        {
            var headers = type == DrivingMebbisTransferPackageType.CandidateRegistration
                ? new[] { "Kursiyer No", "TC/Yabancı Kimlik", "Ad Soyad", "Doğum Tarihi", "Anne Adı", "Baba Adı", "Doğum Yeri", "Öğrenim", "Telefon", "Ehliyet Sınıfı", "MEBBİS Giriş Tarihi" }
                : new[] { "Kursiyer No", "TC/Yabancı Kimlik", "Ad Soyad", "Ehliyet Sınıfı", "Durum", "Kayıt Tarihi", "MEBBİS Giriş Tarihi" };
            var rows = baseStudents.Select(x => type == DrivingMebbisTransferPackageType.CandidateRegistration
                ? new[] { $"{x.p.StudentNumber}", Identity(x.p, x.TcNo), x.FullName, x.BirthDate, x.p.MotherName, x.p.FatherName, x.p.BirthPlace, x.p.EducationLevel, x.p.Phone, x.p.LicenseClass, Date(x.p.MebbisEnteredAtUtc) }
                : new[] { $"{x.p.StudentNumber}", Identity(x.p, x.TcNo), x.FullName, x.p.LicenseClass, x.p.Status.ToString(), Date(x.p.RegisteredAtUtc), Date(x.p.MebbisEnteredAtUtc) }).ToList();
            return new(headers, rows, profileIds);
        }
        if (type == DrivingMebbisTransferPackageType.TheorySchedule)
        {
            var classIds = await db.DrivingTheoryEnrollments.AsNoTracking().Where(x => profileIds.Contains(x.StudentDrivingProfileId)).Select(x => x.TheoryClassId).Distinct().ToListAsync(ct);
            var source = await db.DrivingTheorySessions.AsNoTracking().Where(x => classIds.Contains(x.TheoryClassId))
                .Join(db.DrivingTheoryClasses.AsNoTracking(), x => x.TheoryClassId, x => x.Id, (s, c) => new { s, c.Name })
                .Join(db.Staff.AsNoTracking(), x => x.s.InstructorStaffId, x => x.Id, (x, staff) => new { x.Name, x.s, staff.FullName }).ToListAsync(ct);
            var rows = source.Select(x => new[] { x.Name, x.s.Subject, x.s.Topic, Date(x.s.StartsAtUtc), Date(x.s.EndsAtUtc), x.s.Room, x.FullName, x.s.Status.ToString() }).ToList();
            return new(["Sınıf", "Ders", "Konu", "Başlangıç", "Bitiş", "Derslik", "Öğretmen", "Durum"], rows, profileIds);
        }
        if (type == DrivingMebbisTransferPackageType.DrivingSchedule)
        {
            var source = await db.DrivingAppointments.AsNoTracking().Where(x => profileIds.Contains(x.StudentDrivingProfileId))
                .Join(db.StudentDrivingProfiles.AsNoTracking(), a => a.StudentDrivingProfileId, p => p.Id, (a, p) => new { a, p.StudentId })
                .Join(db.Students.AsNoTracking(), x => x.StudentId, s => s.Id, (x, s) => new { x.a, s.FullName })
                .Join(db.DrivingInstructorProfiles.AsNoTracking(), x => x.a.InstructorProfileId, i => i.Id, (x, i) => new { x.a, x.FullName, i.StaffId })
                .Join(db.Staff.AsNoTracking(), x => x.StaffId, s => s.Id, (x, staff) => new { x.a, student = x.FullName, instructor = staff.FullName })
                .Join(db.DrivingVehicles.AsNoTracking(), x => x.a.VehicleId, v => v.Id, (x, v) => new { x.student, x.instructor, v.PlateNumber, x.a }).ToListAsync(ct);
            var rows = source.Select(x => new[] { x.student, x.instructor, x.PlateNumber, Date(x.a.StartsAtUtc), Date(x.a.EndsAtUtc), x.a.MeetingPoint, x.a.Status.ToString() }).ToList();
            return new(["Kursiyer", "Usta Öğretici", "Plaka", "Başlangıç", "Bitiş", "Buluşma Yeri", "Durum"], rows, profileIds);
        }
        if (type is DrivingMebbisTransferPackageType.ExamCandidateList or DrivingMebbisTransferPackageType.ExamResultList)
        {
            var source = await db.DrivingExamCandidates.AsNoTracking().Where(x => profileIds.Contains(x.StudentDrivingProfileId))
                .Join(db.DrivingExamSessions.AsNoTracking(), c => c.ExamSessionId, e => e.Id, (c, e) => new { c, e })
                .Join(db.StudentDrivingProfiles.AsNoTracking(), x => x.c.StudentDrivingProfileId, p => p.Id, (x, p) => new { x.c, x.e, p.StudentId })
                .Join(db.Students.AsNoTracking(), x => x.StudentId, s => s.Id, (x, s) => new { x.c, x.e, s.FullName, s.TcNo }).ToListAsync(ct);
            var rows = source.Select(x => type == DrivingMebbisTransferPackageType.ExamCandidateList
                ? new[] { x.e.Title, x.e.ExamType.ToString(), Date(x.e.StartsAtUtc), x.e.Location, x.TcNo, x.FullName, $"{x.c.AttemptNo}", x.c.Status.ToString() }
                : new[] { x.e.Title, x.e.ExamType.ToString(), x.TcNo, x.FullName, x.c.Status.ToString(), x.c.Score?.ToString("0.##", CultureInfo.InvariantCulture) ?? "", x.c.FailureReason, Date(x.c.ResultEnteredAtUtc) }).ToList();
            return new(type == DrivingMebbisTransferPackageType.ExamCandidateList ? ["Sınav", "Tür", "Tarih", "Yer", "TC", "Kursiyer", "Deneme", "Durum"] : ["Sınav", "Tür", "TC", "Kursiyer", "Sonuç", "Puan", "Başarısızlık Nedeni", "Sonuç Tarihi"], rows, profileIds);
        }
        if (type == DrivingMebbisTransferPackageType.CertificateList)
        {
            var source = await db.DrivingCertificates.AsNoTracking().Where(x => profileIds.Contains(x.StudentDrivingProfileId))
                .Join(db.StudentDrivingProfiles.AsNoTracking(), c => c.StudentDrivingProfileId, p => p.Id, (c, p) => new { c, p.StudentId })
                .Join(db.Students.AsNoTracking(), x => x.StudentId, s => s.Id, (x, s) => new { s.TcNo, s.FullName, x.c }).ToListAsync(ct);
            var rows = source.Select(x => new[] { x.TcNo, x.FullName, x.c.CertificateType.ToString(), x.c.DocumentNumber, x.c.MebbisCertificateNo, Date(x.c.IssuedAtUtc), x.c.DeliveryStatus.ToString(), x.c.Status.ToString(), $"{x.c.Version}" }).ToList();
            return new(["TC", "Kursiyer", "Belge Türü", "Belge No", "MEBBİS Sertifika No", "Düzenleme Tarihi", "Teslim", "Durum", "Sürüm"], rows, profileIds);
        }
        if (type == DrivingMebbisTransferPackageType.InvoiceList)
        {
            var source = await db.EnrollmentContracts.AsNoTracking().Where(x => x.StudentUserId != null && userIds.Contains(x.StudentUserId.Value)).ToListAsync(ct);
            var rows = source.Select(x => new[] { x.StudentName, x.AcademicYear, x.GrossAmount.ToString("0.00", CultureInfo.InvariantCulture), x.DiscountAmount.ToString("0.00", CultureInfo.InvariantCulture), x.NetAmount.ToString("0.00", CultureInfo.InvariantCulture), x.DownPayment.ToString("0.00", CultureInfo.InvariantCulture), $"{x.InstallmentCount}", x.Currency, x.Status, Date(x.CreatedAtUtc) }).ToList();
            return new(["Kursiyer", "Dönem", "Brüt", "İndirim", "Net", "Peşinat", "Taksit", "Para Birimi", "Durum", "Oluşturma"], rows, profileIds);
        }
        var stats = baseStudents.GroupBy(x => new { x.p.LicenseClass, x.p.TransmissionType, x.p.Status }).OrderBy(x => x.Key.LicenseClass)
            .Select(x => new[] { x.Key.LicenseClass, x.Key.TransmissionType.ToString(), x.Key.Status.ToString(), $"{x.Count()}", $"{x.Count(y => y.p.MebbisEnteredAtUtc.HasValue)}" }).ToList();
        return new(["Ehliyet Sınıfı", "Vites", "Kursiyer Durumu", "Kursiyer Sayısı", "MEBBİS'e Girilen"], stats, profileIds);
    }

    private static string Identity(StudentDrivingProfile p, string tc) => p.IdentityKind == IdentityKind.TurkishId && string.IsNullOrWhiteSpace(p.IdentityNumber) ? tc : p.IdentityNumber;
    private static string Date(DateTime? value) => value?.ToString("dd.MM.yyyy HH:mm", CultureInfo.GetCultureInfo("tr-TR")) ?? string.Empty;
    private static string TypeSlug(DrivingMebbisTransferPackageType type) => type.ToString().ToLowerInvariant();
    private Guid? CurrentUserId() { var raw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"); return Guid.TryParse(raw, out var id) ? id : null; }
    private string CurrentUserName() { var value = (User.FindFirstValue("name") ?? User.FindFirstValue("unique_name") ?? User.Identity?.Name ?? "Sistem").Trim(); if (value.Length == 0) value = "Sistem"; return value[..Math.Min(150, value.Length)]; }
    private async Task<bool> CanUseModuleAsync(CancellationToken ct) { if (db.CurrentTenantId is not Guid tenantId) return false; var tenant = await db.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == tenantId, ct); return tenant is not null && tenant.InstitutionType == InstitutionType.DrivingSchool && tenant.DrivingSchoolModuleEnabled && tenant.Status.Equals("active", StringComparison.OrdinalIgnoreCase); }
    private sealed record PackageData(IReadOnlyList<string> Headers, List<string[]> Rows, IReadOnlyList<Guid> StudentIds);
}

public sealed record CreateTransferPackageRequest(string PackageType, Guid StudentGroupId);
public sealed record UpdateTransferPackageStatusRequest(string Status, string? ErrorResult, int ExpectedVersion);
