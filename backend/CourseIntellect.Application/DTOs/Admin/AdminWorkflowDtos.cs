namespace CourseIntellect.Application.DTOs.Admin;

public sealed record CreateApprovalRequest(
    string Category,
    string Title,
    string? Description,
    decimal? Amount,
    string? Priority,
    string? Unit,
    string? ReferenceType,
    string? ReferenceKey);

public sealed record ApprovalDecisionRequest(string Status, string? Note);

public sealed record ApprovalRequestDto(
    Guid Id,
    string Category,
    string Title,
    string Description,
    string RequesterName,
    string Unit,
    decimal? Amount,
    string Priority,
    string Status,
    string DecisionNote,
    string DecidedByName,
    string ReferenceType,
    string ReferenceKey,
    DateTime CreatedAtUtc,
    DateTime? DecidedAtUtc);

public sealed record AuditLogDto(
    Guid Id,
    string ActorName,
    string Action,
    string Category,
    string EntityType,
    string EntityId,
    string Detail,
    DateTime CreatedAtUtc,
    Guid? BranchId = null,
    string BranchName = "",
    /// <summary>İsteğin geldiği IP. Eski kayıtlarda boş olabilir.</summary>
    string? IpAddress = null,
    /// <summary>Ham User-Agent. Cihaz adına çevirme istemci tarafında yapılır.</summary>
    string? UserAgent = null,
    /// <summary>İşlemi yapanın olay anındaki rolü. Bu alan eklenmeden önceki kayıtlarda boş.</summary>
    string? ActorRole = null,
    /// <summary>Kaydın kaynağı: <c>Action</c> (idari işlem) veya <c>Login</c> (giriş denemesi).</summary>
    string Source = AuditLogSources.Action,
    /// <summary>Yalnız giriş kayıtlarında dolar: deneme başarılı mıydı?</summary>
    bool? Success = null);

/// <summary>Kayıt geçmişindeki satırın hangi tablodan geldiği.</summary>
public static class AuditLogSources
{
    public const string Action = "Action";
    public const string Login = "Login";
    /// <summary>Sorgu filtresinde "ikisi de" anlamına gelir.</summary>
    public const string All = "All";
}

/// <summary>Sayfalanmış denetim kaydı sonucu (toplam sayıyla birlikte).</summary>
public sealed record AuditLogPageDto(
    IReadOnlyList<AuditLogDto> Items,
    int TotalCount,
    int Skip,
    int Take);

/// <summary>Denetim kayıtlarında gelişmiş filtre seçenekleri.</summary>
public sealed record AuditLogQuery(
    string? Category = null,
    Guid? BranchId = null,
    string? Search = null,
    DateTime? FromUtc = null,
    DateTime? ToUtc = null,
    int Skip = 0,
    int Take = 100,
    /// <summary>Hangi kaynak listelensin: <c>All</c>, <c>Action</c> veya <c>Login</c>.</summary>
    string Source = AuditLogSources.All,
    /// <summary>
    /// Yalnız başarısız giriş denemelerini getir. İdari işlemlerin başarı/başarısızlık
    /// kavramı olmadığı için bu filtre kaynağı zorunlu olarak girişlere daraltır.
    /// </summary>
    bool OnlyFailedLogins = false,
    /// <summary>Belirli bir kişinin hareketleri (ad veya giriş e-postası, kısmi eşleşme).</summary>
    string? Actor = null);

/// <summary>Şube bazında denetim kaydı özeti (kurum yöneticisi görünümü).</summary>
public sealed record AuditBranchSummaryDto(
    Guid? BranchId,
    string BranchName,
    int TotalCount,
    int Last7DaysCount,
    DateTime? LastActivityUtc);
