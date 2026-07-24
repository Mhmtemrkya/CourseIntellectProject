namespace CourseIntellect.Application.DTOs.PlatformOperations;

public sealed record ResetTenantDataRequest(
    string Confirmation,
    string PreserveUsername
);
