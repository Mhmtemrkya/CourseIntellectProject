namespace CourseIntellect.Domain.Entities;

/// <summary>
/// İdari evrak / doküman kaydı: gelen-giden evrak defteri ve kurumsal belgeler
/// (sözleşme, politika vb.) — dosya, sayı/tarih, son kullanma ve durum bilgisiyle.
/// </summary>
public sealed class AdminDocument : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Category { get; set; } = "Genel";
    public string Direction { get; set; } = "Internal";
    public string DocumentNo { get; set; } = string.Empty;
    public string RelatedParty { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public string Status { get; set; } = "Active";
    public string Note { get; set; } = string.Empty;
    public Guid? UploadedByUserId { get; set; }
    public string UploadedByName { get; set; } = string.Empty;
    public DateTime? ExpiryDateUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
