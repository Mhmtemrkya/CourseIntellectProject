using System.Globalization;
using System.Text.Json;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Onam/izin formu akışının tamamı: şablon yönetimi, öğrenci kaydı üretimi,
/// tablete aktarma (tek kullanımlık imza oturumu), tablet yoklaması ve imzalama.
///
/// İş kuralları burada toplanır ve HTTP karşılıklarıyla (409/400/404) döner;
/// controller yalnız yetkilendirme ve taşımayla ilgilenir. Böylece kabul testleri
/// kuralları doğrudan servise karşı çalıştırabilir.
/// </summary>
public sealed class ConsentFormService(
    CourseIntellectDbContext dbContext,
    IInstitutionProfileService institutionProfileService,
    IConsentFormPdfService consentFormPdfService,
    IAuditLogService auditLogService) : IConsentFormService
{
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");
    private const string AuditCategory = "Consent";

    /// <summary>Yüklenen PDF için üst sınır. Tablette açılabilir kalması için bilerek dar.</summary>
    private const int MaxDocumentBytes = 12 * 1024 * 1024;

    /// <summary>Karşılığı bulunamayan yer tutucunun yerine basılan elle doldurulabilir boşluk.</summary>
    private const string BlankFill = "............................";

    /// <summary>Oturum ömrü — personel aksini söylemezse.</summary>
    private const int DefaultSessionMinutes = 30;

    /// <summary>Bu süre içinde yoklama yapan tablet "çevrimiçi" sayılır.</summary>
    private static readonly TimeSpan StationOnlineWindow = TimeSpan.FromSeconds(45);

    // ══════════════════════════════════════════════════════════════════════════
    // Katalog
    // ══════════════════════════════════════════════════════════════════════════

    public IReadOnlyList<ConsentContextKindDto> ContextKinds { get; } =
    [
        new(ConsentContextKind.General, "Genel (tüm öğrenciler)", "Kuruma kayıtlı herkesten bir kez istenir (ör. KVKK açık rıza).", "all"),
        new(ConsentContextKind.SchoolEnrollment, "Okul kaydı", "Kayıt sözleşmesi ve veli muvafakatnamesi.", "school"),
        new(ConsentContextKind.Transport, "Servis (taşıma)", "Servis kullanım sözleşmesi ve veli onayı.", "school"),
        new(ConsentContextKind.Trip, "Gezi / etkinlik", "Okul dışı etkinlik izin belgesi.", "school"),
        new(ConsentContextKind.Cafeteria, "Yemekhane", "Yemekhane/kantin kullanım izni.", "school"),
        new(ConsentContextKind.Health, "Sağlık", "İlaç uygulama ve acil müdahale muvafakati.", "all"),
        new(ConsentContextKind.MediaRelease, "Görüntü kullanımı", "Fotoğraf ve video kullanım izni.", "all"),
        new(ConsentContextKind.DrivingEnrollment, "Sürücü kursu kaydı", "Kayıt sözleşmesi, taahhütname ve açık rıza.", "driving"),
        new(ConsentContextKind.DrivingLesson, "Direksiyon dersi", "Ders öncesi sürüş güvenliği ve sorumluluk onayı.", "driving"),
        new(ConsentContextKind.DrivingGraduation, "Mezuniyet / belge teslimi", "Sertifika teslim tutanağı.", "driving"),
    ];

    // ══════════════════════════════════════════════════════════════════════════
    // Yüklenen PDF belgeleri
    // ══════════════════════════════════════════════════════════════════════════

    public async Task<ConsentResult<ConsentDocumentDto>> SaveDocumentAsync(
        byte[] content, string? fileName, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        if (content is not { Length: > 0 })
        {
            return ConsentResult<ConsentDocumentDto>.Fail(400, "Boş dosya yüklenemez.");
        }
        if (content.Length > MaxDocumentBytes)
        {
            return ConsentResult<ConsentDocumentDto>.Fail(413,
                $"PDF en fazla {MaxDocumentBytes / (1024 * 1024)} MB olabilir.");
        }

        // Uzantıya değil İÇERİĞE bakılır: .pdf adıyla gelen betik burada elenir.
        var inspection = consentFormPdfService.Inspect(content);
        if (!inspection.Valid)
        {
            return ConsentResult<ConsentDocumentDto>.Fail(400, inspection.Message);
        }

        var hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(content)).ToLowerInvariant();
        var existing = await dbContext.ConsentDocuments.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Sha256 == hash, cancellationToken);
        if (existing is not null)
        {
            return ConsentResult<ConsentDocumentDto>.Success(ToDocumentDto(existing));
        }

        var document = new ConsentDocument
        {
            // Dosya adı yalnız künye/indirme içindir; yol bileşenleri atılır.
            FileName = SafeFileName(fileName),
            Sha256 = hash,
            ByteSize = content.Length,
            PageCount = inspection.PageCount,
            Content = content,
            CreatedByUserId = actorUserId,
        };
        dbContext.ConsentDocuments.Add(document);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync("consent.document.upload", AuditCategory, nameof(ConsentDocument),
            document.Id.ToString(),
            $"Onam belgesi yüklendi: {document.FileName} ({document.PageCount} sayfa, {document.ByteSize} bayt)",
            cancellationToken);

        return ConsentResult<ConsentDocumentDto>.Success(ToDocumentDto(document));
    }

    public async Task<ConsentResult<ConsentDocumentContent>> GetDocumentAsync(
        Guid id, CancellationToken cancellationToken = default)
    {
        var document = await dbContext.ConsentDocuments.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return document is null
            ? ConsentResult<ConsentDocumentContent>.Fail(404, "Belge bulunamadı.")
            : ConsentResult<ConsentDocumentContent>.Success(
                new ConsentDocumentContent(document.FileName, document.Sha256, document.PageCount, document.Content));
    }

    public async Task<ConsentResult<ConsentDocumentContent>> GetFormDocumentAsync(
        Guid formId, CancellationToken cancellationToken = default)
    {
        var record = await dbContext.ConsentFormRecords.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == formId, cancellationToken);
        if (record is null) return ConsentResult<ConsentDocumentContent>.Fail(404, "Onam formu bulunamadı.");
        if (record.SourceKind != ConsentDocumentSource.Pdf || record.DocumentId is not Guid documentId)
        {
            return ConsentResult<ConsentDocumentContent>.Fail(404, "Bu form yüklenmiş bir belgeye dayanmıyor.");
        }

        return await GetDocumentAsync(documentId, cancellationToken);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Şablon yönetimi
    // ══════════════════════════════════════════════════════════════════════════

    public async Task<IReadOnlyList<ConsentTemplateDto>> ListTemplatesAsync(
        bool includeInactive, CancellationToken cancellationToken = default)
    {
        var query = dbContext.ConsentFormTemplates.AsNoTracking().Where(x => !x.IsDeleted);
        if (!includeInactive) query = query.Where(x => x.IsActive);

        var templates = await query
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Title)
            .ToListAsync(cancellationToken);

        var ids = templates.Select(x => x.Id).ToList();
        var bindings = await dbContext.ConsentFormRequirements.AsNoTracking()
            .Where(x => ids.Contains(x.TemplateId))
            .ToListAsync(cancellationToken);
        var documents = await LoadDocumentMetaAsync(templates.Select(x => x.DocumentId), cancellationToken);

        return templates.Select(t => ToTemplateDto(t, bindings, documents)).ToList();
    }

    public async Task<ConsentResult<ConsentTemplateDto>> GetTemplateAsync(
        Guid id, CancellationToken cancellationToken = default)
    {
        var template = await dbContext.ConsentFormTemplates.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, cancellationToken);
        if (template is null) return ConsentResult<ConsentTemplateDto>.Fail(404, "Form şablonu bulunamadı.");

        var bindings = await dbContext.ConsentFormRequirements.AsNoTracking()
            .Where(x => x.TemplateId == id).ToListAsync(cancellationToken);
        var documents = await LoadDocumentMetaAsync([template.DocumentId], cancellationToken);
        return ConsentResult<ConsentTemplateDto>.Success(ToTemplateDto(template, bindings, documents));
    }

    /// <summary>
    /// Belge künyeleri (ad + sayfa sayısı). İçerik BİLEREK okunmaz: liste
    /// yanıtları megabaytlık PDF yükü taşımamalı.
    /// </summary>
    private async Task<Dictionary<Guid, (string FileName, int PageCount)>> LoadDocumentMetaAsync(
        IEnumerable<Guid?> documentIds, CancellationToken cancellationToken)
    {
        var ids = documentIds.Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        if (ids.Count == 0) return [];

        var rows = await dbContext.ConsentDocuments.AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .Select(x => new { x.Id, x.FileName, x.PageCount })
            .ToListAsync(cancellationToken);
        return rows.ToDictionary(x => x.Id, x => (x.FileName, x.PageCount));
    }

    /// <summary>
    /// PDF kaynaklı şablonun belgesi kurumun kendi yüklemesi olmalı. Kurum
    /// süzgeci sorguya zaten uygulanır; bulunamayan kimlik reddedilir.
    /// </summary>
    private async Task<ConsentResult<Guid?>> ResolveTemplateDocumentAsync(
        SaveConsentTemplateRequest request, CancellationToken cancellationToken)
    {
        if (request.SourceKind != ConsentDocumentSource.Pdf) return ConsentResult<Guid?>.Success(null);

        if (request.DocumentId is not Guid documentId)
        {
            return ConsentResult<Guid?>.Fail(400, "PDF kaynaklı form için bir belge yüklenmelidir.");
        }

        var exists = await dbContext.ConsentDocuments.AsNoTracking()
            .AnyAsync(x => x.Id == documentId, cancellationToken);
        return exists
            ? ConsentResult<Guid?>.Success(documentId)
            : ConsentResult<Guid?>.Fail(404, "Yüklenen belge bulunamadı. Dosyayı yeniden yükleyin.");
    }

    public async Task<ConsentResult<ConsentTemplateDto>> CreateTemplateAsync(
        SaveConsentTemplateRequest request, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        var title = Trim(request.Title, 200);
        if (title.Length == 0) return ConsentResult<ConsentTemplateDto>.Fail(400, "Form başlığı zorunludur.");

        var document = await ResolveTemplateDocumentAsync(request, cancellationToken);
        if (!document.Ok) return ConsentResult<ConsentTemplateDto>.Fail(document.StatusCode, document.Message);

        var template = new ConsentFormTemplate
        {
            Title = title,
            SourceKind = request.SourceKind,
            DocumentId = document.Value,
            Body = (request.Body ?? string.Empty).Trim(),
            CheckItemsJson = SerializeCheckItems(request.CheckItems),
            RequiresSignature = request.RequiresSignature,
            SignerRole = request.SignerRole,
            IsActive = request.IsActive,
            SortOrder = request.SortOrder,
            CreatedByUserId = actorUserId,
        };
        dbContext.ConsentFormTemplates.Add(template);
        ReplaceBindings(template.Id, request.Bindings, []);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync("consent.template.create", AuditCategory, nameof(ConsentFormTemplate),
            template.Id.ToString(), $"Onam formu şablonu oluşturuldu: {template.Title}", cancellationToken);

        return await GetTemplateAsync(template.Id, cancellationToken);
    }

    public async Task<ConsentResult<ConsentTemplateDto>> UpdateTemplateAsync(
        Guid id, SaveConsentTemplateRequest request, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        var template = await dbContext.ConsentFormTemplates
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, cancellationToken);
        if (template is null) return ConsentResult<ConsentTemplateDto>.Fail(404, "Form şablonu bulunamadı.");

        var title = Trim(request.Title, 200);
        if (title.Length == 0) return ConsentResult<ConsentTemplateDto>.Fail(400, "Form başlığı zorunludur.");

        var document = await ResolveTemplateDocumentAsync(request, cancellationToken);
        if (!document.Ok) return ConsentResult<ConsentTemplateDto>.Fail(document.StatusCode, document.Message);

        template.Title = title;
        template.SourceKind = request.SourceKind;
        template.DocumentId = document.Value;
        template.Body = (request.Body ?? string.Empty).Trim();
        template.CheckItemsJson = SerializeCheckItems(request.CheckItems);
        template.RequiresSignature = request.RequiresSignature;
        template.SignerRole = request.SignerRole;
        template.IsActive = request.IsActive;
        template.SortOrder = request.SortOrder;
        template.UpdatedAtUtc = DateTime.UtcNow;

        var existing = await dbContext.ConsentFormRequirements
            .Where(x => x.TemplateId == id).ToListAsync(cancellationToken);
        ReplaceBindings(id, request.Bindings, existing);

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync("consent.template.update", AuditCategory, nameof(ConsentFormTemplate),
            id.ToString(), $"Onam formu şablonu güncellendi: {template.Title}", cancellationToken);

        return await GetTemplateAsync(id, cancellationToken);
    }

    /// <summary>
    /// Şablonu ve hizmet bağlarını kaldırır. İmzalanmış kayıtlara DOKUNULMAZ —
    /// imzalı belge hukuki kayıttır; kaydın metni zaten kendi içinde saklıdır.
    /// </summary>
    public async Task<ConsentResult<bool>> DeleteTemplateAsync(
        Guid id, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        var template = await dbContext.ConsentFormTemplates
            .FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, cancellationToken);
        if (template is null) return ConsentResult<bool>.Fail(404, "Form şablonu bulunamadı.");

        template.IsDeleted = true;
        template.DeletedAtUtc = DateTime.UtcNow;
        template.IsActive = false;

        var bindings = await dbContext.ConsentFormRequirements
            .Where(x => x.TemplateId == id).ToListAsync(cancellationToken);
        dbContext.ConsentFormRequirements.RemoveRange(bindings);

        // İmzalanmamış taslak/bekleyen kayıtlar iptal edilir; imzalılar aynen kalır.
        var open = await dbContext.ConsentFormRecords
            .Where(x => x.TemplateId == id
                && (x.Status == ConsentFormStatus.Draft || x.Status == ConsentFormStatus.AwaitingSignature))
            .ToListAsync(cancellationToken);
        foreach (var record in open)
        {
            record.Status = ConsentFormStatus.Cancelled;
            record.SessionToken = null;
            record.UpdatedAtUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync("consent.template.delete", AuditCategory, nameof(ConsentFormTemplate),
            id.ToString(), $"Onam formu şablonu silindi: {template.Title} (imzalı kayıtlar korundu)", cancellationToken);

        return ConsentResult<bool>.Success(true);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Öğrenci kayıtları
    // ══════════════════════════════════════════════════════════════════════════

    public async Task<IReadOnlyList<ConsentFormDto>> ListStudentFormsAsync(
        Guid studentProfileId, CancellationToken cancellationToken = default)
    {
        var records = await dbContext.ConsentFormRecords.AsNoTracking()
            .Where(x => x.StudentProfileId == studentProfileId && x.Status != ConsentFormStatus.Cancelled)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        var documents = await LoadDocumentMetaAsync(records.Select(x => x.DocumentId), cancellationToken);
        return records.Select(record => ToFormDto(record, documents)).ToList();
    }

    public async Task<ConsentResult<ConsentFormDto>> GetFormAsync(
        Guid id, CancellationToken cancellationToken = default)
    {
        var record = await dbContext.ConsentFormRecords.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (record is null) return ConsentResult<ConsentFormDto>.Fail(404, "Onam formu bulunamadı.");

        var documents = await LoadDocumentMetaAsync([record.DocumentId], cancellationToken);
        return ConsentResult<ConsentFormDto>.Success(ToFormDto(record, documents));
    }

    public async Task<string> GetSignatureImageAsync(Guid id, CancellationToken cancellationToken = default)
        => await dbContext.ConsentFormRecords.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => x.SignatureImage)
            .FirstOrDefaultAsync(cancellationToken) ?? string.Empty;

    public async Task<ConsentResult<ConsentStatusDto>> GetStatusAsync(
        Guid studentProfileId,
        ConsentContextKind? contextKind,
        string? contextKey,
        Guid? contextRefId,
        CancellationToken cancellationToken = default)
    {
        var student = await dbContext.Students.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == studentProfileId, cancellationToken);
        if (student is null) return ConsentResult<ConsentStatusDto>.Fail(404, "Öğrenci bulunamadı.");

        var key = Trim(contextKey, 120);
        var kinds = contextKind is ConsentContextKind kind
            ? new List<ConsentContextKind> { ConsentContextKind.General, kind }.Distinct().ToList()
            : [ConsentContextKind.General];

        var requirements = await ResolveRequirementsAsync(kinds, key, cancellationToken);

        var records = await dbContext.ConsentFormRecords.AsNoTracking()
            .Where(x => x.StudentProfileId == studentProfileId && x.Status != ConsentFormStatus.Cancelled)
            .ToListAsync(cancellationToken);

        var rows = new List<ConsentRequirementDto>();
        var matchedIds = new HashSet<Guid>();
        foreach (var (template, boundKind) in requirements)
        {
            var match = PickMatch(records, template.Id, boundKind, contextRefId);
            if (match is not null) matchedIds.Add(match.Id);
            rows.Add(new ConsentRequirementDto(
                template.Id,
                template.Title,
                template.RequiresSignature,
                template.SignerRole,
                match?.Id,
                match?.Status,
                match?.SignedAtUtc,
                match?.StationName ?? string.Empty,
                match?.ContextLabel ?? string.Empty,
                template.SourceKind));
        }

        var signed = rows.Count(x => x.Status == ConsentFormStatus.Signed);
        var otherRecords = records
            .Where(x => !matchedIds.Contains(x.Id) && x.Status == ConsentFormStatus.Signed)
            .OrderByDescending(x => x.SignedAtUtc)
            .ToList();
        var otherDocuments = await LoadDocumentMetaAsync(otherRecords.Select(x => x.DocumentId), cancellationToken);
        var others = otherRecords.Select(record => ToFormDto(record, otherDocuments)).ToList();

        return ConsentResult<ConsentStatusDto>.Success(new ConsentStatusDto(
            Complete: signed == rows.Count,
            RequiredCount: rows.Count,
            SignedCount: signed,
            Requirements: rows,
            OtherForms: others,
            StudentProfileId: student.Id,
            StudentName: student.FullName,
            ContextLabel: ContextKinds.FirstOrDefault(x => x.Kind == (contextKind ?? ConsentContextKind.General))?.Label ?? string.Empty));
    }

    public async Task<ConsentResult<ConsentStatusDto>> GetAppointmentStatusAsync(
        Guid appointmentId, CancellationToken cancellationToken = default)
    {
        var appointment = await dbContext.DrivingAppointments.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == appointmentId, cancellationToken);
        if (appointment is null) return ConsentResult<ConsentStatusDto>.Fail(404, "Randevu bulunamadı.");

        var profile = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == appointment.StudentDrivingProfileId, cancellationToken);
        if (profile is null) return ConsentResult<ConsentStatusDto>.Fail(404, "Kursiyer kaydı bulunamadı.");

        return await GetStatusAsync(
            profile.StudentId,
            ConsentContextKind.DrivingLesson,
            profile.PackageId.ToString(),
            appointmentId,
            cancellationToken);
    }

    public async Task<ConsentResult<ConsentFormDto>> CreateFormAsync(
        CreateConsentFormRequest request, Guid? actorUserId, string actorName, CancellationToken cancellationToken = default)
    {
        var template = await dbContext.ConsentFormTemplates.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.TemplateId && !x.IsDeleted, cancellationToken);
        if (template is null) return ConsentResult<ConsentFormDto>.Fail(404, "Form şablonu bulunamadı.");

        var student = await dbContext.Students.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.StudentProfileId, cancellationToken);
        if (student is null) return ConsentResult<ConsentFormDto>.Fail(404, "Öğrenci bulunamadı.");

        var staffName = await ResolveStaffNameAsync(actorUserId, actorName, cancellationToken);
        var contextLabel = Trim(request.ContextLabel, 200);
        if (contextLabel.Length == 0)
        {
            contextLabel = ContextKinds.FirstOrDefault(x => x.Kind == request.ContextKind)?.Label ?? string.Empty;
        }

        var tokens = await BuildTokensAsync(student, contextLabel, staffName, cancellationToken);

        var record = new ConsentFormRecord
        {
            TemplateId = template.Id,
            StudentProfileId = student.Id,
            StudentUserId = student.UserId == Guid.Empty ? null : student.UserId,
            StudentName = student.FullName,
            ContextKind = request.ContextKind,
            ContextKey = Trim(request.ContextKey, 120),
            ContextRefId = request.ContextRefId,
            ContextLabel = contextLabel,
            // Belge gövdesi şablondan KOPYALANIR ve yer tutucular BURADA doldurulur:
            // metni gösteren her yüzey (tablet, PDF, önizleme) aynı hazır metni görsün.
            Title = template.Title,
            // PDF kaynağında kayıt, şablonun O ANKİ belgesine sabitlenir; şablona
            // sonradan başka dosya yüklenmesi imzalanmış kaydı etkilemez.
            SourceKind = template.SourceKind,
            DocumentId = template.DocumentId,
            Body = FillPlaceholders(template.Body, tokens),
            CheckItemsJson = SerializeCheckItems(
                DeserializeCheckItems(template.CheckItemsJson).Select(item => FillPlaceholders(item, tokens)).ToList()),
            RequiresSignature = template.RequiresSignature,
            SignerRole = template.SignerRole,
            StaffUserId = actorUserId,
            StaffName = staffName,
            StaffNotes = Trim(request.StaffNotes, 2000),
            Status = ConsentFormStatus.Draft,
            CreatedByUserId = actorUserId,
        };

        dbContext.ConsentFormRecords.Add(record);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync("consent.form.create", AuditCategory, nameof(ConsentFormRecord),
            record.Id.ToString(), $"{student.FullName} için onam formu açıldı: {record.Title}", cancellationToken);

        return ConsentResult<ConsentFormDto>.Success(await ToFormDtoAsync(record, cancellationToken));
    }

    public async Task<ConsentResult<ConsentFormDto>> UpdateFormAsync(
        Guid id, UpdateConsentFormRequest request, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        var record = await dbContext.ConsentFormRecords.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (record is null) return ConsentResult<ConsentFormDto>.Fail(404, "Onam formu bulunamadı.");
        if (record.Status == ConsentFormStatus.Signed)
        {
            return ConsentResult<ConsentFormDto>.Fail(409, "İmzalanmış form değiştirilemez.");
        }
        if (record.Status == ConsentFormStatus.Cancelled)
        {
            return ConsentResult<ConsentFormDto>.Fail(409, "İptal edilmiş form değiştirilemez.");
        }

        record.StaffNotes = Trim(request.StaffNotes, 2000);
        record.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return ConsentResult<ConsentFormDto>.Success(await ToFormDtoAsync(record, cancellationToken));
    }

    public async Task<ConsentResult<bool>> CancelFormAsync(
        Guid id, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        var record = await dbContext.ConsentFormRecords.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (record is null) return ConsentResult<bool>.Fail(404, "Onam formu bulunamadı.");
        if (record.Status == ConsentFormStatus.Signed)
        {
            return ConsentResult<bool>.Fail(409, "İmzalanmış form iptal edilemez.");
        }

        record.Status = ConsentFormStatus.Cancelled;
        record.SessionToken = null;
        record.SessionExpiresAtUtc = null;
        record.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync("consent.form.cancel", AuditCategory, nameof(ConsentFormRecord),
            id.ToString(), $"Onam formu iptal edildi: {record.Title}", cancellationToken);
        return ConsentResult<bool>.Success(true);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // İmza oturumu
    // ══════════════════════════════════════════════════════════════════════════

    public async Task<ConsentResult<ConsentFormDto>> OpenSessionAsync(
        Guid id, OpenConsentSessionRequest request, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        var record = await dbContext.ConsentFormRecords.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (record is null) return ConsentResult<ConsentFormDto>.Fail(404, "Onam formu bulunamadı.");
        if (record.Status == ConsentFormStatus.Signed)
        {
            return ConsentResult<ConsentFormDto>.Fail(409, "Bu form zaten imzalanmış.");
        }
        if (record.Status == ConsentFormStatus.Cancelled)
        {
            return ConsentResult<ConsentFormDto>.Fail(409, "İptal edilmiş form tablete gönderilemez.");
        }

        var stationName = Trim(request.StationName, 120);
        if (stationName.Length == 0)
        {
            return ConsentResult<ConsentFormDto>.Fail(400, "Tablet adı zorunludur.");
        }

        var stationKey = StationKeyOf(stationName);

        // Aynı tablette bekleyen ESKİ formların oturumu kapatılır. Yoksa sırada
        // kalmış bir form yanlış kişiye imzalatılır.
        var stale = await dbContext.ConsentFormRecords
            .Where(x => x.Id != id
                && x.Status == ConsentFormStatus.AwaitingSignature
                && x.StationKey == stationKey)
            .ToListAsync(cancellationToken);
        foreach (var item in stale)
        {
            item.Status = ConsentFormStatus.Draft;
            item.SessionToken = null;
            item.SessionExpiresAtUtc = null;
            item.UpdatedAtUtc = DateTime.UtcNow;
        }

        var minutes = request.ExpiresInMinutes is > 0 and <= 480 ? request.ExpiresInMinutes.Value : DefaultSessionMinutes;
        record.Status = ConsentFormStatus.AwaitingSignature;
        record.SessionToken = Guid.NewGuid();
        record.StationName = stationName;
        record.StationKey = stationKey;
        record.SessionExpiresAtUtc = DateTime.UtcNow.AddMinutes(minutes);
        record.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync("consent.form.dispatch", AuditCategory, nameof(ConsentFormRecord),
            id.ToString(), $"Onam formu \"{stationName}\" tabletine aktarıldı: {record.Title}", cancellationToken);

        return ConsentResult<ConsentFormDto>.Success(await ToFormDtoAsync(record, cancellationToken));
    }

    public async Task<ConsentResult<ConsentFormDto>> RevokeSessionAsync(
        Guid id, Guid? actorUserId, CancellationToken cancellationToken = default)
    {
        var record = await dbContext.ConsentFormRecords.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (record is null) return ConsentResult<ConsentFormDto>.Fail(404, "Onam formu bulunamadı.");
        if (record.Status == ConsentFormStatus.Signed)
        {
            return ConsentResult<ConsentFormDto>.Fail(409, "İmzalanmış formun gönderimi geri alınamaz.");
        }

        record.Status = ConsentFormStatus.Draft;
        record.SessionToken = null;
        record.SessionExpiresAtUtc = null;
        record.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return ConsentResult<ConsentFormDto>.Success(await ToFormDtoAsync(record, cancellationToken));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Tablet
    // ══════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Tabletin yoklaması. Tablet yalnız KENDİ adına gönderilen formu görür;
    /// aynı çağrı istasyonu "çevrimiçi" olarak da işaretler (personel ekranında
    /// açık tabletlerin listesi bu bilgiyle çizilir).
    /// </summary>
    public async Task<ConsentResult<ConsentStationFormDto?>> PollStationAsync(
        string? stationName, string? deviceInfo, CancellationToken cancellationToken = default)
    {
        var name = Trim(stationName, 120);
        if (name.Length == 0) return ConsentResult<ConsentStationFormDto?>.Fail(400, "Tablet adı zorunludur.");

        var key = StationKeyOf(name);
        await TouchStationAsync(name, key, deviceInfo, cancellationToken);

        var now = DateTime.UtcNow;
        var record = await dbContext.ConsentFormRecords
            .Where(x => x.Status == ConsentFormStatus.AwaitingSignature && x.StationKey == key)
            .OrderBy(x => x.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (record is null || record.SessionToken is not Guid token)
        {
            return ConsentResult<ConsentStationFormDto?>.Success(null);
        }

        // Süresi dolmuş oturum tablete hiç düşmez; taslağa geri alınır.
        if (record.SessionExpiresAtUtc is DateTime expiry && expiry <= now)
        {
            record.Status = ConsentFormStatus.Draft;
            record.SessionToken = null;
            record.SessionExpiresAtUtc = null;
            record.UpdatedAtUtc = now;
            await dbContext.SaveChangesAsync(cancellationToken);
            return ConsentResult<ConsentStationFormDto?>.Success(null);
        }

        var documents = await LoadDocumentMetaAsync([record.DocumentId], cancellationToken);
        var document = Document(record.DocumentId, documents);

        return ConsentResult<ConsentStationFormDto?>.Success(new ConsentStationFormDto(
            record.Id,
            token,
            record.Title,
            record.Body,
            DeserializeCheckItems(record.CheckItemsJson),
            record.RequiresSignature,
            record.SignerRole,
            record.StudentName,
            record.ContextLabel,
            record.StaffName,
            record.StaffNotes,
            record.SessionExpiresAtUtc,
            record.SourceKind,
            document.FileName,
            document.PageCount));
    }

    public async Task<IReadOnlyList<ConsentStationDto>> ListStationsAsync(CancellationToken cancellationToken = default)
    {
        var stations = await dbContext.ConsentSignatureStations.AsNoTracking()
            .OrderByDescending(x => x.LastSeenAtUtc)
            .ToListAsync(cancellationToken);

        var pendingKeys = await dbContext.ConsentFormRecords.AsNoTracking()
            .Where(x => x.Status == ConsentFormStatus.AwaitingSignature)
            .Select(x => x.StationKey)
            .Distinct()
            .ToListAsync(cancellationToken);

        var threshold = DateTime.UtcNow - StationOnlineWindow;
        return stations.Select(x => new ConsentStationDto(
            x.Id,
            x.Name,
            x.LastSeenAtUtc >= threshold,
            x.LastSeenAtUtc,
            pendingKeys.Contains(x.StationKey))).ToList();
    }

    /// <summary>
    /// İmzalama. Doğrulamalar SUNUCUDA yapılır — istemci doğrulaması yeterli değildir.
    /// Başarıda oturum anahtarı silinir; aynı bağlantı ikinci kez çalışmaz.
    /// </summary>
    public async Task<ConsentResult<ConsentFormDto>> SignAsync(
        Guid sessionToken, SignConsentFormRequest request, string? device, string? ip,
        CancellationToken cancellationToken = default)
    {
        var record = await dbContext.ConsentFormRecords
            .FirstOrDefaultAsync(x => x.SessionToken == sessionToken, cancellationToken);
        // Kullanılmış/silinmiş anahtar → 404. Kayıt "var mı yok mu" bilgisi sızmaz.
        if (record is null) return ConsentResult<ConsentFormDto>.Fail(404, "İmza oturumu bulunamadı veya kullanılmış.");

        if (record.Status != ConsentFormStatus.AwaitingSignature)
        {
            return ConsentResult<ConsentFormDto>.Fail(409, "Bu form imza bekleyen durumda değil.");
        }
        if (record.SessionExpiresAtUtc is DateTime expiry && expiry <= DateTime.UtcNow)
        {
            return ConsentResult<ConsentFormDto>.Fail(409, "İmza oturumunun süresi dolmuş. Formu tablete yeniden gönderin.");
        }

        var items = DeserializeCheckItems(record.CheckItemsJson);
        var checkedItems = (request.CheckedItems ?? []).Where(i => i >= 0 && i < items.Count).Distinct().OrderBy(i => i).ToList();
        var missing = Enumerable.Range(0, items.Count).Except(checkedItems).ToList();
        if (missing.Count > 0)
        {
            var detail = string.Join(" · ", missing.Take(3).Select(i => items[i]));
            return ConsentResult<ConsentFormDto>.Fail(400,
                $"Tüm onay maddeleri işaretlenmeden imza alınamaz. Eksik {missing.Count} madde: {detail}");
        }

        var signature = (request.SignatureImage ?? string.Empty).Trim();
        if (record.RequiresSignature)
        {
            if (!IsInlinePng(signature))
            {
                return ConsentResult<ConsentFormDto>.Fail(409, "Bu form imza gerektiriyor; imza alanı boş bırakılamaz.");
            }
        }
        else
        {
            signature = string.Empty;
        }

        var signerName = Trim(request.SignerName, 150);
        if (signerName.Length == 0) signerName = record.StudentName;

        record.CheckedItemsJson = JsonSerializer.Serialize(checkedItems);
        record.SignatureImage = signature;
        record.SignerName = signerName;
        record.SignerRelation = Trim(request.SignerRelation, 60);
        record.SignerDevice = Trim(device, 250);
        record.SignerIp = Trim(ip, 64);
        record.SignedAtUtc = DateTime.UtcNow;
        record.Status = ConsentFormStatus.Signed;
        // Tek kullanımlık: anahtar burada ölür.
        record.SessionToken = null;
        record.SessionExpiresAtUtc = null;
        record.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync(record.StaffUserId, record.StaffName, "consent.form.sign", AuditCategory,
            nameof(ConsentFormRecord), record.Id.ToString(),
            $"{record.StudentName} — \"{record.Title}\" formu {signerName} tarafından imzalandı ({record.StationName}).",
            cancellationToken);

        return ConsentResult<ConsentFormDto>.Success(await ToFormDtoAsync(record, cancellationToken));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Yardımcılar
    // ══════════════════════════════════════════════════════════════════════════

    /// <summary>
    /// Baş/son boşluk ve büyük-küçük harf farkı tolere edilir ("kabin 1" = "KABIN 1").
    /// Ortadaki boşluk farkı bilerek korunur: "Kabin1" ≠ "Kabin 1" bir yazım hatasıdır
    /// ve sessizce eşleşmemesi, yanlış tablete düşmesinden iyidir.
    /// </summary>
    private static string StationKeyOf(string name) => name.Trim().ToLower(Tr);

    private async Task TouchStationAsync(string name, string key, string? deviceInfo, CancellationToken cancellationToken)
    {
        var station = await dbContext.ConsentSignatureStations
            .FirstOrDefaultAsync(x => x.StationKey == key, cancellationToken);
        if (station is null)
        {
            station = new ConsentSignatureStation { Name = name, StationKey = key };
            dbContext.ConsentSignatureStations.Add(station);
        }

        station.Name = name;
        station.DeviceInfo = Trim(deviceInfo, 250);
        station.LastSeenAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<List<(ConsentFormTemplate Template, ConsentContextKind Kind)>> ResolveRequirementsAsync(
        List<ConsentContextKind> kinds, string contextKey, CancellationToken cancellationToken)
    {
        var bindings = await dbContext.ConsentFormRequirements.AsNoTracking()
            .Where(x => kinds.Contains(x.ContextKind))
            .ToListAsync(cancellationToken);

        // Boş ContextKey = türün tamamı; dolu anahtar yalnız kendi kaydına uyar.
        bindings = bindings
            .Where(x => x.ContextKey.Length == 0
                || string.Equals(x.ContextKey, contextKey, StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (bindings.Count == 0) return [];

        var templateIds = bindings.Select(x => x.TemplateId).Distinct().ToList();
        var templates = await dbContext.ConsentFormTemplates.AsNoTracking()
            .Where(x => templateIds.Contains(x.Id) && x.IsActive && !x.IsDeleted)
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Title)
            .ToListAsync(cancellationToken);

        var kindByTemplate = bindings
            .GroupBy(x => x.TemplateId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.ContextKind).Min());

        return templates
            .Select(t => (t, kindByTemplate.TryGetValue(t.Id, out var kind) ? kind : ConsentContextKind.General))
            .ToList();
    }

    /// <summary>
    /// Gerekliliğe karşılık gelen kaydı seçer. Bağlam kimliği verilmişse (randevu,
    /// sözleşme) önce ona bağlı kayıt aranır; yoksa genel/bağlamsız kayda düşülür —
    /// böylece "her öğrenciden bir kez" formları her randevuda yeniden istenmez.
    /// </summary>
    private static ConsentFormRecord? PickMatch(
        List<ConsentFormRecord> records, Guid templateId, ConsentContextKind kind, Guid? contextRefId)
    {
        var candidates = records.Where(x => x.TemplateId == templateId && x.ContextKind == kind).ToList();
        if (candidates.Count == 0) return null;

        if (contextRefId is Guid refId && kind != ConsentContextKind.General)
        {
            var scoped = candidates.Where(x => x.ContextRefId == refId).ToList();
            if (scoped.Count > 0) return Best(scoped);
        }

        return Best(candidates);

        static ConsentFormRecord Best(List<ConsentFormRecord> list) =>
            list.OrderByDescending(x => x.Status == ConsentFormStatus.Signed)
                .ThenByDescending(x => x.SignedAtUtc ?? x.CreatedAtUtc)
                .First();
    }

    /// <summary>
    /// Belgeye basılacak personel adı: personel kaydı → kullanıcı adı soyadı → boş.
    /// E-posta ASLA basılmaz; ad çözülemezse alan boş bırakılır.
    /// </summary>
    private async Task<string> ResolveStaffNameAsync(Guid? actorUserId, string actorName, CancellationToken cancellationToken)
    {
        if (actorUserId is Guid userId)
        {
            var staffName = await dbContext.Staff.AsNoTracking()
                .Where(x => x.UserId == userId).Select(x => x.FullName).FirstOrDefaultAsync(cancellationToken);
            if (IsPersonName(staffName)) return staffName!.Trim();

            var userName = await dbContext.Users.AsNoTracking()
                .Where(x => x.Id == userId).Select(x => x.FullName).FirstOrDefaultAsync(cancellationToken);
            if (IsPersonName(userName)) return userName!.Trim();
        }

        return IsPersonName(actorName) ? actorName.Trim() : string.Empty;
    }

    private static bool IsPersonName(string? value) =>
        !string.IsNullOrWhiteSpace(value) && !value.Contains('@');

    /// <summary>
    /// Yer tutucu sözlüğü. Karşılığı olmayan alan noktalı boşlukla basılır ki
    /// belge elde tamamlanabilsin — asla "{{...}}" hâliyle kalmaz.
    /// </summary>
    private async Task<Dictionary<string, string>> BuildTokensAsync(
        StudentProfile student, string contextLabel, string staffName, CancellationToken cancellationToken)
    {
        var institution = await institutionProfileService.GetEffectiveAsync(cancellationToken);
        var driving = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.StudentId == student.Id)
            .Select(x => new { x.LicenseClass, x.StudentNumber, x.Phone, x.IdentityNumber })
            .FirstOrDefaultAsync(cancellationToken);

        var studentNumber = student.SchoolNumber;
        if (string.IsNullOrWhiteSpace(studentNumber) && driving is not null && driving.StudentNumber > 0)
        {
            studentNumber = driving.StudentNumber.ToString(CultureInfo.InvariantCulture);
        }

        var identity = string.IsNullOrWhiteSpace(student.TcNo) ? driving?.IdentityNumber : student.TcNo;
        var classOrLicense = string.IsNullOrWhiteSpace(student.ClassName)
            ? (driving is null ? string.Empty : $"{driving.LicenseClass} sınıfı")
            : student.ClassName;
        var phone = string.IsNullOrWhiteSpace(student.ParentPhone) ? driving?.Phone : student.ParentPhone;

        var tokens = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["ogrenci"] = student.FullName,
            ["kursiyer"] = student.FullName,
            ["musteri"] = student.FullName,
            ["veli"] = student.ParentName,
            ["tc"] = identity ?? string.Empty,
            ["kimlik"] = identity ?? string.Empty,
            ["sinif"] = classOrLicense,
            ["ogrencino"] = studentNumber,
            ["dogumtarihi"] = student.BirthDate,
            ["telefon"] = phone ?? string.Empty,
            ["adres"] = student.Address,
            ["kurum"] = institution.Name,
            ["personel"] = staffName,
            ["konu"] = contextLabel,
            ["hizmet"] = contextLabel,
            ["tarih"] = DateTime.Now.ToString("dd.MM.yyyy", Tr),
        };
        return tokens;
    }

    private static string FillPlaceholders(string text, Dictionary<string, string> tokens)
    {
        if (string.IsNullOrEmpty(text) || !text.Contains("{{", StringComparison.Ordinal)) return text;

        var builder = new System.Text.StringBuilder(text.Length);
        var index = 0;
        while (index < text.Length)
        {
            var open = text.IndexOf("{{", index, StringComparison.Ordinal);
            if (open < 0) { builder.Append(text, index, text.Length - index); break; }

            var close = text.IndexOf("}}", open + 2, StringComparison.Ordinal);
            if (close < 0) { builder.Append(text, index, text.Length - index); break; }

            builder.Append(text, index, open - index);
            var name = text[(open + 2)..close].Trim();
            var value = tokens.TryGetValue(name, out var resolved) ? resolved?.Trim() ?? string.Empty : string.Empty;
            builder.Append(value.Length > 0 ? value : BlankFill);
            index = close + 2;
        }
        return builder.ToString();
    }

    private void ReplaceBindings(
        Guid templateId, IReadOnlyList<ConsentTemplateBindingDto>? requested, List<ConsentFormRequirement> existing)
    {
        dbContext.ConsentFormRequirements.RemoveRange(existing);
        foreach (var binding in (requested ?? []).DistinctBy(x => (x.ContextKind, Key: Trim(x.ContextKey, 120))))
        {
            dbContext.ConsentFormRequirements.Add(new ConsentFormRequirement
            {
                TemplateId = templateId,
                ContextKind = binding.ContextKind,
                ContextKey = Trim(binding.ContextKey, 120),
            });
        }
    }

    private static ConsentTemplateDto ToTemplateDto(
        ConsentFormTemplate template,
        List<ConsentFormRequirement> bindings,
        Dictionary<Guid, (string FileName, int PageCount)> documents)
    {
        var document = Document(template.DocumentId, documents);
        return new ConsentTemplateDto(template.Id,
            template.Title,
            template.Body,
            DeserializeCheckItems(template.CheckItemsJson),
            template.RequiresSignature,
            template.SignerRole,
            template.IsActive,
            template.SortOrder,
            bindings.Where(x => x.TemplateId == template.Id)
                .Select(x => new ConsentTemplateBindingDto(x.ContextKind, x.ContextKey)).ToList(),
            template.UpdatedAtUtc,
            template.SourceKind,
            template.DocumentId,
            document.FileName,
            document.PageCount);
    }

    /// <summary>DTO imza görselini ve PDF içeriğini TAŞIMAZ: liste yanıtları
    /// base64/bayt yüküyle şişmesin. İkisi de yalnız kendi uçlarında okunur.</summary>
    private static ConsentFormDto ToFormDto(
        ConsentFormRecord record, Dictionary<Guid, (string FileName, int PageCount)>? documents = null)
    {
        var document = Document(record.DocumentId, documents ?? []);
        return new ConsentFormDto(record.Id,
            record.TemplateId,
            record.StudentProfileId,
            record.StudentName,
            record.ContextKind,
            record.ContextKey,
            record.ContextRefId,
            record.ContextLabel,
            record.Title,
            record.Body,
            DeserializeCheckItems(record.CheckItemsJson),
            DeserializeCheckedItems(record.CheckedItemsJson),
            record.RequiresSignature,
            record.SignerRole,
            record.StaffName,
            record.StaffNotes,
            record.Status,
            record.StationName,
            record.SessionExpiresAtUtc,
            record.SignatureImage.Length > 0,
            record.SignedAtUtc,
            record.SignerName,
            record.SignerRelation,
            record.CreatedAtUtc,
            record.SourceKind,
            record.DocumentId,
            document.FileName,
            document.PageCount);
    }

    /// <summary>Tek kayıt dönerken belge künyesi de doldurulur; ekran PDF rozetini
    /// ilk yanıtta gösterebilsin.</summary>
    private async Task<ConsentFormDto> ToFormDtoAsync(ConsentFormRecord record, CancellationToken cancellationToken)
    {
        if (record.DocumentId is null) return ToFormDto(record);
        return ToFormDto(record, await LoadDocumentMetaAsync([record.DocumentId], cancellationToken));
    }

    private static (string FileName, int PageCount) Document(
        Guid? documentId, Dictionary<Guid, (string FileName, int PageCount)> documents) =>
        documentId is Guid id && documents.TryGetValue(id, out var meta) ? meta : (string.Empty, 0);

    private static ConsentDocumentDto ToDocumentDto(ConsentDocument document) =>
        new(document.Id, document.FileName, document.PageCount, document.ByteSize, document.Sha256, document.CreatedAtUtc);

    /// <summary>Yol bileşenlerini atar; künyeye yalnız dosya adı yazılır.</summary>
    private static string SafeFileName(string? fileName)
    {
        var name = Path.GetFileName((fileName ?? string.Empty).Replace('\\', '/').Trim());
        if (name.Length == 0) return "belge.pdf";
        return name.Length <= 260 ? name : name[..260];
    }

    internal static List<string> DeserializeCheckItems(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json)?
                .Select(x => (x ?? string.Empty).Trim())
                .Where(x => x.Length > 0)
                .ToList() ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    internal static List<int> DeserializeCheckedItems(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<int>>(json) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static string SerializeCheckItems(IReadOnlyList<string>? items) =>
        JsonSerializer.Serialize((items ?? [])
            .Select(x => (x ?? string.Empty).Trim())
            .Where(x => x.Length > 0)
            .Take(40)
            .ToList());

    /// <summary>İmza görseli yalnız gömülü PNG kabul eder; dış adres saklanmaz.</summary>
    private static bool IsInlinePng(string value) =>
        value.StartsWith("data:image/png;base64,", StringComparison.OrdinalIgnoreCase)
        && value.Length > "data:image/png;base64,".Length + 100;

    private static string Trim(string? value, int max)
    {
        var text = (value ?? string.Empty).Trim();
        return text.Length <= max ? text : text[..max];
    }
}
