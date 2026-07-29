using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Servis sonucu. Proje genelinde ortak bir Result tipi olmadığı için onam
/// modülü kendi taşıyıcısını kullanır: iş kuralı ihlalleri istisna yerine
/// HTTP karşılığıyla döner, böylece kurallar controller'sız test edilebilir.
/// </summary>
public sealed record ConsentResult<T>(int StatusCode, string Message, T? Value)
{
    public bool Ok => StatusCode is >= 200 and < 300;

    public static ConsentResult<T> Success(T value) => new(200, string.Empty, value);
    public static ConsentResult<T> Fail(int statusCode, string message) => new(statusCode, message, default);
}

// ─── Yüklenen belge ───────────────────────────────────────────────────────────

/// <summary>Yüklenmiş PDF'in künyesi. İçerik bu DTO ile TAŞINMAZ.</summary>
public sealed record ConsentDocumentDto(
    Guid Id,
    string FileName,
    int PageCount,
    int ByteSize,
    string Sha256,
    DateTime CreatedAtUtc);

/// <summary>İndirme yolunun okuduğu ham içerik.</summary>
public sealed record ConsentDocumentContent(string FileName, string Sha256, int PageCount, byte[] Content);

// ─── Şablon ───────────────────────────────────────────────────────────────────

public sealed record ConsentTemplateBindingDto(ConsentContextKind ContextKind, string ContextKey);

public sealed record ConsentTemplateDto(
    Guid Id,
    string Title,
    string Body,
    IReadOnlyList<string> CheckItems,
    bool RequiresSignature,
    ConsentSignerRole SignerRole,
    bool IsActive,
    int SortOrder,
    IReadOnlyList<ConsentTemplateBindingDto> Bindings,
    DateTime UpdatedAtUtc,
    ConsentDocumentSource SourceKind = ConsentDocumentSource.Text,
    Guid? DocumentId = null,
    string DocumentFileName = "",
    int DocumentPageCount = 0);

public sealed record SaveConsentTemplateRequest(
    string? Title,
    string? Body,
    IReadOnlyList<string>? CheckItems,
    bool RequiresSignature,
    ConsentSignerRole SignerRole,
    bool IsActive,
    int SortOrder,
    IReadOnlyList<ConsentTemplateBindingDto>? Bindings,
    ConsentDocumentSource SourceKind = ConsentDocumentSource.Text,
    Guid? DocumentId = null);

// ─── Kayıt ────────────────────────────────────────────────────────────────────

public sealed record ConsentFormDto(
    Guid Id,
    Guid? TemplateId,
    Guid StudentProfileId,
    string StudentName,
    ConsentContextKind ContextKind,
    string ContextKey,
    Guid? ContextRefId,
    string ContextLabel,
    string Title,
    string Body,
    IReadOnlyList<string> CheckItems,
    IReadOnlyList<int> CheckedItems,
    bool RequiresSignature,
    ConsentSignerRole SignerRole,
    string StaffName,
    string StaffNotes,
    ConsentFormStatus Status,
    string StationName,
    DateTime? SessionExpiresAtUtc,
    bool HasSignature,
    DateTime? SignedAtUtc,
    string SignerName,
    string SignerRelation,
    DateTime CreatedAtUtc,
    ConsentDocumentSource SourceKind = ConsentDocumentSource.Text,
    Guid? DocumentId = null,
    string DocumentFileName = "",
    int DocumentPageCount = 0);

/// <summary>Tabletin gördüğü form — imza görselini ve oturum anahtarını taşır.</summary>
public sealed record ConsentStationFormDto(
    Guid Id,
    Guid SessionToken,
    string Title,
    string Body,
    IReadOnlyList<string> CheckItems,
    bool RequiresSignature,
    ConsentSignerRole SignerRole,
    string StudentName,
    string ContextLabel,
    string StaffName,
    string StaffNotes,
    DateTime? SessionExpiresAtUtc,
    ConsentDocumentSource SourceKind = ConsentDocumentSource.Text,
    string DocumentFileName = "",
    int DocumentPageCount = 0);

public sealed record CreateConsentFormRequest(
    Guid TemplateId,
    Guid StudentProfileId,
    ConsentContextKind ContextKind,
    string? ContextKey,
    Guid? ContextRefId,
    string? ContextLabel,
    string? StaffNotes);

public sealed record UpdateConsentFormRequest(string? StaffNotes);

public sealed record OpenConsentSessionRequest(string? StationName, int? ExpiresInMinutes);

public sealed record SignConsentFormRequest(
    IReadOnlyList<int>? CheckedItems,
    string? SignatureImage,
    string? SignerName,
    string? SignerRelation);

// ─── Durum özeti ──────────────────────────────────────────────────────────────

public sealed record ConsentRequirementDto(
    Guid TemplateId,
    string Title,
    bool RequiresSignature,
    ConsentSignerRole SignerRole,
    Guid? FormId,
    ConsentFormStatus? Status,
    DateTime? SignedAtUtc,
    string StationName,
    string ContextLabel,
    ConsentDocumentSource SourceKind = ConsentDocumentSource.Text);

public sealed record ConsentStatusDto(
    bool Complete,
    int RequiredCount,
    int SignedCount,
    IReadOnlyList<ConsentRequirementDto> Requirements,
    IReadOnlyList<ConsentFormDto> OtherForms,
    /// <summary>Randevu üzerinden sorulduğunda ekran Onam Merkezi'ni bu kimlikle açar.</summary>
    Guid StudentProfileId = default,
    string StudentName = "",
    string ContextLabel = "");

// ─── İstasyon (tablet) ────────────────────────────────────────────────────────

public sealed record ConsentStationDto(
    Guid Id,
    string Name,
    bool Online,
    DateTime LastSeenAtUtc,
    bool HasPendingForm);

// ─── Katalog ──────────────────────────────────────────────────────────────────

public sealed record ConsentContextKindDto(
    ConsentContextKind Kind,
    string Label,
    string Description,
    string Module);

public interface IConsentFormService
{
    // Yüklenen PDF belgeleri
    /// <summary>
    /// PDF'i doğrulayıp saklar. Aynı içerik daha önce yüklendiyse yeni satır
    /// açılmaz, var olan kaydın künyesi döner.
    /// </summary>
    Task<ConsentResult<ConsentDocumentDto>> SaveDocumentAsync(
        byte[] content, string? fileName, Guid? actorUserId, CancellationToken cancellationToken = default);

    Task<ConsentResult<ConsentDocumentContent>> GetDocumentAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Kaydın imzalandığı (veya imzalanacağı) özgün PDF. Metin kaynaklı kayıtta 404.</summary>
    Task<ConsentResult<ConsentDocumentContent>> GetFormDocumentAsync(Guid formId, CancellationToken cancellationToken = default);

    // Şablon yönetimi
    Task<IReadOnlyList<ConsentTemplateDto>> ListTemplatesAsync(bool includeInactive, CancellationToken cancellationToken = default);
    Task<ConsentResult<ConsentTemplateDto>> CreateTemplateAsync(SaveConsentTemplateRequest request, Guid? actorUserId, CancellationToken cancellationToken = default);
    Task<ConsentResult<ConsentTemplateDto>> UpdateTemplateAsync(Guid id, SaveConsentTemplateRequest request, Guid? actorUserId, CancellationToken cancellationToken = default);
    Task<ConsentResult<bool>> DeleteTemplateAsync(Guid id, Guid? actorUserId, CancellationToken cancellationToken = default);
    Task<ConsentResult<ConsentTemplateDto>> GetTemplateAsync(Guid id, CancellationToken cancellationToken = default);

    // Öğrenci kayıtları
    Task<IReadOnlyList<ConsentFormDto>> ListStudentFormsAsync(Guid studentProfileId, CancellationToken cancellationToken = default);
    Task<ConsentResult<ConsentStatusDto>> GetStatusAsync(
        Guid studentProfileId,
        ConsentContextKind? contextKind,
        string? contextKey,
        Guid? contextRefId,
        CancellationToken cancellationToken = default);
    Task<ConsentResult<ConsentStatusDto>> GetAppointmentStatusAsync(Guid appointmentId, CancellationToken cancellationToken = default);

    Task<ConsentResult<ConsentFormDto>> CreateFormAsync(CreateConsentFormRequest request, Guid? actorUserId, string actorName, CancellationToken cancellationToken = default);
    Task<ConsentResult<ConsentFormDto>> UpdateFormAsync(Guid id, UpdateConsentFormRequest request, Guid? actorUserId, CancellationToken cancellationToken = default);
    Task<ConsentResult<bool>> CancelFormAsync(Guid id, Guid? actorUserId, CancellationToken cancellationToken = default);
    Task<ConsentResult<ConsentFormDto>> GetFormAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>İmza görselinin base64 PNG hâli. Liste/DTO yanıtları bu yükü taşımaz;
    /// yalnız PDF üretimi okur.</summary>
    Task<string> GetSignatureImageAsync(Guid id, CancellationToken cancellationToken = default);

    // İmza oturumu
    Task<ConsentResult<ConsentFormDto>> OpenSessionAsync(Guid id, OpenConsentSessionRequest request, Guid? actorUserId, CancellationToken cancellationToken = default);
    Task<ConsentResult<ConsentFormDto>> RevokeSessionAsync(Guid id, Guid? actorUserId, CancellationToken cancellationToken = default);

    // Tablet
    Task<ConsentResult<ConsentStationFormDto?>> PollStationAsync(string? stationName, string? deviceInfo, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ConsentStationDto>> ListStationsAsync(CancellationToken cancellationToken = default);
    Task<ConsentResult<ConsentFormDto>> SignAsync(Guid sessionToken, SignConsentFormRequest request, string? device, string? ip, CancellationToken cancellationToken = default);

    IReadOnlyList<ConsentContextKindDto> ContextKinds { get; }
}
