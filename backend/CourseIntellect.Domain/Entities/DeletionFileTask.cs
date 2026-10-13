namespace CourseIntellect.Domain.Entities;

/// <summary>Durable upload cleanup. Removed only after an idempotent physical delete succeeds.</summary>
public sealed class DeletionFileTask : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string OperationKey { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
}
