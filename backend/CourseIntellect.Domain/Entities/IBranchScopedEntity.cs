namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Tenant'ın yanı sıra şube (branch) bazında da izole edilen entity'ler.
/// BranchId, bir OrgUnit (şube/kampüs) kimliğine işaret eder.
/// </summary>
public interface IBranchScopedEntity : ITenantScopedEntity
{
    Guid? BranchId { get; set; }
}
