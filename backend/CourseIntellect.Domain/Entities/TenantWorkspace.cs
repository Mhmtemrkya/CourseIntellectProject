namespace CourseIntellect.Domain.Entities;

public sealed class TenantWorkspace
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;
    public string Plan { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int UserCount { get; set; }
    public int BranchCount { get; set; }
    public int StudentCount { get; set; }
    public int StaffCount { get; set; }
    public decimal MonthlyFee { get; set; }
    public decimal CollectedAmount { get; set; }
    public decimal StorageUsedGb { get; set; }
    public int ApiUsage { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
