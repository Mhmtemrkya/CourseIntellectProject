namespace CourseIntellect.Application.DTOs.PlatformOperations;

public sealed record RegisterTenantRequest(
    string InstitutionName,
    string ContactName,
    string Email,
    string Phone,
    string? Password,
    string Plan,
    int EstimatedStudents
);
