using CourseIntellect.Api.Authorization;
using CourseIntellect.Application.DTOs.DrivingMebbis;
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

/// <summary>
/// MEBBİS Dışa Aktarma — kursiyerleri ve bilgilerini (grup/dönem, kimlik, evrak,
/// sınav, sertifika) MEBBİS'e yüklemeye uygun biçimde bölüm bölüm indirir. Her
/// bölüm hem Excel (.xlsx, aday kaydında biyometrik fotoğraf gömülü) hem PDF olarak
/// alınabilir. Tek belge modeli: iki çıktı da aynı <see cref="MebbisExportDocument"/>'tan türer.
/// </summary>
[ApiController]
[Authorize]
[Route("api/driving-school/mebbis/export")]
public sealed class DrivingMebbisExportController(
    CourseIntellectDbContext dbContext,
    IMebbisExportRenderer renderer,
    IFileStorageService fileStorage,
    IAuditLogService auditLogService) : ControllerBase
{
    private const string AuditCategory = "DrivingSchool";

    private static readonly Dictionary<string, (string Label, string Description, bool HasPhotos)> Sections = new(StringComparer.OrdinalIgnoreCase)
    {
        ["candidate-registration"] = ("Aday Kaydı", "Kimlik ve iletişim bilgileri + biyometrik fotoğraf. MEBBİS aday kaydı ekranına birebir.", true),
        ["document-approval"] = ("Belge Onay", "Zorunlu kursiyer evraklarının onay/eksik durumu (kimlik, diploma, sağlık, sabıka, foto).", false),
        ["term-assignment"] = ("Dönem Atama", "Kursiyer–grup/dönem eşleşmesi, resmî dönem ve MEBBİS dönem kodu.", false),
        ["exam-result"] = ("Sınav Sonucu", "Teorik (e-sınav) ve direksiyon sınav sonuçları, puan ve tarih.", false),
        ["certificate-number"] = ("Sertifika No", "Mezun kursiyerlerin sertifika türü, MEBBİS sertifika numarası ve teslim durumu.", false),
    };

    /// <summary>Dışa aktarım bölümlerini ve kurumun kursiyer gruplarını döner (sayfa kartları + grup seçici için).</summary>
    [HttpGet("sections")]
    [RequireDrivingPermission(DrivingPermissions.MebbisView)]
    public async Task<IActionResult> GetSections(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var groups = await dbContext.DrivingStudentGroups.AsNoTracking()
            .OrderByDescending(x => x.TermYear).ThenByDescending(x => x.TermNumber).ThenBy(x => x.Name)
            .Select(x => new { x.Id, x.Name, x.TermYear, x.TermNumber, x.MebbisTermCode })
            .ToListAsync(ct);
        return Ok(new
        {
            sections = Sections.Select(x => new { key = x.Key, label = x.Value.Label, description = x.Value.Description, hasPhotos = x.Value.HasPhotos }),
            groups,
        });
    }

    /// <summary>Bir bölümü seçilen grup (veya tüm kurum) için Excel/PDF olarak indirir.</summary>
    [HttpGet("{section}")]
    [RequireDrivingPermission(DrivingPermissions.ReportExport)]
    public async Task<IActionResult> Export(string section, [FromQuery] Guid? groupId, [FromQuery] string format, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (!Sections.TryGetValue(section, out var meta)) return NotFound(new { message = "Bölüm bulunamadı." });
        var fmt = (format ?? "xlsx").Trim().ToLowerInvariant();
        if (fmt is not ("xlsx" or "pdf")) return BadRequest(new { message = "Biçim xlsx veya pdf olmalı." });

        string? groupLabel = null;
        if (groupId is Guid gid)
        {
            var group = await dbContext.DrivingStudentGroups.AsNoTracking().SingleOrDefaultAsync(x => x.Id == gid, ct);
            if (group is null) return NotFound(new { message = "Grup bulunamadı." });
            groupLabel = group.Name;
        }

        var document = section.ToLowerInvariant() switch
        {
            "candidate-registration" => await BuildCandidateRegistrationAsync(groupId, groupLabel, ct),
            "document-approval" => await BuildDocumentApprovalAsync(groupId, groupLabel, ct),
            "term-assignment" => await BuildTermAssignmentAsync(groupId, groupLabel, ct),
            "exam-result" => await BuildExamResultAsync(groupId, groupLabel, ct),
            "certificate-number" => await BuildCertificateNumberAsync(groupId, groupLabel, ct),
            _ => null,
        };
        if (document is null) return NotFound(new { message = "Bölüm bulunamadı." });

        await auditLogService.LogChangeAsync("MEBBİS dışa aktarımı indirildi", AuditCategory, "MebbisExport", section,
            $"{meta.Label} — {fmt.ToUpperInvariant()}{(groupLabel is null ? "" : $" ({groupLabel})")} — {document.Rows.Count} kayıt",
            null, new { section, format = fmt, groupId, rows = document.Rows.Count }, ct);

        var stamp = DateTime.UtcNow.AddHours(3).ToString("yyyyMMdd-HHmm");
        var fileStem = $"mebbis-{section}-{stamp}";
        if (fmt == "pdf")
            return File(renderer.ToPdf(document), "application/pdf", $"{fileStem}.pdf");
        return File(renderer.ToXlsx(document), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"{fileStem}.xlsx");
    }

    // ─── Bölüm belge kurucuları ────────────────────────────────────────────────

    private sealed record BaseRow(StudentDrivingProfile Profile, string FullName, string? TcNo, string BirthDate, string GroupName);

    private async Task<List<BaseRow>> LoadBaseAsync(Guid? groupId, CancellationToken ct)
    {
        var query = dbContext.StudentDrivingProfiles.AsNoTracking().AsQueryable();
        if (groupId is Guid gid) query = query.Where(x => x.StudentGroupId == gid);
        return await query
            .Join(dbContext.Students.AsNoTracking(), p => p.StudentId, s => s.Id, (p, s) => new { p, s.FullName, s.TcNo, s.BirthDate })
            .GroupJoin(dbContext.DrivingStudentGroups.AsNoTracking(), x => x.p.StudentGroupId, g => (Guid?)g.Id, (x, gs) => new { x.p, x.FullName, x.TcNo, x.BirthDate, gs })
            .SelectMany(x => x.gs.DefaultIfEmpty(), (x, g) => new BaseRow(x.p, x.FullName, x.TcNo, x.BirthDate, g != null ? g.Name : string.Empty))
            .OrderBy(x => x.Profile.StudentNumber)
            .ToListAsync(ct);
    }

    private static string ResolveIdentity(StudentDrivingProfile p, string? tcNo) =>
        p.IdentityKind == IdentityKind.TurkishId
            ? (string.IsNullOrWhiteSpace(p.IdentityNumber) ? (tcNo ?? string.Empty) : p.IdentityNumber)
            : p.IdentityNumber;

    private static (string First, string Last) SplitName(string? fullName)
    {
        var name = (fullName ?? string.Empty).Trim();
        var lastSpace = name.LastIndexOf(' ');
        return lastSpace > 0 ? (name[..lastSpace], name[(lastSpace + 1)..]) : (name, string.Empty);
    }

    private static string Date(DateTime? value) => value.HasValue ? value.Value.ToString("dd.MM.yyyy") : string.Empty;

    private async Task<MebbisExportDocument> BuildCandidateRegistrationAsync(Guid? groupId, string? groupLabel, CancellationToken ct)
    {
        var rows = await LoadBaseAsync(groupId, ct);
        var doc = new MebbisExportDocument
        {
            Title = "MEBBİS Aday Kaydı",
            Subtitle = groupLabel is null ? "Tüm kursiyerler" : $"Grup: {groupLabel}",
            SheetName = "Aday Kaydi",
            Columns =
            [
                new() { Header = "Fotoğraf", IsPhoto = true },
                new() { Header = "Kursiyer No", Width = 12 },
                new() { Header = "TC Kimlik No", Width = 16 },
                new() { Header = "Adı", Width = 18 },
                new() { Header = "Soyadı", Width = 16 },
                new() { Header = "Baba Adı", Width = 16 },
                new() { Header = "Anne Adı", Width = 16 },
                new() { Header = "Doğum Yeri", Width = 16 },
                new() { Header = "Doğum Tarihi", Width = 13 },
                new() { Header = "Cinsiyet", Width = 10 },
                new() { Header = "Öğrenim Durumu", Width = 16 },
                new() { Header = "Sertifika Sınıfı", Width = 12 },
                new() { Header = "Kimlik Seri No", Width = 14 },
                new() { Header = "Telefon", Width = 15 },
                new() { Header = "Kan Grubu", Width = 10 },
            ],
        };

        foreach (var r in rows)
        {
            var (first, last) = SplitName(r.FullName);
            var photoUrl = !string.IsNullOrWhiteSpace(r.Profile.LivePhotoUrl) ? r.Profile.LivePhotoUrl : r.Profile.PhotoUrl;
            byte[]? photo = null;
            if (!string.IsNullOrWhiteSpace(photoUrl))
            {
                try { photo = await fileStorage.ReadBytesAsync(photoUrl, ct); } catch { photo = null; }
            }
            doc.Rows.Add(new MebbisExportRow
            {
                Photo = photo,
                Cells =
                [
                    string.Empty, // fotoğraf sütunu (görsel ayrı gömülür)
                    r.Profile.StudentNumber.ToString(),
                    ResolveIdentity(r.Profile, r.TcNo),
                    first, last,
                    r.Profile.FatherName, r.Profile.MotherName, r.Profile.BirthPlace,
                    r.BirthDate, r.Profile.Gender, r.Profile.EducationLevel,
                    r.Profile.LicenseClass, r.Profile.IdentitySerialNo, r.Profile.Phone, r.Profile.BloodType,
                ],
            });
        }
        return doc;
    }

    private async Task<MebbisExportDocument> BuildDocumentApprovalAsync(Guid? groupId, string? groupLabel, CancellationToken ct)
    {
        var rows = await LoadBaseAsync(groupId, ct);
        var profileIds = rows.Select(x => x.Profile.Id).ToList();
        var docs = await dbContext.StudentDrivingDocuments.AsNoTracking()
            .Where(x => profileIds.Contains(x.StudentDrivingProfileId) && x.IsCurrent)
            .Select(x => new { x.StudentDrivingProfileId, x.DocumentType, x.Status })
            .ToListAsync(ct);
        var byProfile = docs.ToLookup(x => x.StudentDrivingProfileId);

        var types = new (StudentDocumentType Type, string Label)[]
        {
            (StudentDocumentType.Identity, "Kimlik"),
            (StudentDocumentType.Diploma, "Diploma"),
            (StudentDocumentType.HealthReport, "Sağlık Raporu"),
            (StudentDocumentType.BiometricPhoto, "Biyometrik Foto"),
            (StudentDocumentType.CriminalRecord, "Sabıka Kaydı"),
            (StudentDocumentType.BloodTypeCertificate, "Kan Grubu Belgesi"),
        };

        var doc = new MebbisExportDocument
        {
            Title = "MEBBİS Belge Onay Durumu",
            Subtitle = groupLabel is null ? "Tüm kursiyerler" : $"Grup: {groupLabel}",
            SheetName = "Belge Onay",
            Columns =
            [
                new() { Header = "Kursiyer No", Width = 12 },
                new() { Header = "TC Kimlik No", Width = 16 },
                new() { Header = "Ad Soyad", Width = 24 },
                .. types.Select(t => new MebbisExportColumn { Header = t.Label, Width = 14 }),
                new() { Header = "Genel Durum", Width = 14 },
            ],
        };

        foreach (var r in rows)
        {
            var profileDocs = byProfile[r.Profile.Id].ToList();
            var cells = new List<string> { r.Profile.StudentNumber.ToString(), ResolveIdentity(r.Profile, r.TcNo), r.FullName };
            var allApproved = true;
            foreach (var (type, _) in types)
            {
                var stored = profileDocs.Where(d => d.DocumentType == type)
                    .Select(d => (StudentDocumentStatus?)DrivingStudentRules.EffectiveStatus(d.Status)).FirstOrDefault();
                var satisfied = profileDocs.Any(d => d.DocumentType == type && DrivingStudentRules.CountsAsSatisfied(d.Status));
                if (!satisfied) allApproved = false;
                cells.Add(stored is null ? "Eksik" : DocumentStatusLabel(stored.Value));
            }
            cells.Add(allApproved ? "Tamam" : "Eksik var");
            doc.Rows.Add(new MebbisExportRow { Cells = cells });
        }
        return doc;
    }

    private async Task<MebbisExportDocument> BuildTermAssignmentAsync(Guid? groupId, string? groupLabel, CancellationToken ct)
    {
        var rows = await LoadBaseAsync(groupId, ct);
        var groupInfo = await dbContext.DrivingStudentGroups.AsNoTracking()
            .ToDictionaryAsync(x => x.Id, x => new { x.Name, x.TermYear, x.TermNumber, x.MebbisTermCode }, ct);

        var doc = new MebbisExportDocument
        {
            Title = "MEBBİS Dönem Atama",
            Subtitle = groupLabel is null ? "Tüm kursiyerler" : $"Grup: {groupLabel}",
            SheetName = "Donem Atama",
            Columns =
            [
                new() { Header = "Kursiyer No", Width = 12 },
                new() { Header = "TC Kimlik No", Width = 16 },
                new() { Header = "Ad Soyad", Width = 24 },
                new() { Header = "Sertifika Sınıfı", Width = 12 },
                new() { Header = "Grup", Width = 20 },
                new() { Header = "Resmî Dönem", Width = 14 },
                new() { Header = "MEBBİS Dönem Kodu", Width = 18 },
            ],
        };

        foreach (var r in rows)
        {
            var g = r.Profile.StudentGroupId is Guid gid && groupInfo.TryGetValue(gid, out var info) ? info : null;
            var term = g is not null && g.TermYear != 0 ? $"{g.TermYear}/{g.TermNumber}" : string.Empty;
            doc.Rows.Add(new MebbisExportRow
            {
                Cells =
                [
                    r.Profile.StudentNumber.ToString(), ResolveIdentity(r.Profile, r.TcNo), r.FullName,
                    r.Profile.LicenseClass, g?.Name ?? "— Atanmadı —", term, g?.MebbisTermCode ?? string.Empty,
                ],
            });
        }
        return doc;
    }

    private async Task<MebbisExportDocument> BuildExamResultAsync(Guid? groupId, string? groupLabel, CancellationToken ct)
    {
        var rows = await LoadBaseAsync(groupId, ct);
        var profileIds = rows.Select(x => x.Profile.Id).ToHashSet();
        var byProfile = rows.ToDictionary(x => x.Profile.Id);

        var candidates = await dbContext.DrivingExamCandidates.AsNoTracking()
            .Where(x => profileIds.Contains(x.StudentDrivingProfileId))
            .Join(dbContext.DrivingExamSessions.AsNoTracking(), c => c.ExamSessionId, s => s.Id,
                (c, s) => new { c.StudentDrivingProfileId, s.ExamType, s.Title, s.StartsAtUtc, c.AttemptNo, c.Status, c.Score, c.ResultEnteredAtUtc })
            .OrderBy(x => x.StartsAtUtc)
            .ToListAsync(ct);

        var doc = new MebbisExportDocument
        {
            Title = "MEBBİS Sınav Sonuçları",
            Subtitle = groupLabel is null ? "Tüm kursiyerler" : $"Grup: {groupLabel}",
            SheetName = "Sinav Sonuclari",
            Columns =
            [
                new() { Header = "Kursiyer No", Width = 12 },
                new() { Header = "TC Kimlik No", Width = 16 },
                new() { Header = "Ad Soyad", Width = 24 },
                new() { Header = "Sınav Türü", Width = 16 },
                new() { Header = "Oturum", Width = 18 },
                new() { Header = "Deneme", Width = 9 },
                new() { Header = "Sonuç", Width = 12 },
                new() { Header = "Puan", Width = 9 },
                new() { Header = "Sınav Tarihi", Width = 13 },
            ],
        };

        foreach (var c in candidates)
        {
            if (!byProfile.TryGetValue(c.StudentDrivingProfileId, out var b)) continue;
            doc.Rows.Add(new MebbisExportRow
            {
                Cells =
                [
                    b.Profile.StudentNumber.ToString(), ResolveIdentity(b.Profile, b.TcNo), b.FullName,
                    ExamTypeLabel(c.ExamType), c.Title, c.AttemptNo.ToString(),
                    ExamStatusLabel(c.Status), c.Score?.ToString("0.##") ?? string.Empty, Date(c.StartsAtUtc),
                ],
            });
        }
        return doc;
    }

    private async Task<MebbisExportDocument> BuildCertificateNumberAsync(Guid? groupId, string? groupLabel, CancellationToken ct)
    {
        var rows = await LoadBaseAsync(groupId, ct);
        var profileIds = rows.Select(x => x.Profile.Id).ToHashSet();
        var byProfile = rows.ToDictionary(x => x.Profile.Id);

        var certificates = await dbContext.DrivingCertificates.AsNoTracking()
            .Where(x => profileIds.Contains(x.StudentDrivingProfileId))
            .OrderBy(x => x.IssuedAtUtc)
            .Select(x => new { x.StudentDrivingProfileId, x.CertificateType, x.MebbisCertificateNo, x.IssuedAtUtc, x.DeliveryStatus })
            .ToListAsync(ct);

        var doc = new MebbisExportDocument
        {
            Title = "MEBBİS Sertifika Numaraları",
            Subtitle = groupLabel is null ? "Tüm kursiyerler" : $"Grup: {groupLabel}",
            SheetName = "Sertifika No",
            Columns =
            [
                new() { Header = "Kursiyer No", Width = 12 },
                new() { Header = "TC Kimlik No", Width = 16 },
                new() { Header = "Ad Soyad", Width = 24 },
                new() { Header = "Sertifika Türü", Width = 16 },
                new() { Header = "MEBBİS Sertifika No", Width = 20 },
                new() { Header = "Düzenlenme Tarihi", Width = 15 },
                new() { Header = "Teslim Durumu", Width = 14 },
            ],
        };

        foreach (var c in certificates)
        {
            if (!byProfile.TryGetValue(c.StudentDrivingProfileId, out var b)) continue;
            doc.Rows.Add(new MebbisExportRow
            {
                Cells =
                [
                    b.Profile.StudentNumber.ToString(), ResolveIdentity(b.Profile, b.TcNo), b.FullName,
                    CertificateTypeLabel(c.CertificateType),
                    string.IsNullOrWhiteSpace(c.MebbisCertificateNo) ? "—" : c.MebbisCertificateNo,
                    Date(c.IssuedAtUtc), DeliveryStatusLabel(c.DeliveryStatus),
                ],
            });
        }
        return doc;
    }

    // ─── Etiketler ─────────────────────────────────────────────────────────────

    private static string DocumentStatusLabel(StudentDocumentStatus status) => status switch
    {
        StudentDocumentStatus.Missing => "Eksik",
        StudentDocumentStatus.PendingApproval => "Onay bekliyor",
        StudentDocumentStatus.Approved => "Onaylı",
        StudentDocumentStatus.Rejected => "Reddedildi",
        StudentDocumentStatus.Expired => "Süresi doldu",
        StudentDocumentStatus.ReuploadRequested => "Yeniden yükle",
        _ => status.ToString(),
    };

    private static string ExamTypeLabel(DrivingExamType type) => type switch
    {
        DrivingExamType.TheoryEExam => "Teorik (e-Sınav)",
        DrivingExamType.DrivingPractice => "Direksiyon",
        _ => type.ToString(),
    };

    private static string ExamStatusLabel(DrivingExamCandidateStatus status) => status switch
    {
        DrivingExamCandidateStatus.Planned => "Planlandı",
        DrivingExamCandidateStatus.Passed => "Geçti",
        DrivingExamCandidateStatus.Failed => "Kaldı",
        DrivingExamCandidateStatus.Cancelled => "İptal",
        _ => status.ToString(),
    };

    private static string CertificateTypeLabel(DrivingCertificateType type) => type switch
    {
        DrivingCertificateType.Achievement => "Başarı Belgesi",
        DrivingCertificateType.Completion => "Katılım/Sertifika",
        _ => type.ToString(),
    };

    private static string DeliveryStatusLabel(DrivingCertificateDeliveryStatus status) => status switch
    {
        DrivingCertificateDeliveryStatus.NotDelivered => "Teslim edilmedi",
        DrivingCertificateDeliveryStatus.Ready => "Hazır",
        DrivingCertificateDeliveryStatus.Delivered => "Teslim edildi",
        DrivingCertificateDeliveryStatus.Returned => "İade",
        _ => status.ToString(),
    };

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
