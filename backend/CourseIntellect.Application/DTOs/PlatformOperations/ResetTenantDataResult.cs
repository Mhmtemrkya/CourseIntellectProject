namespace CourseIntellect.Application.DTOs.PlatformOperations;

public sealed record ResetTenantDataResult(
    Guid TenantId,
    string TenantName,
    string PreservedUsername,
    int PreservedContentCount,
    int PreservedQuestionCount,
    int DeletedUserCount,
    int DeletedRecordCount,
    IReadOnlyDictionary<string, int> DeletedByTable
);
