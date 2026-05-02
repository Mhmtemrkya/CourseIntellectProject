namespace CourseIntellect.Application.DTOs.Auth;

public sealed record CurrentUserDto(
    Guid Id,
    string FullName,
    string Username,
    string PrimaryRole,
    IReadOnlyList<string> ExtraRoles,
    string Status,
    string Campus,
    string DepartmentOrBranch,
    Guid? TenantId,
    string? TenantName,
    string? TenantSlug,
    bool IsPlatformAdmin,
    // Kurum aktif bir abonelik ödemesi yapmamışsa true.
    // Desktop bu durumda girişi reddeder, marketing site checkout'a izin verir.
    bool SubscriptionRequired
);
