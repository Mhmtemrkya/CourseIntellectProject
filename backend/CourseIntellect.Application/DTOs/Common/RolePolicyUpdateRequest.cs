namespace CourseIntellect.Application.DTOs.Common;

public sealed record RolePolicyUpdateRequest(
    bool IsActive,
    bool LoginEnabled,
    bool RequiresCriticalApproval,
    string MessagingScope,
    IReadOnlyList<string> ModuleAccess
);
