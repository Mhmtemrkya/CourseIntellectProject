namespace CourseIntellect.Application.DTOs.Admin;

public sealed record CreateOrgUnitRequest(
    string Name,
    string UnitType,
    Guid? ParentUnitId,
    string? ManagerName,
    string? Note);

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
    DateTime CreatedAtUtc);
