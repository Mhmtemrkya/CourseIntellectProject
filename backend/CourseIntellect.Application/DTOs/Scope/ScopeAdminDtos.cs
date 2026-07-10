namespace CourseIntellect.Application.DTOs.Scope;

/// <summary>Grup + kapsam (grant) atama konsolunun DTO'ları. Platform yöneticisi;
/// çok-kurumlu sahip veya MEB İl/İlçe hiyerarşisini bu ekrandan kurar.</summary>

// ---- Grup (ağaç düğümü) ----
public sealed record ScopeGroupDto(Guid Id, string Name, Guid? ParentGroupId, int TenantCount);

public sealed record CreateScopeGroupRequest(string Name, Guid? ParentGroupId);

public sealed record AssignTenantGroupRequest(Guid? GroupId);

// ---- Kapsam (grant) ----
public sealed record UserGrantDto(
    Guid Id,
    string Level,        // Platform | Group | Tenant | Branch
    Guid? TargetId,
    string TargetName,   // okunur ad (kurum/grup/şube)
    string AccessMode,   // Manage | ReadOnly
    bool IsHome);

public sealed record AddGrantRequest(string Level, Guid? TargetId, string AccessMode);

// ---- Atama ekranı için basit listeler ----
public sealed record ScopeUserDto(Guid Id, string FullName, string Username, string PrimaryRole);

public sealed record ScopeTenantLiteDto(Guid Id, string Name, Guid? GroupId);
