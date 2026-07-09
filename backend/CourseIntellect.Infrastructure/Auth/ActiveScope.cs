using CourseIntellect.Application.Interfaces;

namespace CourseIntellect.Infrastructure.Auth;

/// <summary>
/// <see cref="IActiveScope"/>'un scoped, değiştirilebilir holder implementasyonu.
/// Middleware istek başına bir kez <see cref="Set"/> ile doldurur.
/// </summary>
public sealed class ActiveScope : IActiveScope
{
    public bool IsResolved { get; private set; }
    public Guid? TenantId { get; private set; }
    public Guid? BranchId { get; private set; }

    public void Set(Guid? tenantId, Guid? branchId)
    {
        TenantId = tenantId;
        BranchId = branchId;
        IsResolved = true;
    }
}
