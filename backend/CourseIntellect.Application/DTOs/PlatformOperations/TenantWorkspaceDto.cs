namespace CourseIntellect.Application.DTOs.PlatformOperations;

public sealed record TenantWorkspaceDto(
    Guid Id,
    string Name,
    string Email,
    string Plan,
    string Status,
    int Users,
    int Branches,
    int StudentCount,
    int StaffCount,
    decimal MonthlyFee,
    decimal Collected,
    decimal Storage,
    int Api,
    DateTime CreatedAtUtc,
    string Slug,
    string ContactName,
    string ContactPhone,
    Guid? AdminUserId,
    string? AdminUsername,
    string? TemporaryPassword,
    DateTime? ApprovedAtUtc
);
