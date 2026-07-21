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
    IDrivingReportPdfService pdf,
    IDrivingContractFormPdfService contractForms,
    IIdentityVerificationService identityVerification,
    IAuditLogService auditLogService,
    IFileStorageService files) : ControllerBase
{
    private const string AuditCategory = "DrivingSchool";
    private const long MaxStudentDocumentBytes = 20L * 1024 * 1024;

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

        // Aynı telefon numarasıyla da ikinci kayıt açılamaz.
        var phone = NormalizePhone(request.Phone);
        if (phone.Length >= 10)
        {
            var phoneOwner = await FindDuplicateByPhoneAsync(phone, ct);
            if (phoneOwner is not null)
                return Conflict(new { message = $"Bu telefon numarasıyla kayıtlı bir kursiyer var: {phoneOwner}." });
        }

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

        // Kursiyer numarası kurum içinde otomatik ve artan verilir (Serializable izolasyon
        // yarış durumunu engeller).
        var nextStudentNumber = (await dbContext.StudentDrivingProfiles.MaxAsync(x => (int?)x.StudentNumber, ct) ?? 0) + 1;

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
            StudentNumber = nextStudentNumber,
            LicenseClass = package.LicenseClass,
            TransmissionType = package.TransmissionType,
            PurchasedDrivingMinutes = package.DrivingLessonMinutes,
            // Dosya eksik başlar: evraklar onaylanınca yönetici Active'e taşır.
            Status = DrivingStudentStatus.DocumentsPending,
            IdentityKind = request.IdentityKind,
            IdentityNumber = identityNumber,
            IdentitySerialNo = request.IdentitySerialNo?.Trim() ?? string.Empty,
            Phone = phone,
            FatherName = request.FatherName?.Trim() ?? string.Empty,
            MotherName = request.MotherName?.Trim() ?? string.Empty,
            BirthPlace = request.BirthPlace?.Trim() ?? string.Empty,
            Nationality = request.Nationality?.Trim() ?? string.Empty,
            Gender = request.Gender?.Trim() ?? string.Empty,
            BloodType = request.BloodType?.Trim() ?? string.Empty,
            Occupation = request.Occupation?.Trim() ?? string.Empty,
            EducationLevel = request.EducationLevel?.Trim() ?? string.Empty,
            City = request.City?.Trim() ?? string.Empty,
            District = request.District?.Trim() ?? string.Empty,
            ResidenceAddress = request.ResidenceAddress?.Trim() ?? string.Empty,
            RegistrationCity = request.RegistrationCity?.Trim() ?? string.Empty,
            RegistrationDistrict = request.RegistrationDistrict?.Trim() ?? string.Empty,
            RegistrationNeighborhood = request.RegistrationNeighborhood?.Trim() ?? string.Empty,
            RegistrationStreet = request.RegistrationStreet?.Trim() ?? string.Empty,
            RegistrationVolumeNo = request.RegistrationVolumeNo?.Trim() ?? string.Empty,
            RegistrationFamilyOrderNo = request.RegistrationFamilyOrderNo?.Trim() ?? string.Empty,
            RegistrationOrderNo = request.RegistrationOrderNo?.Trim() ?? string.Empty,
            IdentityIssueDate = request.IdentityIssueDate,
            IdentityIssuePlace = request.IdentityIssuePlace?.Trim() ?? string.Empty,
            WhatsAppPhone = request.WhatsAppPhone?.Trim() ?? string.Empty,
            EmergencyContactName = request.EmergencyContactName?.Trim() ?? string.Empty,
            EmergencyContactPhone = request.EmergencyContactPhone?.Trim() ?? string.Empty,
            PhotoUrl = request.PhotoUrl?.Trim() ?? string.Empty,
            LivePhotoUrl = request.LivePhotoUrl?.Trim() ?? string.Empty,
            HasExistingLicense = request.HasExistingLicense,
            ExistingLicenseNumber = request.HasExistingLicense ? request.ExistingLicenseNumber?.Trim() ?? string.Empty : string.Empty,
            ExistingLicenseClasses = request.HasExistingLicense ? request.ExistingLicenseClasses?.Trim() ?? string.Empty : string.Empty,
            LicenseIssueDate = request.HasExistingLicense ? request.LicenseIssueDate : null,
            LicenseExpiryDate = request.HasExistingLicense ? request.LicenseExpiryDate : null,
            LicenseIssuePlace = request.HasExistingLicense ? request.LicenseIssuePlace?.Trim() ?? string.Empty : string.Empty,
            TheoryExamFee = Math.Max(0, request.TheoryExamFee),
            DrivingExamFee = Math.Max(0, request.DrivingExamFee),
            TheoryExamFeePaid = request.TheoryExamFeePaid,
            DrivingExamFeePaid = request.DrivingExamFeePaid,
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
            var storedFile = IsSafeStudentDocumentUrl(document.FileUrl) ? await files.ReadPrefixAsync(document.FileUrl, 32, ct) : null;
            if (storedFile is null || storedFile.Length > MaxStudentDocumentBytes || !IsAllowedStudentDocumentContent(document.FileName, storedFile.Bytes))
                return BadRequest(new { message = "Belge dosyası güvenli öğrenci evrak alanından seçilmelidir." });
            dbContext.StudentDrivingDocuments.Add(new StudentDrivingDocument
            {
                StudentDrivingProfileId = profile.Id,
                DocumentType = documentType,
                Status = StudentDocumentStatus.PendingApproval,
                FileUrl = document.FileUrl.Trim(),
                FileName = document.FileName?.Trim() ?? string.Empty,
                DocumentNumber = document.DocumentNumber?.Trim() ?? string.Empty,
                IssuedBy = document.IssuedBy?.Trim() ?? string.Empty,
                IssuedAtUtc = document.IssuedAtUtc,
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
                    DownPaymentMethod: finance.DownPaymentMethod,
                    DownPaymentPaid: finance.DownPaymentPaid),
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
            studentNumber = profile.StudentNumber,
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

    /// <summary>
    /// NVİ kimlik doğrulaması: TC + ad soyad + doğum yılı devlet kaydıyla eşleşiyor mu?
    /// Yanlış yazılmış ad/TC daha kayıt anında yakalanır — MEBBİS'te ret yaşanmaz.
    /// Servise ulaşılamazsa <c>verified=null</c> döner; kayıt engellenmez.
    /// </summary>
    [HttpPost("students/verify-identity")]
    [RequireDrivingPermission(DrivingPermissions.StudentCreate)]
    public async Task<IActionResult> VerifyIdentity([FromBody] VerifyIdentityRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();

        var identity = (request.IdentityNumber ?? string.Empty).Trim();
        if (!DrivingStudentRules.IsValidTurkishId(identity))
            return Ok(new { verified = false, message = "TC kimlik numarası kontrol basamağı geçersiz." });

        var fullName = (request.FullName ?? string.Empty).Trim();
        var lastSpace = fullName.LastIndexOf(' ');
        if (lastSpace <= 0) return Ok(new { verified = (bool?)null, message = "Ad ve soyad birlikte girilmelidir." });
        var firstName = fullName[..lastSpace];
        var lastName = fullName[(lastSpace + 1)..];

        if (!DateTime.TryParse(request.BirthDate, out var birth))
            return Ok(new { verified = (bool?)null, message = "Doğum tarihi girilmeden doğrulama yapılamaz." });

        var verified = await identityVerification.VerifyTurkishIdAsync(identity, firstName, lastName, birth.Year, ct);
        return Ok(new
        {
            verified,
            message = verified switch
            {
                true => "NVİ kaydıyla doğrulandı.",
                false => "NVİ kaydıyla eşleşmedi — ad, soyad, TC veya doğum yılını kontrol edin.",
                null => "NVİ servisine şu an ulaşılamıyor; kayıt doğrulamasız sürdürülebilir.",
            },
        });
    }

    /// <summary>Telefon numarası kurumda zaten kayıtlı mı? (sihirbaz iletişim adımında).</summary>
    [HttpGet("students/check-phone")]
    [RequireDrivingPermission(DrivingPermissions.StudentCreate)]
    public async Task<IActionResult> CheckPhone([FromQuery] string phone, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var normalized = NormalizePhone(phone);
        if (normalized.Length < 10) return Ok(new { available = true, existingStudentName = (string?)null });
        var owner = await FindDuplicateByPhoneAsync(normalized, ct);
        return Ok(new { available = owner is null, existingStudentName = owner });
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
        return Ok(await BuildDocumentFileAsync(profile, includeInternalReview: true, ct));
    }

    [HttpGet("student-documents/review-queue")]
    [RequireDrivingPermission(DrivingPermissions.StudentDocumentView)]
    public async Task<IActionResult> StudentDocumentReviewQueue(
        [FromQuery] string? status, [FromQuery] string? documentType, [FromQuery] string? search,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (page < 1 || pageSize is < 1 or > 100) return BadRequest(new { message = "Sayfalama değerleri geçersiz." });
        if ((search?.Length ?? 0) > 100) return BadRequest(new { message = "Arama en fazla 100 karakter olabilir." });
        StudentDocumentStatus? parsedStatus = null;
        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("ActionRequired", StringComparison.OrdinalIgnoreCase))
        {
            if (!Enum.TryParse<StudentDocumentStatus>(status, true, out var value) || !Enum.IsDefined(value))
                return BadRequest(new { message = "Belge durumu geçersiz." });
            parsedStatus = value;
        }
        StudentDocumentType? parsedType = null;
        if (!string.IsNullOrWhiteSpace(documentType))
        {
            if (!Enum.TryParse<StudentDocumentType>(documentType, true, out var value) || !Enum.IsDefined(value))
                return BadRequest(new { message = "Belge türü geçersiz." });
            parsedType = value;
        }

        var now = DateTime.UtcNow;
        var relevantTypes = new[] { StudentDocumentType.HealthReport, StudentDocumentType.Diploma, StudentDocumentType.CriminalRecord,
            StudentDocumentType.BiometricPhoto, StudentDocumentType.Identity, StudentDocumentType.ExistingLicense, StudentDocumentType.ForeignStudentDocument };
        var query = dbContext.StudentDrivingDocuments.AsNoTracking()
            .Where(x => x.IsCurrent && relevantTypes.Contains(x.DocumentType))
            .Join(dbContext.StudentDrivingProfiles.AsNoTracking(), d => d.StudentDrivingProfileId, p => p.Id, (d, p) => new { d, p })
            .Join(dbContext.Students.AsNoTracking(), x => x.p.StudentId, s => s.Id, (x, s) => new { x.d, x.p, s });
        if (parsedType.HasValue) query = query.Where(x => x.d.DocumentType == parsedType.Value);
        if (parsedStatus == StudentDocumentStatus.Expired) query = query.Where(x => x.d.ExpiresAtUtc <= now);
        else if (parsedStatus.HasValue) query = query.Where(x => x.d.Status == parsedStatus.Value && (x.d.ExpiresAtUtc == null || x.d.ExpiresAtUtc > now));
        else query = query.Where(x => x.d.Status == StudentDocumentStatus.PendingApproval || x.d.Status == StudentDocumentStatus.ReuploadRequested
            || x.d.Status == StudentDocumentStatus.Rejected || x.d.ExpiresAtUtc <= now);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            var isNumber = int.TryParse(term, out var studentNumber);
            query = query.Where(x => EF.Functions.ILike(x.s.FullName, $"%{term}%") || (isNumber && x.p.StudentNumber == studentNumber));
        }

        var total = await query.CountAsync(ct);
        var rows = await query.OrderBy(x => x.d.Status == StudentDocumentStatus.PendingApproval ? 0 : x.d.Status == StudentDocumentStatus.ReuploadRequested ? 1 : 2)
            .ThenBy(x => x.d.UploadedAtUtc).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new
            {
                x.d.Id, x.d.StudentDrivingProfileId, studentName = x.s.FullName, x.p.StudentNumber,
                identityKind = x.p.IdentityKind.ToString(), documentType = x.d.DocumentType.ToString(), label = DrivingStudentRules.DocumentLabel(x.d.DocumentType),
                storedStatus = x.d.Status, x.d.FileName, x.d.DocumentNumber, x.d.IssuedBy, x.d.IssuedAtUtc,
                x.d.ExpiresAtUtc, x.d.UploadedAtUtc, x.d.ReviewedAtUtc, x.d.RejectionReason, x.d.ReviewNote, x.d.ReviewVersion,
            }).ToListAsync(ct);
        var items = rows.Select(x => new
        {
            x.Id, x.StudentDrivingProfileId, x.studentName, x.StudentNumber, x.identityKind, x.documentType, x.label,
            status = DrivingStudentRules.EffectiveStatus(x.storedStatus, x.ExpiresAtUtc, now).ToString(),
            x.FileName, x.DocumentNumber, x.IssuedBy, x.IssuedAtUtc, x.ExpiresAtUtc, x.UploadedAtUtc,
            x.ReviewedAtUtc, x.RejectionReason, x.ReviewNote, x.ReviewVersion,
            fileUrl = $"/api/driving-school/student-documents/{x.Id}/file",
        }).ToList();
        var allCurrent = dbContext.StudentDrivingDocuments.AsNoTracking().Where(x => x.IsCurrent && relevantTypes.Contains(x.DocumentType));
        return Ok(new
        {
            generatedAtUtc = now, page, pageSize, total, items,
            summary = new
            {
                pending = await allCurrent.CountAsync(x => x.Status == StudentDocumentStatus.PendingApproval, ct),
                reuploadRequested = await allCurrent.CountAsync(x => x.Status == StudentDocumentStatus.ReuploadRequested, ct),
                rejected = await allCurrent.CountAsync(x => x.Status == StudentDocumentStatus.Rejected, ct),
                expiringSoon = await allCurrent.CountAsync(x => x.Status == StudentDocumentStatus.Approved && x.ExpiresAtUtc > now && x.ExpiresAtUtc <= now.AddDays(30), ct),
                expired = await allCurrent.CountAsync(x => x.ExpiresAtUtc <= now, ct),
            },
            documentTypes = relevantTypes.Select(x => new { value = x.ToString(), label = DrivingStudentRules.DocumentLabel(x) }),
        });
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

        var document = await dbContext.StudentDrivingDocuments.SingleOrDefaultAsync(x => x.Id == id
            && dbContext.StudentDrivingProfiles.Any(p => p.Id == x.StudentDrivingProfileId), ct);
        if (document is null) return NotFound(new { message = "Belge bulunamadı." });
        if (!document.IsCurrent) return Conflict(new { message = "Bu belge geçmiş bir sürüm; güncel sürümü inceleyin." });

        if (document.ReviewVersion != request.ExpectedVersion)
            return Conflict(new { message = "Belge başka bir personel tarafından güncellendi. Kuyruğu yenileyin." });
        var action = string.IsNullOrWhiteSpace(request.Action) ? request.Approved == true ? "Approve" : "Reject" : request.Action.Trim();
        if (action is not ("Approve" or "Reject" or "RequestReupload" or "UpdateDetails"))
            return BadRequest(new { message = "Belge inceleme işlemi geçersiz." });
        var reason = request.RejectionReason?.Trim() ?? string.Empty;
        var note = request.Note?.Trim() ?? string.Empty;
        if (action is "Reject" or "RequestReupload" && (reason.Length is < 5 or > 500))
            return BadRequest(new { message = "Ret/yeniden yükleme gerekçesi 5-500 karakter olmalıdır." });
        if (note.Length > 1000) return BadRequest(new { message = "Personel notu en fazla 1000 karakter olabilir." });
        if (request.ExpiresAtUtc is { } requestedExpiry && (requestedExpiry <= DateTime.UtcNow || requestedExpiry > DateTime.UtcNow.AddYears(20)))
            return BadRequest(new { message = "Son geçerlilik tarihi gelecekte ve makul bir aralıkta olmalıdır." });
        if (request.ExpiresAtUtc.HasValue) document.ExpiresAtUtc = request.ExpiresAtUtc;
        if (action == "Approve" && DrivingStudentRules.ExpiringDocuments.Contains(document.DocumentType) && document.ExpiresAtUtc is null)
            return BadRequest(new { message = "Süreli belge, son geçerlilik tarihi olmadan onaylanamaz." });
        if (action == "Approve" && document.ExpiresAtUtc is { } expires && expires <= DateTime.UtcNow)
            return BadRequest(new { message = "Süresi dolmuş belge onaylanamaz." });

        var before = document.Status;
        document.Status = action switch
        {
            "Approve" => StudentDocumentStatus.Approved,
            "Reject" => StudentDocumentStatus.Rejected,
            "RequestReupload" => StudentDocumentStatus.ReuploadRequested,
            _ => document.Status,
        };
        document.RejectionReason = action is "Reject" or "RequestReupload" ? reason : action == "Approve" ? string.Empty : document.RejectionReason;
        document.ReviewNote = note;
        document.ReuploadRequestedAtUtc = action == "RequestReupload" ? DateTime.UtcNow : action == "Approve" ? null : document.ReuploadRequestedAtUtc;
        document.ReviewedByUserId = actorId;
        document.ReviewedAtUtc = DateTime.UtcNow;
        document.ReviewVersion++;
        var documentTitle = action switch
        {
            "Approve" => $"{DocumentLabel(document.DocumentType)} onaylandı",
            "Reject" => $"{DocumentLabel(document.DocumentType)} reddedildi",
            "RequestReupload" => $"{DocumentLabel(document.DocumentType)} için yeniden yükleme istendi",
            _ => $"{DocumentLabel(document.DocumentType)} bilgileri güncellendi",
        };
        dbContext.AddMebbisHistory(document.StudentDrivingProfileId, DrivingMebbisHistoryEventType.DocumentReview,
            documentTitle, action is "Reject" or "RequestReupload" ? reason : "Evrak kontrol kuyruğunda incelendi.",
            document.Status.ToString(), nameof(StudentDrivingDocument), document.Id, actorId, CurrentUserName(),
            action == "Approve" ? DrivingMebbisHistorySeverity.Success : action == "UpdateDetails" ? DrivingMebbisHistorySeverity.Info : DrivingMebbisHistorySeverity.Warning,
            document.ReviewedAtUtc);
        await dbContext.SaveChangesAsync(ct);

        await auditLogService.LogChangeAsync(
            action == "Approve" ? "Öğrenci evrakı onaylandı" : action == "Reject" ? "Öğrenci evrakı reddedildi" : action == "RequestReupload" ? "Öğrenci evrakı yeniden yüklemeye gönderildi" : "Öğrenci evrakı bilgileri güncellendi",
            AuditCategory, "StudentDrivingDocument", document.Id.ToString(),
            $"{DocumentLabel(document.DocumentType)} — {action}{(reason.Length == 0 ? string.Empty : $" — gerekçe: {reason}")}",
            new { status = before.ToString(), request.ExpectedVersion },
            new { status = document.Status.ToString(), document.RejectionReason, document.ReviewNote, document.ExpiresAtUtc, document.ReviewVersion },
            ct);

        if (action != "UpdateDetails")
            await notifier.NotifyStudentAsync(document.StudentDrivingProfileId,
                action == "Approve" ? "Belgeniz onaylandı" : action == "Reject" ? "Belgeniz reddedildi" : "Belgenizi yeniden yüklemeniz gerekiyor",
                action == "Approve" ? $"{DocumentLabel(document.DocumentType)} onaylandı."
                    : $"{DocumentLabel(document.DocumentType)} için yeni belge istendi. Neden: {reason} Mobil uygulamadaki Evraklarım ekranından yeniden yükleyin.",
                DrivingNotificationCategories.Document,
                dedupeKey: $"document-review:{document.Id}:{document.Status}:{document.ReviewVersion}",
                relatedEntityType: "StudentDrivingDocument", relatedEntityId: document.Id.ToString(), cancellationToken: ct);

        return Ok(new { document.Id, status = document.Status.ToString(), document.RejectionReason, document.ReviewNote, document.ExpiresAtUtc, document.ReviewedAtUtc, document.ReviewVersion });
    }

    [HttpGet("student-documents/{id:guid}/file")]
    public async Task<IActionResult> DownloadStudentDocument(Guid id, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var document = await dbContext.StudentDrivingDocuments.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id
            && dbContext.StudentDrivingProfiles.Any(p => p.Id == x.StudentDrivingProfileId), ct);
        if (document is null) return NotFound(new { message = "Belge bulunamadı." });
        var isStudent = User.IsInRole("Student");
        if (isStudent)
        {
            var ownProfile = await CurrentStudentProfileAsync(ct);
            if (ownProfile?.Id != document.StudentDrivingProfileId) return Forbid();
        }
        else if (!await permissionService.HasAsync(User, DrivingPermissions.StudentDocumentView, ct)) return Forbid();
        var prefix = await files.ReadPrefixAsync(document.FileUrl, 32, ct);
        if (prefix is null || prefix.Length > MaxStudentDocumentBytes || !IsAllowedStudentDocumentContent(document.FileName, prefix.Bytes))
            return BadRequest(new { message = "Belge dosyası güvenli boyut veya içerik kurallarını karşılamıyor." });
        var bytes = await files.ReadBytesAsync(document.FileUrl, ct);
        if (bytes is null) return NotFound(new { message = "Belge dosyası güvenli depoda bulunamadı." });
        Response.Headers.CacheControl = "no-store, private";
        Response.Headers.XContentTypeOptions = "nosniff";
        var extension = Path.GetExtension(document.FileName).ToLowerInvariant();
        var contentType = extension == ".pdf" ? "application/pdf" : extension is ".jpg" or ".jpeg" ? "image/jpeg" : extension == ".png" ? "image/png" : "application/octet-stream";
        return File(bytes, contentType, string.IsNullOrWhiteSpace(document.FileName) ? $"belge-{document.Id:N}" : Path.GetFileName(document.FileName));
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
        return Ok(await BuildDocumentFileAsync(profile, includeInternalReview: false, ct));
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

        var documents = await BuildDocumentFileAsync(profile, includeInternalReview: true, ct);

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
            // Şubeler-arası tahsilat görünsün: bir taksit başka şubeden ödenmiş olabilir,
            // şube query filtresini yok say (tenant elle uygulanır).
            var rawPayments = await dbContext.FinancePayments.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.EnrollmentContractId == contractId && x.TenantId == dbContext.CurrentTenantId)
                .OrderByDescending(x => x.PaidAtUtc)
                .Select(x => new { x.Id, x.Amount, x.Method, x.ReceiptNo, x.Note, x.PaidAtUtc, x.BranchId, x.CreatedByUserId })
                .ToListAsync(ct);

            // Şube ve tahsil eden adlarını çöz (kim, nereden tahsil etti).
            var branchIds = rawPayments.Where(x => x.BranchId != null).Select(x => x.BranchId!.Value).Distinct().ToList();
            var collectorIds = rawPayments.Where(x => x.CreatedByUserId != null).Select(x => x.CreatedByUserId!.Value).Distinct().ToList();
            var branchNames = await dbContext.OrgUnits.AsNoTracking().Where(x => branchIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Name, ct);
            var collectorNames = await dbContext.Users.IgnoreQueryFilters().AsNoTracking().Where(x => collectorIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.FullName, ct);

            var payments = rawPayments.Select(x => new
            {
                x.Id, x.Amount, x.Method, x.ReceiptNo, x.Note, x.PaidAtUtc,
                branchId = x.BranchId,
                branchName = x.BranchId is Guid b && branchNames.TryGetValue(b, out var bn) ? bn : null,
                collectedByName = x.CreatedByUserId is Guid c && collectorNames.TryGetValue(c, out var cn) ? cn : null,
            }).ToList();
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

        // Kayıt provenance: hangi şubeden, kim kaydetti (finansta "kim, nereden" için).
        var registrationBranchName = row.student.BranchId is Guid regBranchId
            ? await dbContext.OrgUnits.AsNoTracking().Where(x => x.Id == regBranchId).Select(x => x.Name).FirstOrDefaultAsync(ct)
            : null;
        var registrarName = profile.RegisteredByUserId is Guid registrarId
            ? await dbContext.Users.IgnoreQueryFilters().AsNoTracking().Where(x => x.Id == registrarId).Select(x => x.FullName).FirstOrDefaultAsync(ct)
            : null;

        var mebbisMissing = await BuildMebbisMissingAsync(profile, row.student.TcNo, row.student.BirthDate, ct);

        // Sınav hak sayacı: her türde en fazla 4 hak; iptal edilen deneme hak yakmaz.
        var attemptTypes = await dbContext.DrivingExamCandidates.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId && x.Status != DrivingExamCandidateStatus.Cancelled)
            .Join(dbContext.DrivingExamSessions.AsNoTracking(), c => c.ExamSessionId, s => s.Id, (_, s) => s.ExamType)
            .ToListAsync(ct);
        object ExamRight(DrivingExamType type)
        {
            var used = attemptTypes.Count(x => x == type);
            return new
            {
                used,
                max = DrivingExamRules.MaxAttempts,
                remaining = DrivingExamRules.RemainingAttempts(used),
                outOfAttempts = DrivingExamRules.IsOutOfAttempts(used),
            };
        }
        var examRights = new { theory = ExamRight(DrivingExamType.TheoryEExam), practice = ExamRight(DrivingExamType.DrivingPractice) };

        return Ok(new
        {
            mebbisMissing,
            examRights,
            overview = new
            {
                profile.Id,
                profile.StudentNumber,
                row.student.FullName,
                row.student.TcNo,
                registrationBranchName,
                registrarName,
                identityKind = profile.IdentityKind.ToString(),
                profile.IdentityNumber,
                profile.IdentitySerialNo,
                studentPhone = profile.Phone,
                profile.FatherName,
                profile.MotherName,
                profile.BirthPlace,
                row.student.BirthDate,
                profile.Gender,
                profile.BloodType,
                profile.Occupation,
                profile.EducationLevel,
                profile.City,
                profile.District,
                profile.ResidenceAddress,
                // Nüfus kayıt bloğu — matbu müracaat formunu doldurmak için.
                profile.RegistrationCity,
                profile.RegistrationDistrict,
                profile.RegistrationNeighborhood,
                profile.RegistrationStreet,
                profile.RegistrationVolumeNo,
                profile.RegistrationFamilyOrderNo,
                profile.RegistrationOrderNo,
                profile.IdentityIssueDate,
                profile.IdentityIssuePlace,
                phone = row.student.ParentPhone,
                email = row.student.ParentEmail,
                profile.WhatsAppPhone,
                profile.EmergencyContactName,
                profile.EmergencyContactPhone,
                profile.PhotoUrl,
                profile.LivePhotoUrl,
                profile.HasExistingLicense,
                profile.ExistingLicenseNumber,
                profile.ExistingLicenseClasses,
                profile.LicenseIssueDate,
                profile.LicenseExpiryDate,
                profile.LicenseIssuePlace,
                targetLicenseClass = profile.LicenseClass,
                profile.TheoryExamFee,
                profile.DrivingExamFee,
                profile.TheoryExamFeePaid,
                profile.DrivingExamFeePaid,
                profile.DrivingExamDate,
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

    /// <summary>
    /// Kursiyerin nüfus kayıt bilgilerini günceller. Bu blok yalnızca matbu EK-1
    /// müracaat formunda kullanılır ve nüfus cüzdanından elle okunur; kayıt
    /// sırasında atlanmış olabileceği için sonradan da doldurulabilmelidir.
    /// </summary>
    [HttpPut("students/{profileId:guid}/registration-identity")]
    [RequireDrivingPermission(DrivingPermissions.StudentUpdate)]
    public async Task<IActionResult> UpdateRegistrationIdentity(
        Guid profileId, [FromBody] UpdateDrivingRegistrationIdentityRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var profile = await dbContext.StudentDrivingProfiles.SingleOrDefaultAsync(x => x.Id == profileId, ct);
        if (profile is null) return NotFound(new { message = "Kursiyer bulunamadı." });

        var before = RegistrationIdentitySnapshot(profile);
        profile.RegistrationCity = Trim(request.RegistrationCity, 60);
        profile.RegistrationDistrict = Trim(request.RegistrationDistrict, 60);
        profile.RegistrationNeighborhood = Trim(request.RegistrationNeighborhood, 120);
        profile.RegistrationStreet = Trim(request.RegistrationStreet, 120);
        profile.RegistrationVolumeNo = Trim(request.RegistrationVolumeNo, 30);
        profile.RegistrationFamilyOrderNo = Trim(request.RegistrationFamilyOrderNo, 30);
        profile.RegistrationOrderNo = Trim(request.RegistrationOrderNo, 30);
        profile.IdentityIssueDate = request.IdentityIssueDate;
        profile.IdentityIssuePlace = Trim(request.IdentityIssuePlace, 120);
        // Doğum yeri ve baba/ana adı da aynı formda; kayıtta boş kalmışsa buradan tamamlanır.
        profile.BirthPlace = Trim(request.BirthPlace, 100);
        profile.FatherName = Trim(request.FatherName, 100);
        profile.MotherName = Trim(request.MotherName, 100);

        await dbContext.SaveChangesAsync(ct);
        await auditLogService.LogChangeAsync("Kursiyer nüfus bilgileri güncellendi", AuditCategory,
            "StudentDrivingProfile", profile.Id.ToString(),
            $"Kursiyer #{profile.StudentNumber} nüfus kayıt bilgileri düzenlendi.",
            before, RegistrationIdentitySnapshot(profile), ct);
        return Ok(RegistrationIdentitySnapshot(profile));
    }

    private static object RegistrationIdentitySnapshot(StudentDrivingProfile p) => new
    {
        p.RegistrationCity, p.RegistrationDistrict, p.RegistrationNeighborhood, p.RegistrationStreet,
        p.RegistrationVolumeNo, p.RegistrationFamilyOrderNo, p.RegistrationOrderNo,
        p.IdentityIssueDate, p.IdentityIssuePlace, p.BirthPlace, p.FatherName, p.MotherName,
    };

    /// <summary>
    /// Sınav ücretlerini ve "ödendi" bilgisini günceller — kayıt sonrasında da
    /// (direksiyon sınav harcı ödendiğinde) elle işaretlenebilir.
    /// </summary>
    [HttpPut("students/{profileId:guid}/exam-fees")]
    [RequireDrivingPermission(DrivingPermissions.FinanceCollect)]
    public async Task<IActionResult> UpdateExamFees(Guid profileId, [FromBody] UpdateDrivingExamFeesRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var profile = await dbContext.StudentDrivingProfiles.SingleOrDefaultAsync(x => x.Id == profileId, ct);
        if (profile is null) return NotFound(new { message = "Kursiyer bulunamadı." });
        if (request.TheoryExamFee < 0 || request.DrivingExamFee < 0) return BadRequest(new { message = "Ücret negatif olamaz." });
        if (request.TheoryExamFee > 1_000_000 || request.DrivingExamFee > 1_000_000) return BadRequest(new { message = "Ücret makul aralıkta olmalıdır." });

        if (request.DrivingExamDate is { } examDate && (examDate < DateTime.UtcNow.AddYears(-5) || examDate > DateTime.UtcNow.AddYears(5)))
            return BadRequest(new { message = "Direksiyon sınav tarihi makul bir aralıkta olmalıdır." });

        var before = new { profile.TheoryExamFee, profile.DrivingExamFee, profile.TheoryExamFeePaid, profile.DrivingExamFeePaid, profile.DrivingExamDate };
        profile.TheoryExamFee = request.TheoryExamFee;
        profile.DrivingExamFee = request.DrivingExamFee;
        profile.TheoryExamFeePaid = request.TheoryExamFeePaid;
        profile.DrivingExamFeePaid = request.DrivingExamFeePaid;
        profile.DrivingExamDate = request.DrivingExamDate;
        await dbContext.SaveChangesAsync(ct);

        await auditLogService.LogChangeAsync("Sınav ücretleri güncellendi", AuditCategory, "StudentDrivingProfile", profile.Id.ToString(),
            $"Teorik: {profile.TheoryExamFee:N2}₺ ({(profile.TheoryExamFeePaid ? "ödendi" : "ödenmedi")}), "
                + $"Direksiyon: {profile.DrivingExamFee:N2}₺ ({(profile.DrivingExamFeePaid ? "ödendi" : "ödenmedi")})"
                + (profile.DrivingExamDate is { } d ? $", sınav: {d:dd.MM.yyyy}" : string.Empty) + ".",
            before,
            new { profile.TheoryExamFee, profile.DrivingExamFee, profile.TheoryExamFeePaid, profile.DrivingExamFeePaid, profile.DrivingExamDate },
            ct);

        return Ok(new { profile.TheoryExamFee, profile.DrivingExamFee, profile.TheoryExamFeePaid, profile.DrivingExamFeePaid, profile.DrivingExamDate });
    }

    /// <summary>
    /// MEBBİS giriş asistanı işareti: aday MEBBİS'e işlendi/işlenmedi. Dönem
    /// paneli "girilen X/Y" sayacını buradan okur.
    /// </summary>
    [HttpPut("students/{profileId:guid}/mebbis-entered")]
    [RequireDrivingPermission(DrivingPermissions.StudentUpdate)]
    public async Task<IActionResult> SetMebbisEntered(Guid profileId, [FromBody] SetMebbisEnteredRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var profile = await dbContext.StudentDrivingProfiles.SingleOrDefaultAsync(x => x.Id == profileId, ct);
        if (profile is null) return NotFound(new { message = "Kursiyer bulunamadı." });

        profile.MebbisEnteredAtUtc = request.Entered ? DateTime.UtcNow : null;
        dbContext.AddMebbisHistory(profile.Id,
            request.Entered ? DrivingMebbisHistoryEventType.CandidateEntry : DrivingMebbisHistoryEventType.Correction,
            request.Entered ? "Aday kaydı MEBBİS’e girildi" : "MEBBİS giriş işareti kaldırıldı",
            request.Entered ? "Aday kaydı kurum personeli tarafından işlendi." : "MEBBİS giriş durumu geri alındı.",
            request.Entered ? "Entered" : "Removed", nameof(StudentDrivingProfile), profile.Id, CurrentUserId(), CurrentUserName(),
            request.Entered ? DrivingMebbisHistorySeverity.Success : DrivingMebbisHistorySeverity.Warning);
        await dbContext.SaveChangesAsync(ct);
        await auditLogService.LogChangeAsync(
            request.Entered ? "Aday MEBBİS'e işlendi" : "MEBBİS giriş işareti kaldırıldı",
            AuditCategory, "StudentDrivingProfile", profile.Id.ToString(),
            $"Kursiyer #{profile.StudentNumber}.", null, new { profile.MebbisEnteredAtUtc }, ct);
        return Ok(new { profile.Id, profile.MebbisEnteredAtUtc });
    }

    /// <summary>
    /// Resmî kursiyer formları (PDF): <c>cover</c> = aday dosyası kapak formu,
    /// <c>lesson-card</c> = imza sütunlu direksiyon eğitim kartı,
    /// <c>attendance</c> = teorik devam çizelgesi. Denetimde dosyaya konur.
    /// </summary>
    [HttpGet("students/{profileId:guid}/forms/{formKey}")]
    [RequireDrivingPermission(DrivingPermissions.StudentView)]
    public async Task<IActionResult> GetStudentForm(Guid profileId, string formKey, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var row = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.Id == profileId)
            .Join(dbContext.Students.AsNoTracking(), p => p.StudentId, s => s.Id, (profile, student) => new { profile, student })
            .SingleOrDefaultAsync(ct);
        if (row is null) return NotFound(new { message = "Kursiyer bulunamadı." });

        var institutionName = await dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.Id == dbContext.CurrentTenantId).Select(x => x.Name).FirstOrDefaultAsync(ct) ?? "Sürücü Kursu";

        var document = formKey.ToLowerInvariant() switch
        {
            "cover" => await BuildCoverFormAsync(institutionName, row.profile, row.student.FullName, row.student.TcNo, row.student.BirthDate, ct),
            "lesson-card" => await BuildLessonCardAsync(institutionName, row.profile, row.student.FullName, ct),
            "attendance" => await BuildAttendanceSheetAsync(institutionName, row.profile, row.student.FullName, ct),
            _ => null,
        };
        if (document is null) return NotFound(new { message = "Tanımsız form. Geçerli: cover, lesson-card, attendance." });

        var safeName = $"{formKey}-{row.profile.StudentNumber}";
        return File(pdf.Generate(document), "application/pdf", $"{safeName}.pdf");
    }

    /// <summary>
    /// Matbu MEB evrakları (PDF): <c>muracaat</c> = EK-1 müracaat formu,
    /// <c>imza-sirkuleri</c> = kursiyerin imza sirküleri, <c>sozlesme</c> = kayıt
    /// sözleşmesi (2 sayfa), <c>tumu</c> = üçü tek dosyada.
    ///
    /// Sözleşme ücret/taksit içerdiğinden yalnızca finans yetkisi olanlara verilir;
    /// müracaat formu ile imza sirkülerinde para geçmediği için kursiyer görme
    /// yetkisi yeterlidir.
    /// </summary>
    [HttpGet("students/{profileId:guid}/contract-forms/{formKey}")]
    [RequireDrivingPermission(DrivingPermissions.StudentView)]
    public async Task<IActionResult> GetContractForm(Guid profileId, string formKey, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();

        var key = formKey.ToLowerInvariant();
        var isBundle = key == "tumu";
        // Paket dışındaki anahtarlar tek belgeye karşılık gelir; tanımsızsa 404.
        DrivingContractFormKind? kind = key switch
        {
            "muracaat" => DrivingContractFormKind.Application,
            "imza-sirkuleri" => DrivingContractFormKind.SignatureCircular,
            "sozlesme" => DrivingContractFormKind.Contract,
            _ => null,
        };
        if (!isBundle && kind is null)
            return NotFound(new { message = "Tanımsız form. Geçerli: muracaat, imza-sirkuleri, sozlesme, tumu." });

        // Sözleşme ve paket ücret tablosu taşıdığından finans yetkisi şart.
        var needsFinance = isBundle || kind is DrivingContractFormKind.Contract;
        if (needsFinance && !await permissionService.HasAsync(User, DrivingPermissions.FinanceView, ct))
            return Forbid();

        var row = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.Id == profileId)
            .Join(dbContext.Students.AsNoTracking(), p => p.StudentId, s => s.Id, (profile, student) => new { profile, student })
            .SingleOrDefaultAsync(ct);
        if (row is null) return NotFound(new { message = "Kursiyer bulunamadı." });

        var data = await BuildContractFormDataAsync(row.profile, row.student, ct);
        var bytes = isBundle ? contractForms.GenerateBundle(data) : contractForms.Generate(kind!.Value, data);
        return File(bytes, "application/pdf", $"{formKey}-{row.profile.StudentNumber}.pdf");
    }

    /// <summary>
    /// Matbu formlarda kullanılan kurum künyesi ve ücret satırları. Kurum bir kere
    /// doldurur, sonra tüm kursiyerlerin evrakı bu değerlerle basılır.
    /// </summary>
    [HttpGet("contract-form-settings")]
    [RequireDrivingPermission(DrivingPermissions.StudentView)]
    public async Task<IActionResult> GetContractFormSettings(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var settings = await dbContext.DrivingSchoolSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        var tenantName = await dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.Id == dbContext.CurrentTenantId).Select(x => x.Name).FirstOrDefaultAsync(ct);
        return Ok(ContractFormSettingsResponse(settings, tenantName));
    }

    [HttpPut("contract-form-settings")]
    [RequireDrivingPermission(DrivingPermissions.SettingsManage)]
    public async Task<IActionResult> UpdateContractFormSettings(
        [FromBody] UpdateDrivingContractFormSettingsRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();

        if (request.TheoryHours is < 1 or > 200) return BadRequest(new { message = "Teorik ders saati 1-200 arasında olmalıdır." });
        if (request.DrivingHours is < 1 or > 200) return BadRequest(new { message = "Direksiyon ders saati 1-200 arasında olmalıdır." });
        foreach (var (label, value) in new (string, decimal)[]
        {
            ("Teorik saat ücreti", request.TheoryHourlyFee), ("Direksiyon saat ücreti", request.DrivingHourlyFee),
            ("Teorik sınav ücreti", request.TheoryExamFee), ("Direksiyon sınav ücreti", request.DrivingExamFee),
        })
        {
            if (value is < 0 or > 1_000_000) return BadRequest(new { message = $"{label} 0 ile 1.000.000 arasında olmalıdır." });
        }

        var settings = await dbContext.DrivingSchoolSettings.SingleOrDefaultAsync(ct);
        var before = settings is null ? null : ContractFormSettingsSnapshot(settings);
        if (settings is null) { settings = new DrivingSchoolSettings(); dbContext.DrivingSchoolSettings.Add(settings); }

        settings.FormInstitutionName = Trim(request.InstitutionName, 200);
        settings.FormInstitutionCity = Trim(request.InstitutionCity, 60);
        settings.FormInstitutionDistrict = Trim(request.InstitutionDistrict, 60);
        settings.FormInstitutionAddress = Trim(request.InstitutionAddress, 400);
        settings.FormInstitutionPhone = Trim(request.InstitutionPhone, 30);
        settings.FormDirectorName = Trim(request.DirectorName, 150);
        settings.FormBankName = Trim(request.BankName, 120);
        settings.FormBankAccountNo = Trim(request.BankAccountNo, 60);
        settings.FormJurisdictionCity = Trim(request.JurisdictionCity, 60);
        settings.FormTheoryHourlyFee = request.TheoryHourlyFee;
        settings.FormDrivingHourlyFee = request.DrivingHourlyFee;
        settings.FormTheoryExamFee = request.TheoryExamFee;
        settings.FormDrivingExamFee = request.DrivingExamFee;
        settings.FormTheoryHours = request.TheoryHours;
        settings.FormDrivingHours = request.DrivingHours;
        settings.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(ct);
        await auditLogService.LogChangeAsync("Sözleşme ve form künyesi güncellendi", AuditCategory,
            nameof(DrivingSchoolSettings), settings.Id.ToString(),
            "Matbu MEB evraklarında kullanılan kurum bilgileri ve ücret satırları değişti.",
            before, ContractFormSettingsSnapshot(settings), ct);
        return Ok(ContractFormSettingsResponse(settings, null));
    }

    private static object ContractFormSettingsResponse(DrivingSchoolSettings? s, string? tenantName) => new
    {
        // Kurum adı hiç girilmemişse çalışma alanı adı önerilir.
        institutionName = Pick(s?.FormInstitutionName, tenantName),
        institutionCity = s?.FormInstitutionCity ?? string.Empty,
        institutionDistrict = s?.FormInstitutionDistrict ?? string.Empty,
        institutionAddress = s?.FormInstitutionAddress ?? string.Empty,
        institutionPhone = s?.FormInstitutionPhone ?? string.Empty,
        directorName = Pick(s?.FormDirectorName, s?.CertificateDirectorName),
        bankName = s?.FormBankName ?? string.Empty,
        bankAccountNo = s?.FormBankAccountNo ?? string.Empty,
        jurisdictionCity = Pick(s?.FormJurisdictionCity, s?.FormInstitutionCity),
        theoryHourlyFee = s?.FormTheoryHourlyFee ?? 0m,
        drivingHourlyFee = s?.FormDrivingHourlyFee ?? 0m,
        theoryExamFee = s?.FormTheoryExamFee ?? 0m,
        drivingExamFee = s?.FormDrivingExamFee ?? 0m,
        theoryHours = s?.FormTheoryHours ?? 34,
        drivingHours = s?.FormDrivingHours ?? 16,
    };

    private static object ContractFormSettingsSnapshot(DrivingSchoolSettings s) => new
    {
        s.FormInstitutionName, s.FormInstitutionCity, s.FormInstitutionDistrict, s.FormInstitutionAddress,
        s.FormInstitutionPhone, s.FormDirectorName, s.FormBankName, s.FormBankAccountNo, s.FormJurisdictionCity,
        s.FormTheoryHourlyFee, s.FormDrivingHourlyFee, s.FormTheoryExamFee, s.FormDrivingExamFee,
        s.FormTheoryHours, s.FormDrivingHours,
    };

    private static string Trim(string? value, int maxLength)
    {
        var trimmed = value?.Trim() ?? string.Empty;
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }

    /// <summary>
    /// Kursiyer dosyası + kurum ayarları + finans sözleşmesini matbu formların
    /// beklediği düz veri kümesine çevirir. Girilmemiş alanlar boş string kalır;
    /// evrak elde tamamlanabilsin diye tire konmaz.
    /// </summary>
    private async Task<DrivingContractFormData> BuildContractFormDataAsync(
        StudentDrivingProfile profile, StudentProfile student, CancellationToken ct)
    {
        var settings = await dbContext.DrivingSchoolSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        var tenantName = await dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.Id == dbContext.CurrentTenantId).Select(x => x.Name).FirstOrDefaultAsync(ct);

        EnrollmentContract? contract = null;
        var installments = new List<DrivingContractInstallment>();
        if (profile.EnrollmentContractId is Guid contractId)
        {
            contract = await dbContext.EnrollmentContracts.AsNoTracking()
                .SingleOrDefaultAsync(x => x.Id == contractId, ct);
            installments = await dbContext.FinanceInstallments.AsNoTracking()
                .Where(x => x.EnrollmentContractId == contractId)
                .OrderBy(x => x.SeqNo)
                .Select(x => new DrivingContractInstallment(
                    string.IsNullOrWhiteSpace(x.Label) ? $"{x.SeqNo}. Taksit" : x.Label,
                    x.Amount,
                    x.DueDateUtc,
                    // Ödeme tarihi ayrı tutulmuyor; tamamı tahsil edilmişse vade tarihi basılır.
                    x.PaidAmount >= x.Amount ? x.DueDateUtc : null))
                .ToListAsync(ct);
        }

        var drivingHourly = settings?.FormDrivingHourlyFee ?? 0m;
        var drivingHours = settings?.FormDrivingHours ?? 16;

        return new DrivingContractFormData(
            FullName: student.FullName ?? string.Empty,
            IdentityNumber: Pick(profile.IdentityNumber, student.TcNo),
            FatherName: profile.FatherName,
            MotherName: profile.MotherName,
            BirthPlace: profile.BirthPlace,
            BirthDate: student.BirthDate ?? string.Empty,
            EducationLevel: profile.EducationLevel,
            LicenseClass: profile.LicenseClass,
            Phone: Pick(profile.Phone, student.ParentPhone),
            HomePhone: string.Empty,
            ResidenceAddress: Pick(profile.ResidenceAddress, student.Address),
            RegistrationCity: profile.RegistrationCity,
            RegistrationDistrict: profile.RegistrationDistrict,
            RegistrationNeighborhood: profile.RegistrationNeighborhood,
            RegistrationStreet: profile.RegistrationStreet,
            RegistrationVolumeNo: profile.RegistrationVolumeNo,
            RegistrationFamilyOrderNo: profile.RegistrationFamilyOrderNo,
            RegistrationOrderNo: profile.RegistrationOrderNo,
            IdentityIssueDate: Date(profile.IdentityIssueDate),
            IdentityIssuePlace: profile.IdentityIssuePlace,
            ExistingLicenseCity: profile.HasExistingLicense ? profile.LicenseIssuePlace : string.Empty,
            ExistingLicenseClasses: profile.HasExistingLicense ? profile.ExistingLicenseClasses : string.Empty,
            ExistingLicenseDate: profile.HasExistingLicense ? Date(profile.LicenseIssueDate) : string.Empty,
            ExistingLicenseNumber: profile.HasExistingLicense ? profile.ExistingLicenseNumber : string.Empty,
            InstitutionName: Pick(settings?.FormInstitutionName, tenantName, "Sürücü Kursu"),
            InstitutionCity: settings?.FormInstitutionCity ?? string.Empty,
            InstitutionDistrict: settings?.FormInstitutionDistrict ?? string.Empty,
            InstitutionAddress: settings?.FormInstitutionAddress ?? string.Empty,
            InstitutionPhone: settings?.FormInstitutionPhone ?? string.Empty,
            DirectorName: Pick(settings?.FormDirectorName, settings?.CertificateDirectorName),
            BankName: settings?.FormBankName ?? string.Empty,
            BankAccountNo: settings?.FormBankAccountNo ?? string.Empty,
            JurisdictionCity: Pick(settings?.FormJurisdictionCity, settings?.FormInstitutionCity),
            TotalFee: contract?.NetAmount ?? 0m,
            TheoryHourlyFee: settings?.FormTheoryHourlyFee ?? 0m,
            DrivingHourlyFee: drivingHourly,
            // Sınav ücretleri önce kursiyere özel girilmişse ondan, yoksa kurum varsayılanından.
            TheoryExamFee: profile.TheoryExamFee > 0 ? profile.TheoryExamFee : settings?.FormTheoryExamFee ?? 0m,
            DrivingExamFee: profile.DrivingExamFee > 0 ? profile.DrivingExamFee : settings?.FormDrivingExamFee ?? 0m,
            TheoryHours: settings?.FormTheoryHours ?? 34,
            DrivingHours: drivingHours,
            // İkinci 4'üncü hak bedeli: zorunlu direksiyon saati × saat ücreti.
            FailedFourthAttemptFee: drivingHourly * drivingHours,
            Installments: installments,
            DownPayment: contract?.DownPayment ?? 0m,
            RegisteredAtUtc: profile.RegisteredAtUtc,
            GeneratedAtUtc: DateTime.UtcNow);
    }

    /// <summary>İlk dolu değeri döndürür; hiçbiri yoksa boş string.</summary>
    private static string Pick(params string?[] candidates) =>
        candidates.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim() ?? string.Empty;

    private static string Date(DateTime? utc) => utc is null ? string.Empty : utc.Value.AddHours(3).ToString("dd.MM.yyyy");

    /// <summary>Aday dosyası kapak formu: kimlik bilgileri + evrak kontrol listesi.</summary>
    private async Task<DrivingReportDocument> BuildCoverFormAsync(
        string institutionName, StudentDrivingProfile profile, string fullName, string? tcNo, string? birthDate, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var required = RequiredDocumentsFor(birthDate);
        var stored = await dbContext.StudentDrivingDocuments.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profile.Id && x.IsCurrent)
            .ToListAsync(ct);

        var rows = required
            .Concat(stored.Select(x => x.DocumentType).Where(x => !required.Contains(x)))
            .Distinct()
            .Select(type =>
            {
                var document = stored.FirstOrDefault(x => x.DocumentType == type);
                var status = document is null
                    ? "EKSİK"
                    : DrivingStudentRules.EffectiveStatus(document.Status, document.ExpiresAtUtc, now) switch
                    {
                        StudentDocumentStatus.Approved => "ONAYLI",
                        StudentDocumentStatus.PendingApproval => "ONAY BEKLİYOR",
                        StudentDocumentStatus.Expired => "SÜRESİ GEÇTİ",
                        StudentDocumentStatus.Rejected => "REDDEDİLDİ",
                        _ => "EKSİK",
                    };
                return (IReadOnlyList<string>)
                [
                    DocumentLabel(type),
                    required.Contains(type) ? "Zorunlu" : "Ek",
                    document?.DocumentNumber ?? "—",
                    document?.IssuedBy ?? "—",
                    document?.IssuedAtUtc?.AddHours(3).ToString("dd.MM.yyyy") ?? "—",
                    document?.ExpiresAtUtc?.AddHours(3).ToString("dd.MM.yyyy") ?? "—",
                    status,
                ];
            })
            .ToList();

        return new DrivingReportDocument(
            institutionName,
            "Aday Dosyası Kapak Formu",
            $"MTSK kursiyer dosyası — düzenlenme: {now.AddHours(3):dd.MM.yyyy}",
            profile.RegisteredAtUtc, now,
            [
                new DrivingReportColumn("Belge"), new DrivingReportColumn("Nitelik"), new DrivingReportColumn("Belge No"),
                new DrivingReportColumn("Veren"), new DrivingReportColumn("Tarih"), new DrivingReportColumn("Geçerlilik"),
                new DrivingReportColumn("Durum"),
            ],
            rows,
            [
                ("Kursiyer No", profile.StudentNumber.ToString()),
                ("Ad Soyad", fullName),
                ("TC Kimlik No", string.IsNullOrWhiteSpace(profile.IdentityNumber) ? tcNo ?? "—" : profile.IdentityNumber),
                ("Kimlik Seri No", string.IsNullOrWhiteSpace(profile.IdentitySerialNo) ? "—" : profile.IdentitySerialNo),
                ("Baba / Anne Adı", $"{(string.IsNullOrWhiteSpace(profile.FatherName) ? "—" : profile.FatherName)} / {(string.IsNullOrWhiteSpace(profile.MotherName) ? "—" : profile.MotherName)}"),
                ("Doğum Yeri / Tarihi", $"{(string.IsNullOrWhiteSpace(profile.BirthPlace) ? "—" : profile.BirthPlace)} / {birthDate ?? "—"}"),
                ("Sertifika Sınıfı", profile.LicenseClass),
                ("Kayıt Tarihi", profile.RegisteredAtUtc.AddHours(3).ToString("dd.MM.yyyy")),
            ]);
    }

    /// <summary>Direksiyon eğitim kartı: her ders bir satır, imza sütunu boş bırakılır.</summary>
    private async Task<DrivingReportDocument> BuildLessonCardAsync(
        string institutionName, StudentDrivingProfile profile, string fullName, CancellationToken ct)
    {
        var lessons = await dbContext.DrivingLessons.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profile.Id && x.CompletedAtUtc != null)
            .Join(dbContext.DrivingInstructorProfiles.AsNoTracking(), x => x.InstructorProfileId, x => x.Id, (lesson, instructor) => new { lesson, instructor.StaffId })
            .Join(dbContext.Staff.AsNoTracking(), x => x.StaffId, x => x.Id, (x, staff) => new { x.lesson, InstructorName = staff.FullName })
            .Join(dbContext.DrivingVehicles.AsNoTracking(), x => x.lesson.VehicleId, x => x.Id, (x, vehicle) => new { x.lesson, x.InstructorName, vehicle.PlateNumber })
            .OrderBy(x => x.lesson.StartedAtUtc)
            .ToListAsync(ct);

        var rows = lessons.Select((x, index) => (IReadOnlyList<string>)
        [
            (index + 1).ToString(),
            x.lesson.StartedAtUtc.AddHours(3).ToString("dd.MM.yyyy"),
            $"{x.lesson.StartedAtUtc.AddHours(3):HH:mm}-{x.lesson.CompletedAtUtc!.Value.AddHours(3):HH:mm}",
            x.lesson.ChargedMinutes.ToString(),
            x.InstructorName,
            x.PlateNumber,
            x.lesson.EndKilometer is { } end ? $"{x.lesson.StartKilometer}-{end}" : x.lesson.StartKilometer.ToString(),
            string.Empty, // imza sütunu — çıktıda elle imzalanır
        ]).ToList();

        return new DrivingReportDocument(
            institutionName,
            "Direksiyon Eğitim Kartı",
            $"Kursiyer: {fullName} (#{profile.StudentNumber}) • Sertifika sınıfı: {profile.LicenseClass}",
            lessons.Count > 0 ? lessons[0].lesson.StartedAtUtc : profile.RegisteredAtUtc, DateTime.UtcNow,
            [
                new DrivingReportColumn("Ders", Numeric: true), new DrivingReportColumn("Tarih"), new DrivingReportColumn("Saat"),
                new DrivingReportColumn("Süre (dk)", Numeric: true), new DrivingReportColumn("Usta Öğretici"),
                new DrivingReportColumn("Araç"), new DrivingReportColumn("Km"), new DrivingReportColumn("Kursiyer İmzası"),
            ],
            rows,
            [
                ("Tamamlanan ders", lessons.Count.ToString()),
                ("Toplam süre", $"{lessons.Sum(x => x.lesson.ChargedMinutes)} dk / {profile.PurchasedDrivingMinutes} dk"),
            ]);
    }

    /// <summary>Teorik devam çizelgesi: oturum başına katılım durumu + devam oranı.</summary>
    private async Task<DrivingReportDocument> BuildAttendanceSheetAsync(
        string institutionName, StudentDrivingProfile profile, string fullName, CancellationToken ct)
    {
        var records = await dbContext.DrivingTheoryAttendances.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profile.Id)
            .Join(dbContext.DrivingTheorySessions.AsNoTracking().Where(x => x.Status != DrivingTheorySessionStatus.Cancelled),
                a => a.TheorySessionId, s => s.Id,
                (a, s) => new { a.Status, a.Note, s.Subject, s.Topic, s.StartsAtUtc, Minutes = (int)(s.EndsAtUtc - s.StartsAtUtc).TotalMinutes })
            .OrderBy(x => x.StartsAtUtc)
            .ToListAsync(ct);

        static string StatusLabel(DrivingTheoryAttendanceStatus status) => status switch
        {
            DrivingTheoryAttendanceStatus.Present => "Katıldı",
            DrivingTheoryAttendanceStatus.Late => "Geç kaldı",
            DrivingTheoryAttendanceStatus.Excused => "Mazeretli",
            _ => "Katılmadı",
        };

        var rows = records.Select(x => (IReadOnlyList<string>)
        [
            x.StartsAtUtc.AddHours(3).ToString("dd.MM.yyyy HH:mm"),
            x.Subject,
            x.Topic,
            x.Minutes.ToString(),
            StatusLabel(x.Status),
            x.Note,
        ]).ToList();

        var scheduled = records.Sum(x => x.Minutes);
        var attended = records.Where(x => x.Status is DrivingTheoryAttendanceStatus.Present or DrivingTheoryAttendanceStatus.Late).Sum(x => x.Minutes);

        return new DrivingReportDocument(
            institutionName,
            "Teorik Eğitim Devam Çizelgesi",
            $"Kursiyer: {fullName} (#{profile.StudentNumber}) • Sertifika sınıfı: {profile.LicenseClass}",
            records.Count > 0 ? records[0].StartsAtUtc : profile.RegisteredAtUtc, DateTime.UtcNow,
            [
                new DrivingReportColumn("Tarih"), new DrivingReportColumn("Konu"), new DrivingReportColumn("İşlenen"),
                new DrivingReportColumn("Süre (dk)", Numeric: true), new DrivingReportColumn("Durum"), new DrivingReportColumn("Not"),
            ],
            rows,
            [
                ("Planlanan", $"{scheduled} dk"),
                ("Katılınan", $"{attended} dk"),
                ("Devam oranı", scheduled == 0 ? "—" : $"%{Math.Round(attended * 100m / scheduled, 1)}"),
            ]);
    }

    // ─── Yardımcılar ──────────────────────────────────────────────────────────

    /// <summary>Belge dosyasını (zorunlu + yüklenmiş) tek listede birleştirir.</summary>
    private async Task<object> BuildDocumentFileAsync(StudentDrivingProfile profile, bool includeInternalReview, CancellationToken ct)
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
                    fileUrl = document is null ? null : $"/api/driving-school/student-documents/{document.Id}/file",
                    fileName = document?.FileName,
                    documentNumber = document?.DocumentNumber,
                    issuedBy = document?.IssuedBy,
                    issuedAtUtc = document?.IssuedAtUtc,
                    expiresAtUtc = document?.ExpiresAtUtc,
                    uploadedAtUtc = document?.UploadedAtUtc,
                    reviewedAtUtc = document?.ReviewedAtUtc,
                    rejectionReason = document?.RejectionReason,
                    reviewNote = includeInternalReview ? document?.ReviewNote : null,
                    reviewVersion = document?.ReviewVersion ?? 0,
                };
            })
            .ToList();

        return new
        {
            items = rows,
            missingCount = rows.Count(x => x.required && x.status is nameof(StudentDocumentStatus.Missing) or nameof(StudentDocumentStatus.Rejected) or nameof(StudentDocumentStatus.ReuploadRequested) or nameof(StudentDocumentStatus.Expired)),
            pendingCount = rows.Count(x => x.status == nameof(StudentDocumentStatus.PendingApproval)),
            complete = rows.Where(x => x.required).All(x => x.status == nameof(StudentDocumentStatus.Approved)),
            history = stored.Where(x => !x.IsCurrent).Select(x => new
            {
                x.Id,
                documentType = x.DocumentType.ToString(),
                label = DocumentLabel(x.DocumentType),
                status = x.Status.ToString(),
                fileUrl = $"/api/driving-school/student-documents/{x.Id}/file",
                x.UploadedAtUtc,
                x.RejectionReason,
                reviewNote = includeInternalReview ? x.ReviewNote : null,
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
        var storedFile = IsSafeStudentDocumentUrl(request.FileUrl) ? await files.ReadPrefixAsync(request.FileUrl, 32, ct) : null;
        if (storedFile is null || storedFile.Length > MaxStudentDocumentBytes || !IsAllowedStudentDocumentContent(request.FileName, storedFile.Bytes))
            return BadRequest(new { message = "Belge dosyası güvenli öğrenci evrak alanından seçilmelidir." });
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
            IssuedBy = request.IssuedBy?.Trim() ?? string.Empty,
            IssuedAtUtc = request.IssuedAtUtc,
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

    /// <summary>Telefon yalnız rakamlarla saklanır ki "0532 111 22 33" ve "05321112233" aynı sayılsın.</summary>
    private static string NormalizePhone(string? value)
        => new((value ?? string.Empty).Where(char.IsDigit).ToArray());

    /// <summary>
    /// MEBBİS aday girişi için eksik alanların listesi. Kural Domain'de yaşar;
    /// burada yalnız profil + onaylı belgeler kurala çevrilir.
    /// </summary>
    private async Task<List<string>> BuildMebbisMissingAsync(
        StudentDrivingProfile profile, string? tcNo, string? birthDate, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var currentDocs = await dbContext.StudentDrivingDocuments.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profile.Id && x.IsCurrent)
            .Select(x => new { x.DocumentType, x.Status, x.ExpiresAtUtc, x.DocumentNumber, x.IssuedBy, x.IssuedAtUtc })
            .ToListAsync(ct);

        bool Approved(StudentDocumentType type) => currentDocs.Any(x =>
            x.DocumentType == type && DrivingStudentRules.CountsAsSatisfied(x.Status, x.ExpiresAtUtc, now));

        var health = currentDocs.FirstOrDefault(x => x.DocumentType == StudentDocumentType.HealthReport);
        var healthDetailsComplete = health is not null
            && !string.IsNullOrWhiteSpace(health.DocumentNumber)
            && !string.IsNullOrWhiteSpace(health.IssuedBy)
            && health.IssuedAtUtc is not null;

        var identityNumber = profile.IdentityKind == IdentityKind.TurkishId
            ? (string.IsNullOrWhiteSpace(profile.IdentityNumber) ? tcNo : profile.IdentityNumber)
            : profile.IdentityNumber;

        return DrivingStudentRules.MebbisMissingFields(new DrivingStudentRules.MebbisCandidate(
            HasValidNationalId: profile.IdentityKind != IdentityKind.TurkishId || DrivingStudentRules.IsValidTurkishId(identityNumber),
            BirthDate: birthDate,
            FatherName: profile.FatherName,
            MotherName: profile.MotherName,
            BirthPlace: profile.BirthPlace,
            EducationLevel: profile.EducationLevel,
            IdentitySerialNo: profile.IdentitySerialNo,
            Phone: profile.Phone,
            HasPhoto: Approved(StudentDocumentType.BiometricPhoto) || !string.IsNullOrWhiteSpace(profile.PhotoUrl),
            HealthReportApproved: Approved(StudentDocumentType.HealthReport),
            HealthReportDetailsComplete: healthDetailsComplete,
            DiplomaApproved: Approved(StudentDocumentType.Diploma),
            CriminalRecordApproved: Approved(StudentDocumentType.CriminalRecord)));
    }

    private async Task<string?> FindDuplicateByPhoneAsync(string normalizedPhone, CancellationToken ct)
        => await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.Phone == normalizedPhone && x.Phone != string.Empty)
            .Join(dbContext.Students.AsNoTracking(), x => x.StudentId, s => s.Id, (_, student) => student.FullName)
            .FirstOrDefaultAsync(ct);

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
        if ((request.ResidenceAddress?.Length ?? 0) > 500) return "İkametgâh adresi en fazla 500 karakter olabilir.";
        if (!string.IsNullOrWhiteSpace(request.PhotoUrl) && !IsSafeUploadUrl(request.PhotoUrl)) return "Fotoğraf güvenli yükleme alanından seçilmelidir.";
        if (!string.IsNullOrWhiteSpace(request.LivePhotoUrl) && !IsSafeUploadUrl(request.LivePhotoUrl)) return "Anlık fotoğraf güvenli yükleme alanından seçilmelidir.";
        if (request.HasExistingLicense)
        {
            if ((request.ExistingLicenseNumber?.Length ?? 0) > 40) return "Sürücü belgesi numarası en fazla 40 karakter olabilir.";
            if ((request.ExistingLicenseClasses?.Length ?? 0) > 60) return "Ehliyet sınıfı en fazla 60 karakter olabilir.";
            if ((request.LicenseIssuePlace?.Length ?? 0) > 120) return "Veren makam en fazla 120 karakter olabilir.";
            if (request.LicenseIssueDate is { } issued && request.LicenseExpiryDate is { } expiry && expiry < issued)
                return "Ehliyet son geçerlilik tarihi, veriliş tarihinden önce olamaz.";
        }
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

    private static bool IsSafeStudentDocumentUrl(string? value)
    {
        if (!IsSafeUploadUrl(value) || !Uri.TryCreate(value, UriKind.RelativeOrAbsolute, out var uri)) return false;
        var path = uri.IsAbsoluteUri ? uri.AbsolutePath : value!;
        return path.StartsWith("/uploads/driving-student-documents/", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsAllowedStudentDocumentContent(string? fileName, ReadOnlySpan<byte> header)
    {
        var extension = Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant();
        if (extension == ".pdf") return header.Length >= 5 && header[..5].SequenceEqual("%PDF-"u8);
        if (extension is ".jpg" or ".jpeg") return header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;
        ReadOnlySpan<byte> png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        return extension == ".png" && header.Length >= png.Length && header[..png.Length].SequenceEqual(png);
    }

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue("nameid") ?? User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var parsed) ? parsed : null;
    }

    private string CurrentUserName()
    {
        var value = (User.FindFirstValue("name") ?? User.Identity?.Name ?? "Sistem").Trim();
        return string.IsNullOrWhiteSpace(value) ? "Sistem" : value;
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
    string? IdentitySerialNo,
    string? FatherName,
    string? MotherName,
    string? BirthPlace,
    string? Nationality,
    string? BirthDate,
    string? Gender,
    string? BloodType,
    string? Occupation,
    string? EducationLevel,
    string? City,
    string? District,
    string? ResidenceAddress,
    // Nüfusa kayıtlı olduğu yer — EK-1 müracaat formunun kimlik tablosunu doldurur.
    string? RegistrationCity,
    string? RegistrationDistrict,
    string? RegistrationNeighborhood,
    string? RegistrationStreet,
    string? RegistrationVolumeNo,
    string? RegistrationFamilyOrderNo,
    string? RegistrationOrderNo,
    DateTime? IdentityIssueDate,
    string? IdentityIssuePlace,
    string? Address,
    string? Phone,
    string? Email,
    string? WhatsAppPhone,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    string? PhotoUrl,
    string? LivePhotoUrl,
    bool HasExistingLicense,
    string? ExistingLicenseNumber,
    string? ExistingLicenseClasses,
    DateTime? LicenseIssueDate,
    DateTime? LicenseExpiryDate,
    string? LicenseIssuePlace,
    decimal TheoryExamFee,
    decimal DrivingExamFee,
    bool TheoryExamFeePaid,
    bool DrivingExamFeePaid,
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
    string? DownPaymentMethod,
    // Peşinat kayıt anında tahsil edildi mi? false → makbuz kesilmez, "bekliyor" olur.
    bool DownPaymentPaid = true);

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
    string? Description,
    string? IssuedBy = null,
    DateTime? IssuedAtUtc = null)
{
    public StudentDocumentType? ParsedType =>
        Enum.TryParse<StudentDocumentType>(DocumentType, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed)
            ? parsed
            : null;
}

public sealed record ReviewStudentDocumentRequest(
    string? Action,
    bool? Approved,
    string? RejectionReason,
    string? Note,
    DateTime? ExpiresAtUtc,
    int ExpectedVersion = 0);

public sealed record VerifyIdentityRequest(string? IdentityNumber, string? FullName, string? BirthDate);

/// <summary>EK-1 müracaat formundaki "nüfus cüzdanındaki kayıtlara göre" bloğu.</summary>
public sealed record UpdateDrivingRegistrationIdentityRequest(
    string? RegistrationCity,
    string? RegistrationDistrict,
    string? RegistrationNeighborhood,
    string? RegistrationStreet,
    string? RegistrationVolumeNo,
    string? RegistrationFamilyOrderNo,
    string? RegistrationOrderNo,
    DateTime? IdentityIssueDate,
    string? IdentityIssuePlace,
    string? BirthPlace,
    string? FatherName,
    string? MotherName);

/// <summary>Matbu evraklarda kullanılan kurum künyesi ve mevzuat ücretleri.</summary>
public sealed record UpdateDrivingContractFormSettingsRequest(
    string? InstitutionName,
    string? InstitutionCity,
    string? InstitutionDistrict,
    string? InstitutionAddress,
    string? InstitutionPhone,
    string? DirectorName,
    string? BankName,
    string? BankAccountNo,
    string? JurisdictionCity,
    decimal TheoryHourlyFee,
    decimal DrivingHourlyFee,
    decimal TheoryExamFee,
    decimal DrivingExamFee,
    int TheoryHours,
    int DrivingHours);

public sealed record SetMebbisEnteredRequest(bool Entered);

public sealed record UpdateDrivingExamFeesRequest(decimal TheoryExamFee, decimal DrivingExamFee, bool TheoryExamFeePaid, bool DrivingExamFeePaid, DateTime? DrivingExamDate);

public sealed record UpdateDrivingStudentStatusRequest(string Status, string? Reason)
{
    public DrivingStudentStatus? ParsedStatus =>
        Enum.TryParse<DrivingStudentStatus>(Status, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed)
            ? parsed
            : null;
}

public sealed record SaveRegistrationDraftRequest(Guid? Id, string? DisplayName, int Step, string PayloadJson);
