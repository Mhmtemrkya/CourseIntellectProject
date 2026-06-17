namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Personele zimmetlenen demirbaş/ekipman kaydı.
/// </summary>
public sealed class StaffAssetAssignment : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? StaffUserId { get; set; }
    public string StaffName { get; set; } = string.Empty;
    public string AssetName { get; set; } = string.Empty;
    public string AssetCode { get; set; } = string.Empty;
    public string Status { get; set; } = "Assigned";
    public string Note { get; set; } = string.Empty;
    public DateTime AssignedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ReturnedAtUtc { get; set; }
}
