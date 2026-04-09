namespace CourseIntellect.Application.DTOs.Common;

public sealed record RoleSummaryDto(
    string RoleName,
    int UserCount,
    bool IsActive,
    bool LoginEnabled,
    bool RequiresCriticalApproval,
    string MessagingScope,
    IReadOnlyList<string> ModuleAccess
);
