namespace CourseIntellect.Application.DTOs.Admin;

public sealed record CreateOrgUnitRequest(
    string Name,
    string UnitType,
    Guid? ParentUnitId,
    string? ManagerName,
    string? Note,
    // Sorumlu personelin kullanıcı kimliği (listeden seçilir); şube/kampüs için zorunlu.
    Guid? ManagerUserId = null);

public sealed record UpdateOrgUnitRequest(
    string Name,
    string UnitType,
    Guid? ParentUnitId,
    string? ManagerName,
    string? Note);

public sealed record OrgUnitDto(
    Guid Id,
    string Name,
    string UnitType,
    Guid? ParentUnitId,
    string ManagerName,
    string Note,
    DateTime CreatedAtUtc,
    bool IsActive = true);

/// <summary>Şube sorumlusu seçiminde listelenen kullanıcı (personel + kurum yöneticileri).</summary>
public sealed record ManagerCandidateDto(Guid UserId, string FullName, string Role);

public sealed record SetOrgUnitActiveRequest(bool IsActive);
