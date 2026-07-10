namespace CourseIntellect.Application.DTOs.Scope;

/// <summary>Context switcher'ın veri kaynağı: kullanıcının erişebildiği kurum/şube ağacı
/// + o an aktif bağlam + yetenek bayrakları.</summary>
public sealed record MyScopeResponse(
    bool CanSwitchTenant,
    bool CanSwitchBranch,
    bool ReadOnly,
    bool CanManageScopes,
    ScopeActiveDto Active,
    IReadOnlyList<ScopeTenantDto> Tenants);

public sealed record ScopeActiveDto(Guid? TenantId, Guid? BranchId);

public sealed record ScopeTenantDto(Guid Id, string Name, IReadOnlyList<ScopeBranchDto> Branches);

public sealed record ScopeBranchDto(Guid Id, string Name);

/// <summary>Servisin ürettiği ham seçenekler; controller buna aktif bağlamı ekleyip
/// <see cref="MyScopeResponse"/>'a dönüştürür.</summary>
public sealed record UserScopeOptions(bool ReadOnly, IReadOnlyList<ScopeTenantDto> Tenants);
