namespace CourseIntellect.Domain.Entities;

public interface ITenantScopedEntity
{
    Guid? TenantId { get; set; }
}
