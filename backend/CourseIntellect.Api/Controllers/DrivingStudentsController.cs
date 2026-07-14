using CourseIntellect.Api.Authorization;
using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.DTOs.Students;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data;
using System.Security.Claims;
using System.Text.Json;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Sürücü adayının kayıt sihirbazı, kurs dosyası (evraklar) ve sekmeli detay merkezi.
/// Yetki <c>[RequireDrivingPermission]</c> ile, kurum izolasyonu tenant query filter
/// ile zorlanır; öğrenci uçları yalnızca kendi dosyasına erişir.
/// </summary>
[ApiController]
[Authorize]
[Route("api/driving-school")]
public sealed class DrivingStudentsController(
    CourseIntellectDbContext dbContext,
    IDrivingPermissionService permissionService,
    IAcademicQueryService academicQueryService,
    IStudentFinanceService financeService,
    IDrivingLedgerService ledgerService,
    IDrivingNotifier notifier,
    IAuditLogService auditLogService) : ControllerBase
{
    private const string AuditCategory = "DrivingSchool";

    // ─── Kayıt sihirbazı ──────────────────────────────────────────────────────

    /// <summary>
    /// Sihirbazın tek atımlık kesin kaydı: öğrenci profili + sürücü dosyası +
    /// (varsa) sözleşme/taksit planı + yüklenmiş evraklar aynı transaction'da yazılır.
    /// Yarım kalmış kayıt bırakmamak için hepsi ya olur ya olmaz.
    /// </summary>
    [HttpPost("students/wizard")]
    [RequireDrivingPermission(DrivingPermissions.StudentCreate)]
    public async Task<IActionResult> RegisterStudent([FromBody] DrivingStudentWizardRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var actorId = CurrentUserId();
        if (actorId is null) return Unauthorized();

        var error = Validate(request);
        if (error is not null) return BadRequest(new { message = error });

        var package = await dbContext.DrivingPackages.AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == request.PackageId && x.IsActive, ct);
        if (package is null) return BadRequest(new { message = "Aktif paket bulunamadı." });

        var identityNumber = request.IdentityNumber.Trim();
        // Kurum içinde aynı kimlik numarasıyla ikinci bir dosya açılamaz.
        var duplicate = await FindDuplicateAsync(identityNumber, ct);
        if (duplicate is not null)
            return Conflict(new { message = $"Bu kimlik numarasıyla kayıtlı bir kursiyer var: {duplicate}." });

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

        // Öğrenci hesabı, veli hesabı ve kullanıcı adı üretimi mevcut kayıt akışından geçer;
        // aday mobil uygulamaya bu kimlikle girip evraklarını yükleyecek.
        var credentials = await academicQueryService.CreateStudentAsync(
            new CreateStudentRequest(
                FullName: request.FullName.Trim(),
                // TC dışı kimlikler StudentProfile.TcNo'ya yazılamaz (11 hane sınırı);
                // asıl numara sürücü dosyasındaki IdentityNumber'da durur.
                TcNo: request.IdentityKind == IdentityKind.TurkishId ? identityNumber : string.Empty,
                ClassName: $"{package.LicenseClass}-{(package.TransmissionType == TransmissionType.Manual ? "M" : "O")}",
                CurrentSchool: string.Empty,
                SchoolNumber: string.Empty,
                BirthDate: request.BirthDate ?? string.Empty,
                ProgramType: $"{package.LicenseClass} Sürücü Kursu",
                ParentName: request.EmergencyContactName?.Trim() ?? string.Empty,
                ParentPhone: request.EmergencyContactPhone?.Trim() ?? string.Empty,
                ParentEmail: request.Email?.Trim() ?? string.Empty,
                Address: request.Address?.Trim() ?? string.Empty,
                Note: request.Note?.Trim() ?? string.Empty),
            ct);

        var student = await dbContext.Students.SingleAsync(x => x.UserId == credentials.UserId, ct);

        var profile = new StudentDrivingProfile
        {
            StudentId = student.Id,
            PackageId = package.Id,
            LicenseClass = package.LicenseClass,
            TransmissionType = package.TransmissionType,
            PurchasedDrivingMinutes = package.DrivingLessonMinutes,
            // Dosya eksik başlar: evraklar onaylanınca yönetici Active'e taşır.
            Status = DrivingStudentStatus.DocumentsPending,
            IdentityKind = request.IdentityKind,
            IdentityNumber = identityNumber,
            Nationality = request.Nationality?.Trim() ?? string.Empty,
            Gender = request.Gender?.Trim() ?? string.Empty,
            BloodType = request.BloodType?.Trim() ?? string.Empty,
            Occupation = request.Occupation?.Trim() ?? string.Empty,
            EducationLevel = request.EducationLevel?.Trim() ?? string.Empty,
            City = request.City?.Trim() ?? string.Empty,
            District = request.District?.Trim() ?? string.Empty,
            WhatsAppPhone = request.WhatsAppPhone?.Trim() ?? string.Empty,
            EmergencyContactName = request.EmergencyContactName?.Trim() ?? string.Empty,
            EmergencyContactPhone = request.EmergencyContactPhone?.Trim() ?? string.Empty,
            PhotoUrl = request.PhotoUrl?.Trim() ?? string.Empty,
            CourseStartsAtUtc = request.CourseStartsAtUtc,
            PreferredInstructorProfileId = request.PreferredInstructorProfileId,
            PreferredVehicleId = request.PreferredVehicleId,
            DrivingExperience = request.DrivingExperience,
            AvailableWeekdays = request.AvailableWeekdays,
            AvailableWeekend = request.AvailableWeekend,
            PrefersMorning = request.PrefersMorning,
            PrefersMidday = request.PrefersMidday,
            PrefersEvening = request.PrefersEvening,
            AccessibilityNotes = request.AccessibilityNotes?.Trim() ?? string.Empty,
            KvkkConsentAtUtc = DateTime.UtcNow,
            CommunicationConsent = request.CommunicationConsent,
            ContractSignedAtUtc = string.IsNullOrWhiteSpace(request.SignatureUrl) ? null : DateTime.UtcNow,
            SignatureUrl = request.SignatureUrl?.Trim() ?? string.Empty,
            RegisteredByUserId = actorId,
            ApprovedByUserId = actorId,
            ApprovedAtUtc = DateTime.UtcNow,
        };
        dbContext.StudentDrivingProfiles.Add(profile);

        // Paket dakikaları defterin AÇILIŞ hareketidir; bakiye buradan başlar.
        await ledgerService.AddAsync(profile.Id, DrivingLedgerEntryType.PackageMinutes, package.DrivingLessonMinutes,
            $"\"{package.Name}\" paketinden gelen direksiyon hakkı", cancellationToken: ct);

        foreach (var document in request.Documents ?? [])
        {
            if (document.ParsedType is not { } documentType) return BadRequest(new { message = $"Belge türü geçersiz: {document.DocumentType}." });
            if (!IsSafeUploadUrl(document.FileUrl)) return BadRequest(new { message = "Belge dosyası güvenli yükleme alanından seçilmelidir." });
            dbContext.StudentDrivingDocuments.Add(new StudentDrivingDocument
            {
                StudentDrivingProfileId = profile.Id,
                DocumentType = documentType,
                Status = StudentDocumentStatus.PendingApproval,
                FileUrl = document.FileUrl.Trim(),
                FileName = document.FileName?.Trim() ?? string.Empty,
                DocumentNumber = document.DocumentNumber?.Trim() ?? string.Empty,
                ExpiresAtUtc = document.ExpiresAtUtc,
                UploadedByUserId = actorId,
            });
        }

        await dbContext.SaveChangesAsync(ct);

        // Finans adımı: sözleşme + taksit planı + peşinat mevcut finans servisinden geçer,
        // böylece makbuz numarası ve taksit üretimi tek yerde kalır.
        EnrollmentContractDto? contract = null;
        if (request.Finance is { } finance && finance.GrossAmount > 0)
        {
            contract = await financeService.CreateEnrollmentAsync(
                new CreateEnrollmentRequest(
                    StudentUserId: credentials.UserId,
                    StudentName: student.FullName,
                    ClassName: $"{package.LicenseClass}-{package.TransmissionType}",
                    AcademicYear: DateTime.UtcNow.Year.ToString(),
                    GrossAmount: finance.GrossAmount,
                    DiscountAmount: finance.DiscountAmount,
                    DiscountReason: finance.DiscountReason,
                    DownPayment: finance.DownPayment,
                    InstallmentCount: finance.InstallmentCount,
                    FirstInstallmentDate: finance.FirstInstallmentDate,
                    Currency: "TRY",
                    Note: $"Sürücü kursu paketi: {package.Name}",
                    DownPaymentMethod: finance.DownPaymentMethod),
                actorId,
                ct);

            profile.EnrollmentContractId = contract.Id;
            await dbContext.SaveChangesAsync(ct);
        }

        await transaction.CommitAsync(ct);

        await auditLogService.LogChangeAsync("Sürücü adayı kaydı tamamlandı", AuditCategory, "StudentDrivingProfile", profile.Id.ToString(),
            $"{student.FullName} — paket \"{package.Name}\" ({profile.LicenseClass}/{profile.TransmissionType}), "
                + $"{(request.Documents?.Count ?? 0)} evrak yüklendi, sözleşme: {(contract is null ? "yok" : $"{contract.NetAmount:N2} ₺")}.",
            null,
            new { student.FullName, profile.IdentityKind, profile.LicenseClass, profile.TransmissionType, profile.Status, contractId = contract?.Id },
            ct);

        return Ok(new
        {
            studentDrivingProfileId = profile.Id,
            studentId = student.Id,
            status = profile.Status.ToString(),
            contractId = contract?.Id,
            // Kayıt masası adaya kullanıcı adı/şifreyi teslim eder — mobilden evrak yükleyecek.
            credentials = new { credentials.Username, credentials.Password, credentials.UserId },
            parentCredentials = credentials.Parent,
            missingDocuments = MissingDocumentTypes(
                RequiredDocumentsFor(request.BirthDate),
                (request.Documents ?? []).Select(x => x.ParsedType).OfType<StudentDocumentType>().ToHashSet())
                .Select(x => new { documentType = x.ToString(), label = DocumentLabel(x) }),
        });
    }

    /// <summary>Kayıt sihirbazının ilk adımında çağrılır: kimlik numarası kurumda zaten var mı?</summary>
    [HttpGet("students/check-identity")]
    [RequireDrivingPermission(DrivingPermissions.StudentCreate)]
    public async Task<IActionResult> CheckIdentity([FromQuery] string identityNumber, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var trimmed = (identityNumber ?? string.Empty).Trim();
        if (trimmed.Length < 5) return BadRequest(new { message = "Kimlik numarası en az 5 karakter olmalıdır." });
        var duplicate = await FindDuplicateAsync(trimmed, ct);
        return Ok(new { available = duplicate is null, existingStudentName = duplicate });
    }

    // ─── Taslak (autosave) ────────────────────────────────────────────────────

    [HttpGet("registration-drafts")]
    [RequireDrivingPermission(DrivingPermissions.StudentCreate)]
    public async Task<IActionResult> GetDrafts(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var actorId = CurrentUserId();
        if (actorId is null) return Unauthorized();
        // Taslak yarım kalmış bir formdur; başkasının yarım formunu görmenin anlamı yok.
        var drafts = await dbContext.DrivingRegistrationDrafts.AsNoTracking()
            .Where(x => x.CreatedByUserId == actorId)
            .OrderByDescending(x => x.UpdatedAtUtc)
            .Take(20)
            .Select(x => new { x.Id, x.DisplayName, x.Step, x.PayloadJson, x.UpdatedAtUtc })
            .ToListAsync(ct);
        return Ok(drafts);
    }

    [HttpPut("registration-drafts")]
    [RequireDrivingPermission(DrivingPermissions.StudentCreate)]
    public async Task<IActionResult> SaveDraft([FromBody] SaveRegistrationDraftRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var actorId = CurrentUserId();
        if (actorId is null) return Unauthorized();
        if (request.PayloadJson.Length > 20000) return BadRequest(new { message = "Taslak içeriği çok büyük." });
        if (!IsValidJson(request.PayloadJson)) return BadRequest(new { message = "Taslak içeriği geçerli JSON olmalıdır." });

        var draft = request.Id is Guid id
            ? await dbContext.DrivingRegistrationDrafts.SingleOrDefaultAsync(x => x.Id == id && x.CreatedByUserId == actorId, ct)
            : null;

        if (draft is null)
        {
            draft = new DrivingRegistrationDraft { CreatedByUserId = actorId.Value };
            dbContext.DrivingRegistrationDrafts.Add(draft);
        }

        draft.DisplayName = (request.DisplayName ?? "İsimsiz aday").Trim();
        draft.Step = Math.Clamp(request.Step, 1, 12);
        draft.PayloadJson = request.PayloadJson;
        draft.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);
        return Ok(new { draft.Id, draft.Step, draft.UpdatedAtUtc });
    }

    [HttpDelete("registration-drafts/{id:guid}")]
    [RequireDrivingPermission(DrivingPermissions.StudentCreate)]
    public async Task<IActionResult> DeleteDraft(Guid id, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var actorId = CurrentUserId();
        var draft = await dbContext.DrivingRegistrationDrafts.SingleOrDefaultAsync(x => x.Id == id && x.CreatedByUserId == actorId, ct);
        if (draft is null) return NotFound();
        dbContext.DrivingRegistrationDrafts.Remove(draft);
        await dbContext.SaveChangesAsync(ct);
        return NoContent();
    }

    // ─── Öğrenci evrakları ────────────────────────────────────────────────────

    /// <summary>
    /// Bir adayın kurs dosyası: zorunlu her belge türü için tek satır döner —
    /// yüklenmemişse <c>Missing</c>, süresi geçmişse <c>Expired</c>.
    /// </summary>
    [HttpGet("students/{profileId:guid}/documents")]
    [RequireDrivingPermission(DrivingPermissions.StudentDocumentView)]
    public async Task<IActionResult> GetStudentDocuments(Guid profileId, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var profile = await dbContext.StudentDrivingProfiles.AsNoTracking().SingleOrDefaultAsync(x => x.Id == profileId, ct);
        if (profile is null) return NotFound(new { message = "Kursiyer bulunamadı." });
        return Ok(await BuildDocumentFileAsync(profile, ct));
    }

    /// <summary>Personelin aday adına belge yüklemesi.</summary>
    [HttpPost("students/{profileId:guid}/documents")]
    [RequireDrivingPermission(DrivingPermissions.StudentDocumentUpload)]
    public async Task<IActionResult> UploadStudentDocument(Guid profileId, [FromBody] UploadStudentDocumentRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var profile = await dbContext.StudentDrivingProfiles.AsNoTracking().SingleOrDefaultAsync(x => x.Id == profileId, ct);
        if (profile is null) return NotFound(new { message = "Kursiyer bulunamadı." });
        return await StoreDocumentAsync(profile, request, ct);
    }

    /// <summary>
    /// Belgeyi onaylar veya reddeder. Ret her zaman gerekçe ister — öğrenci mobilde
    /// bu gerekçeyi görüp doğru belgeyi yeniden yükler.
    /// </summary>
    [HttpPost("student-documents/{id:guid}/review")]
    [RequireDrivingPermission(DrivingPermissions.StudentDocumentReview)]
    public async Task<IActionResult> ReviewStudentDocument(Guid id, [FromBody] ReviewStudentDocumentRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var actorId = CurrentUserId();
        if (actorId is null) return Unauthorized();

        var document = await dbContext.StudentDrivingDocuments.SingleOrDefaultAsync(x => x.Id == id, ct);
        if (document is null) return NotFound(new { message = "Belge bulunamadı." });
        if (!document.IsCurrent) return Conflict(new { message = "Bu belge geçmiş bir sürüm; güncel sürümü inceleyin." });

        var reason = request.RejectionReason?.Trim() ?? string.Empty;
        if (!request.Approved && reason.Length is < 5 or > 500)
            return BadRequest(new { message = "Ret nedeni 5-500 karakter olmalıdır." });
        if (request.Approved && DrivingStudentRules.ExpiringDocuments.Contains(document.DocumentType) && document.ExpiresAtUtc is null)
            return BadRequest(new { message = "Süreli belge, son geçerlilik tarihi olmadan onaylanamaz." });
        if (request.Approved && document.ExpiresAtUtc is { } expires && expires <= DateTime.UtcNow)
            return BadRequest(new { message = "Süresi dolmuş belge onaylanamaz." });

        var before = document.Status;
        document.Status = request.Approved ? StudentDocumentStatus.Approved : StudentDocumentStatus.Rejected;
        document.RejectionReason = request.Approved ? string.Empty : reason;
        document.ReviewedByUserId = actorId;
        document.ReviewedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);

        await auditLogService.LogChangeAsync(
            request.Approved ? "Öğrenci evrakı onaylandı" : "Öğrenci evrakı reddedildi",
            AuditCategory, "StudentDrivingDocument", document.Id.ToString(),
            $"{DocumentLabel(document.DocumentType)}{(request.Approved ? string.Empty : $" — ret nedeni: {reason}")}",
            new { status = before.ToString() },
            new { status = document.Status.ToString(), document.RejectionReason },
            ct);

        // Ret nedeni öğrenciye AYNEN gider; doğru belgeyi yükleyebilmesi için şart.
        await notifier.NotifyStudentAsync(document.StudentDrivingProfileId,
            request.Approved ? "Belgeniz onaylandı" : "Belgeniz reddedildi",
            request.Approved
                ? $"{DocumentLabel(document.DocumentType)} onaylandı."
                : $"{DocumentLabel(document.DocumentType)} reddedildi. Neden: {reason} Lütfen doğru belgeyi yeniden yükleyin.",
            DrivingNotificationCategories.Document,
            dedupeKey: $"document-review:{document.Id}:{document.Status}",
            relatedEntityType: "StudentDrivingDocument", relatedEntityId: document.Id.ToString(),
            cancellationToken: ct);

        return Ok(new { document.Id, status = document.Status.ToString(), document.RejectionReason, document.ReviewedAtUtc });
    }

    // ─── Öğrencinin kendi dosyası (mobil) ─────────────────────────────────────

    [HttpGet("student/my-documents")]
    [Authorize(Roles = "Student")]
    [RequireDrivingPermission(DrivingPermissions.StudentDocumentView)]
    public async Task<IActionResult> GetMyDocuments(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var profile = await CurrentStudentProfileAsync(ct);
        if (profile is null) return Forbid();
        return Ok(await BuildDocumentFileAsync(profile, ct));
    }

    [HttpPost("student/my-documents")]
    [Authorize(Roles = "Student")]
    [RequireDrivingPermission(DrivingPermissions.StudentDocumentUpload)]
    public async Task<IActionResult> UploadMyDocument([FromBody] UploadStudentDocumentRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var profile = await CurrentStudentProfileAsync(ct);
        if (profile is null) return Forbid();
        return await StoreDocumentAsync(profile, request, ct);
    }

    // ─── Öğrenci detay merkezi (sekmeli) ──────────────────────────────────────

    /// <summary>
    /// Tek çağrıda tüm sekmeler: genel bakış, direksiyon özeti, randevular, evraklar,
    /// ödemeler, sınavlar, notlar ve işlem geçmişi. Desktop detay sayfası bunu okur.
    /// </summary>
    [HttpGet("students/{profileId:guid}/detail")]
    [RequireDrivingPermission(DrivingPermissions.StudentView)]
    public async Task<IActionResult> GetStudentDetail(Guid profileId, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();

        var row = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.Id == profileId)
            .Join(dbContext.Students.AsNoTracking(), x => x.StudentId, x => x.Id, (profile, student) => new { profile, student })
            .Join(dbContext.DrivingPackages.AsNoTracking(), x => x.profile.PackageId, x => x.Id, (x, package) => new { x.profile, x.student, package })
            .SingleOrDefaultAsync(ct);
        if (row is null) return NotFound(new { message = "Kursiyer bulunamadı." });

        var profile = row.profile;
        var canSeeFinance = await permissionService.HasAsync(User, DrivingPermissions.FinanceView, ct);

        var appointments = await dbContext.DrivingAppointments.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId)
            .Join(dbContext.DrivingInstructorProfiles.AsNoTracking(), x => x.InstructorProfileId, x => x.Id, (appointment, instructor) => new { appointment, instructor.StaffId })
            .Join(dbContext.Staff.AsNoTracking(), x => x.StaffId, x => x.Id, (x, staff) => new { x.appointment, InstructorName = staff.FullName })
            .Join(dbContext.DrivingVehicles.AsNoTracking(), x => x.appointment.VehicleId, x => x.Id, (x, vehicle) => new
            {
                x.appointment.Id,
                x.InstructorName,
                VehiclePlate = vehicle.PlateNumber,
                x.appointment.StartsAtUtc,
                x.appointment.EndsAtUtc,
                status = x.appointment.Status.ToString(),
                x.appointment.Notes,
            })
            .OrderByDescending(x => x.StartsAtUtc)
            .Take(200)
            .ToListAsync(ct);

        var lessons = await dbContext.DrivingLessons.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId)
            .Join(dbContext.DrivingInstructorProfiles.AsNoTracking(), x => x.InstructorProfileId, x => x.Id, (lesson, instructor) => new { lesson, instructor.StaffId })
            .Join(dbContext.Staff.AsNoTracking(), x => x.StaffId, x => x.Id, (x, staff) => new { x.lesson, InstructorName = staff.FullName })
            .Join(dbContext.DrivingVehicles.AsNoTracking(), x => x.lesson.VehicleId, x => x.Id, (x, vehicle) => new
            {
                x.lesson.Id,
                x.InstructorName,
                VehiclePlate = vehicle.PlateNumber,
                x.lesson.StartedAtUtc,
                x.lesson.CompletedAtUtc,
                x.lesson.ChargedMinutes,
                x.lesson.TrafficRulesScore,
                x.lesson.VehicleControlScore,
                x.lesson.ManeuversScore,
                x.lesson.SafetyScore,
                x.lesson.EvaluationVersion,
                x.lesson.EvaluationScoresJson,
                x.lesson.InstructorNote,
            })
            .OrderByDescending(x => x.StartedAtUtc)
            .Take(200)
            .ToListAsync(ct);

        var ledger = await dbContext.DrivingLessonLedgerEntries.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(200)
            .Select(x => new { x.Id, x.MinutesDelta, x.EntryType, x.Description, x.CreatedAtUtc })
            .ToListAsync(ct);

        var documents = await BuildDocumentFileAsync(profile, ct);

        // Planlanmış (henüz kullanılmamış ama bağlanmış) dakikalar borç değil, rezervasyondur.
        var now = DateTime.UtcNow;
        var plannedMinutes = appointments
            .Where(x => x.status is nameof(DrivingAppointmentStatus.Planned) or nameof(DrivingAppointmentStatus.Approved) && x.StartsAtUtc > now)
            .Sum(x => (int)(x.EndsAtUtc - x.StartsAtUtc).TotalMinutes);

        object? finance = null;
        if (canSeeFinance && profile.EnrollmentContractId is Guid contractId)
        {
            var contract = await dbContext.EnrollmentContracts.AsNoTracking().SingleOrDefaultAsync(x => x.Id == contractId, ct);
            var installments = await dbContext.FinanceInstallments.AsNoTracking()
                .Where(x => x.EnrollmentContractId == contractId)
                .OrderBy(x => x.SeqNo)
                .Select(x => new { x.Id, x.SeqNo, x.Label, x.DueDateUtc, x.Amount, x.PaidAmount, x.Status })
                .ToListAsync(ct);
            var payments = await dbContext.FinancePayments.AsNoTracking()
                .Where(x => x.EnrollmentContractId == contractId)
                .OrderByDescending(x => x.PaidAtUtc)
                .Select(x => new { x.Id, x.Amount, x.Method, x.ReceiptNo, x.Note, x.PaidAtUtc })
                .ToListAsync(ct);
            finance = new
            {
                contract?.GrossAmount,
                contract?.DiscountAmount,
                contract?.NetAmount,
                contract?.DownPayment,
                paidTotal = payments.Sum(x => x.Amount),
                remaining = (contract?.NetAmount ?? 0) - payments.Sum(x => x.Amount),
                overdueCount = installments.Count(x => x.PaidAmount < x.Amount && x.DueDateUtc < now),
                installments,
                payments,
            };
        }

        return Ok(new
        {
            overview = new
            {
                profile.Id,
                row.student.FullName,
                row.student.TcNo,
                identityKind = profile.IdentityKind.ToString(),
                profile.IdentityNumber,
                row.student.BirthDate,
                profile.Gender,
                profile.BloodType,
                profile.Occupation,
                profile.EducationLevel,
                profile.City,
                profile.District,
                phone = row.student.ParentPhone,
                email = row.student.ParentEmail,
                profile.WhatsAppPhone,
                profile.EmergencyContactName,
                profile.EmergencyContactPhone,
                profile.PhotoUrl,
                profile.AccessibilityNotes,
                status = profile.Status.ToString(),
                packageName = row.package.Name,
                profile.LicenseClass,
                transmissionType = profile.TransmissionType.ToString(),
                profile.CourseStartsAtUtc,
                profile.RegisteredAtUtc,
                drivingExperience = profile.DrivingExperience.ToString(),
                availability = new { profile.AvailableWeekdays, profile.AvailableWeekend, profile.PrefersMorning, profile.PrefersMidday, profile.PrefersEvening },
                consents = new { profile.KvkkConsentAtUtc, profile.CommunicationConsent, profile.ContractSignedAtUtc, profile.SignatureUrl },
            },
            training = new
            {
                totalMinutes = profile.PurchasedDrivingMinutes,
                completedMinutes = profile.UsedDrivingMinutes,
                plannedMinutes,
                remainingMinutes = profile.PurchasedDrivingMinutes - profile.UsedDrivingMinutes,
                unreservedMinutes = profile.PurchasedDrivingMinutes - profile.UsedDrivingMinutes - plannedMinutes,
                completedLessonCount = lessons.Count(x => x.CompletedAtUtc != null),
                cancelledAppointmentCount = appointments.Count(x => x.status == nameof(DrivingAppointmentStatus.Cancelled)),
                instructorsWorkedWith = lessons.Select(x => x.InstructorName).Distinct().ToList(),
                vehiclesUsed = lessons.Select(x => x.VehiclePlate).Distinct().ToList(),
                averageScore = lessons.Where(x => x.SafetyScore != null)
                    .SelectMany(x => new[] { x.TrafficRulesScore, x.VehicleControlScore, x.ManeuversScore, x.SafetyScore })
                    .Where(x => x != null)
                    .DefaultIfEmpty(0)
                    .Average(x => x ?? 0),
            },
            appointments,
            lessons,
            ledger,
            documents,
            finance,
            notes = new { institution = row.student.Note, accessibility = profile.AccessibilityNotes },
            history = await dbContext.AuditLogEntries.AsNoTracking()
                .Where(x => x.Category == AuditCategory && (x.EntityId == profileId.ToString() || x.EntityId == row.student.Id.ToString()))
                .OrderByDescending(x => x.CreatedAtUtc)
                .Take(100)
                .Select(x => new { x.Id, x.Action, x.ActorName, x.Detail, x.CreatedAtUtc })
                .ToListAsync(ct),
        });
    }

    /// <summary>Adayın kurs durumunu ilerletir (evrakları tamamlanınca Active'e almak gibi).</summary>
    [HttpPost("students/{profileId:guid}/status")]
    [RequireDrivingPermission(DrivingPermissions.StudentUpdate)]
    public async Task<IActionResult> UpdateStatus(Guid profileId, [FromBody] UpdateDrivingStudentStatusRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var profile = await dbContext.StudentDrivingProfiles.SingleOrDefaultAsync(x => x.Id == profileId, ct);
        if (profile is null) return NotFound(new { message = "Kursiyer bulunamadı." });
        if (request.ParsedStatus is not { } requestedStatus) return BadRequest(new { message = $"Geçersiz durum: {request.Status}." });
        if (requestedStatus == DrivingStudentStatus.Graduated)
            return BadRequest(new { message = "Mezuniyet durumu elle verilemez. Mezuniyet kontrol listesi ve onay akışını kullanın." });

        // Evrakı eksik adayı derse başlatmayalım: Active'e geçiş dosya tamam olmadan yapılamaz.
        if (DrivingStudentStatuses.Schedulable.Contains(requestedStatus))
        {
            var missing = await MissingRequiredDocumentsAsync(profile, ct);
            if (missing.Count > 0)
                return BadRequest(new
                {
                    message = "Zorunlu evrakları tamamlanmayan kursiyer eğitime alınamaz.",
                    missingDocuments = missing.Select(x => DocumentLabel(x)),
                });
        }

        var before = profile.Status;
        if (before == requestedStatus) return Ok(new { status = before.ToString() });
        profile.Status = requestedStatus;
        await dbContext.SaveChangesAsync(ct);

        await auditLogService.LogChangeAsync("Kursiyer durumu değiştirildi", AuditCategory, "StudentDrivingProfile", profile.Id.ToString(),
            $"{before} → {requestedStatus}. {request.Reason?.Trim()}".Trim(),
            new { status = before.ToString() },
            new { status = profile.Status.ToString(), reason = request.Reason?.Trim() },
            ct);

        return Ok(new { status = profile.Status.ToString() });
    }

    // ─── Yardımcılar ──────────────────────────────────────────────────────────

    /// <summary>Belge dosyasını (zorunlu + yüklenmiş) tek listede birleştirir.</summary>
    private async Task<object> BuildDocumentFileAsync(StudentDrivingProfile profile, CancellationToken ct)
    {
        var birthDate = await dbContext.Students.AsNoTracking()
            .Where(x => x.Id == profile.StudentId)
            .Select(x => x.BirthDate)
            .SingleOrDefaultAsync(ct);

        var required = RequiredDocumentsFor(birthDate);
        var stored = await dbContext.StudentDrivingDocuments.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profile.Id)
            .OrderByDescending(x => x.UploadedAtUtc)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var current = stored.Where(x => x.IsCurrent).ToList();

        var rows = required
            .Concat(current.Select(x => x.DocumentType).Where(x => !required.Contains(x)))
            .Distinct()
            .Select(type =>
            {
                var document = current.FirstOrDefault(x => x.DocumentType == type);
                // Süresi dolmuş belge onaylı sayılmaz — dosya yeniden eksiğe düşer.
                var status = document is null
                    ? StudentDocumentStatus.Missing
                    : document.ExpiresAtUtc is { } expires && expires <= now
                        ? StudentDocumentStatus.Expired
                        : document.Status;
                return new
                {
                    documentType = type.ToString(),
                    label = DocumentLabel(type),
                    required = required.Contains(type),
                    status = status.ToString(),
                    id = document?.Id,
                    fileUrl = document?.FileUrl,
                    fileName = document?.FileName,
                    documentNumber = document?.DocumentNumber,
                    expiresAtUtc = document?.ExpiresAtUtc,
                    uploadedAtUtc = document?.UploadedAtUtc,
                    reviewedAtUtc = document?.ReviewedAtUtc,
                    rejectionReason = document?.RejectionReason,
                };
            })
            .ToList();

        return new
        {
            items = rows,
            missingCount = rows.Count(x => x.required && x.status is nameof(StudentDocumentStatus.Missing) or nameof(StudentDocumentStatus.Rejected) or nameof(StudentDocumentStatus.Expired)),
            pendingCount = rows.Count(x => x.status == nameof(StudentDocumentStatus.PendingApproval)),
            complete = rows.Where(x => x.required).All(x => x.status == nameof(StudentDocumentStatus.Approved)),
            history = stored.Where(x => !x.IsCurrent).Select(x => new
            {
                x.Id,
                documentType = x.DocumentType.ToString(),
                label = DocumentLabel(x.DocumentType),
                status = x.Status.ToString(),
                x.FileUrl,
                x.UploadedAtUtc,
                x.RejectionReason,
            }).ToList(),
        };
    }

    /// <summary>
    /// Belgeyi kaydeder; aynı türün önceki sürümü varsa onu geçmişe alır.
    /// Silmek yerine geçmişe almak, hangi belgenin ne zaman onaylandığını korur.
    /// </summary>
    private async Task<IActionResult> StoreDocumentAsync(StudentDrivingProfile profile, UploadStudentDocumentRequest request, CancellationToken ct)
    {
        var actorId = CurrentUserId();
        if (actorId is null) return Unauthorized();
        if (request.ParsedType is not { } documentType) return BadRequest(new { message = $"Belge türü geçersiz: {request.DocumentType}." });
        if (!IsSafeUploadUrl(request.FileUrl)) return BadRequest(new { message = "Belge dosyası güvenli yükleme alanından seçilmelidir." });
        if ((request.DocumentNumber?.Length ?? 0) > 100 || (request.Description?.Length ?? 0) > 1000)
            return BadRequest(new { message = "Belge numarası veya açıklama çok uzun." });
        if (request.ExpiresAtUtc is { } expires && (expires <= DateTime.UtcNow || expires > DateTime.UtcNow.AddYears(20)))
            return BadRequest(new { message = "Belge geçerlilik tarihi gelecekte ve makul bir aralıkta olmalıdır." });
        if (DrivingStudentRules.ExpiringDocuments.Contains(documentType) && request.ExpiresAtUtc is null)
            return BadRequest(new { message = $"{DocumentLabel(documentType)} için son geçerlilik tarihi zorunludur." });

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var previous = await dbContext.StudentDrivingDocuments
            .Where(x => x.StudentDrivingProfileId == profile.Id && x.DocumentType == documentType && x.IsCurrent)
            .ToListAsync(ct);
        foreach (var item in previous) item.IsCurrent = false;

        var document = new StudentDrivingDocument
        {
            StudentDrivingProfileId = profile.Id,
            DocumentType = documentType,
            Status = StudentDocumentStatus.PendingApproval,
            FileUrl = request.FileUrl.Trim(),
            FileName = request.FileName?.Trim() ?? string.Empty,
            DocumentNumber = request.DocumentNumber?.Trim() ?? string.Empty,
            ExpiresAtUtc = request.ExpiresAtUtc,
            Description = request.Description?.Trim() ?? string.Empty,
            UploadedByUserId = actorId,
        };
        dbContext.StudentDrivingDocuments.Add(document);
        await dbContext.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        await auditLogService.LogChangeAsync("Öğrenci evrakı yüklendi", AuditCategory, "StudentDrivingDocument", document.Id.ToString(),
            $"{DocumentLabel(document.DocumentType)} yüklendi, onay bekliyor."
                + (previous.Count > 0 ? " Önceki sürüm geçmişe alındı." : string.Empty),
            previous.Count == 0 ? null : new { previousStatus = previous[0].Status.ToString(), previousFileUrl = previous[0].FileUrl },
            new { document.DocumentType, document.FileUrl, document.ExpiresAtUtc, status = document.Status.ToString() },
            ct);

        await notifier.NotifyManagersAsync(
            "Öğrenci evrakı onay bekliyor",
            $"{DocumentLabel(document.DocumentType)} yüklendi ve onay bekliyor.",
            DrivingNotificationCategories.Document,
            dedupeKey: $"document-pending:{document.Id}",
            relatedEntityType: "StudentDrivingDocument", relatedEntityId: document.Id.ToString(),
            cancellationToken: ct);

        return Ok(new
        {
            document.Id,
            documentType = document.DocumentType.ToString(),
            status = document.Status.ToString(),
            document.ExpiresAtUtc,
        });
    }

    /// <summary>Onaylanmamış veya süresi geçmiş zorunlu belgeler.</summary>
    private async Task<List<StudentDocumentType>> MissingRequiredDocumentsAsync(StudentDrivingProfile profile, CancellationToken ct)
    {
        var birthDate = await dbContext.Students.AsNoTracking()
            .Where(x => x.Id == profile.StudentId).Select(x => x.BirthDate).SingleOrDefaultAsync(ct);
        var required = RequiredDocumentsFor(birthDate);
        var now = DateTime.UtcNow;
        var approved = await dbContext.StudentDrivingDocuments.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profile.Id
                && x.IsCurrent
                && x.Status == StudentDocumentStatus.Approved
                && (x.ExpiresAtUtc == null || x.ExpiresAtUtc > now))
            .Select(x => x.DocumentType)
            .ToListAsync(ct);
        return MissingDocumentTypes(required, approved.ToHashSet());
    }

    // Kurallar Domain'de yaşar (DrivingStudentRules) — controller yalnızca çağırır.
    private static List<StudentDocumentType> MissingDocumentTypes(
        IEnumerable<StudentDocumentType> required,
        HashSet<StudentDocumentType> present)
        => DrivingStudentRules.MissingDocuments(required, present);

    private static IReadOnlyList<StudentDocumentType> RequiredDocumentsFor(string? birthDate)
        => DrivingStudentRules.RequiredDocumentsFor(birthDate, DateTime.UtcNow);

    private static string DocumentLabel(StudentDocumentType type) => DrivingStudentRules.DocumentLabel(type);

    private async Task<string?> FindDuplicateAsync(string identityNumber, CancellationToken ct)
    {
        var byProfile = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.IdentityNumber == identityNumber)
            .Join(dbContext.Students.AsNoTracking(), x => x.StudentId, x => x.Id, (_, student) => student.FullName)
            .FirstOrDefaultAsync(ct);
        if (byProfile is not null) return byProfile;

        return await dbContext.Students.AsNoTracking()
            .Where(x => x.TcNo == identityNumber && x.TcNo != string.Empty)
            .Select(x => x.FullName)
            .FirstOrDefaultAsync(ct);
    }

    private static string? Validate(DrivingStudentWizardRequest request)
    {
        if (request.FullName.Trim().Length is < 3 or > 150) return "Ad soyad 3-150 karakter olmalıdır.";
        if (!Enum.IsDefined(request.IdentityKind)) return "Kimlik türü geçersiz.";
        if (!Enum.IsDefined(request.DrivingExperience)) return "Sürüş deneyimi geçersiz.";

        var identity = request.IdentityNumber.Trim();
        if (request.IdentityKind == IdentityKind.TurkishId)
        {
            if (!DrivingStudentRules.IsValidTurkishId(identity)) return "TC kimlik numarası geçersiz.";
        }
        else if (identity.Length is < 5 or > 40)
        {
            return "Kimlik/pasaport numarası 5-40 karakter olmalıdır.";
        }

        if (!DateTime.TryParse(request.BirthDate, out var birth) || birth > DateTime.UtcNow.AddYears(-16) || birth < DateTime.UtcNow.AddYears(-100))
            return "Doğum tarihi geçersiz (aday en az 16 yaşında olmalıdır).";
        if (!request.KvkkConsent) return "KVKK aydınlatma onayı olmadan kayıt tamamlanamaz.";
        if ((request.AccessibilityNotes?.Length ?? 0) > 1000) return "Erişilebilirlik notu en fazla 1000 karakter olabilir.";
        if (!request.AvailableWeekdays && !request.AvailableWeekend) return "En az bir zaman uygunluğu (hafta içi / hafta sonu) seçilmelidir.";

        if (request.Finance is { } finance)
        {
            if (finance.GrossAmount < 0 || finance.DiscountAmount < 0 || finance.DownPayment < 0) return "Finans tutarları negatif olamaz.";
            if (finance.DiscountAmount > finance.GrossAmount) return "İndirim, brüt tutardan büyük olamaz.";
            if (finance.DownPayment > finance.GrossAmount - finance.DiscountAmount) return "Peşinat, net tutardan büyük olamaz.";
            if (finance.InstallmentCount is < 0 or > 36) return "Taksit sayısı 0-36 arasında olmalıdır.";
        }

        return null;
    }

    private static bool IsValidJson(string payload)
    {
        try
        {
            using var _ = JsonDocument.Parse(payload);
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool IsSafeUploadUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || !Uri.TryCreate(value, UriKind.RelativeOrAbsolute, out var uri)) return false;
        if (uri.IsAbsoluteUri && uri.Scheme is not ("http" or "https")) return false;
        var path = uri.IsAbsoluteUri ? uri.AbsolutePath : value;
        return path.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase);
    }

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue("nameid") ?? User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var parsed) ? parsed : null;
    }

    private async Task<StudentDrivingProfile?> CurrentStudentProfileAsync(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return null;
        return await dbContext.StudentDrivingProfiles
            .Join(dbContext.Students.Where(x => x.UserId == userId), x => x.StudentId, x => x.Id, (profile, _) => profile)
            .SingleOrDefaultAsync(ct);
    }

    private async Task<bool> CanUseModuleAsync(CancellationToken ct)
    {
        if (dbContext.CurrentTenantId is not Guid tenantId) return false;
        var tenant = await dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == tenantId, ct);
        return tenant is not null
            && tenant.InstitutionType == InstitutionType.DrivingSchool
            && tenant.DrivingSchoolModuleEnabled
            && string.Equals(tenant.Status, "active", StringComparison.OrdinalIgnoreCase);
    }
}

public sealed record DrivingStudentWizardRequest(
    string FullName,
    IdentityKind IdentityKind,
    string IdentityNumber,
    string? Nationality,
    string? BirthDate,
    string? Gender,
    string? BloodType,
    string? Occupation,
    string? EducationLevel,
    string? City,
    string? District,
    string? Address,
    string? Phone,
    string? Email,
    string? WhatsAppPhone,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    string? PhotoUrl,
    Guid PackageId,
    DateTime? CourseStartsAtUtc,
    Guid? PreferredInstructorProfileId,
    Guid? PreferredVehicleId,
    DrivingExperienceLevel DrivingExperience,
    bool AvailableWeekdays,
    bool AvailableWeekend,
    bool PrefersMorning,
    bool PrefersMidday,
    bool PrefersEvening,
    string? AccessibilityNotes,
    bool KvkkConsent,
    bool CommunicationConsent,
    string? SignatureUrl,
    string? Note,
    DrivingWizardFinance? Finance,
    IReadOnlyList<UploadStudentDocumentRequest>? Documents);

public sealed record DrivingWizardFinance(
    decimal GrossAmount,
    decimal DiscountAmount,
    string? DiscountReason,
    decimal DownPayment,
    int InstallmentCount,
    DateTime? FirstInstallmentDate,
    string? DownPaymentMethod);

/// <summary>
/// Belge türü ve durum, tel üzerinde ADIYLA taşınır ("Identity", "Active"): sayısal
/// enum göndermek istemcileri kırılgan yapardı. Ayrıştırma <see cref="ParsedType"/> ile.
/// </summary>
public sealed record UploadStudentDocumentRequest(
    string DocumentType,
    string FileUrl,
    string? FileName,
    string? DocumentNumber,
    DateTime? ExpiresAtUtc,
    string? Description)
{
    public StudentDocumentType? ParsedType =>
        Enum.TryParse<StudentDocumentType>(DocumentType, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed)
            ? parsed
            : null;
}

public sealed record ReviewStudentDocumentRequest(bool Approved, string? RejectionReason);

public sealed record UpdateDrivingStudentStatusRequest(string Status, string? Reason)
{
    public DrivingStudentStatus? ParsedStatus =>
        Enum.TryParse<DrivingStudentStatus>(Status, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed)
            ? parsed
            : null;
}

public sealed record SaveRegistrationDraftRequest(Guid? Id, string? DisplayName, int Step, string PayloadJson);
