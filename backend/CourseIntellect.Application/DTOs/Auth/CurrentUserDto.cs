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
    bool SubscriptionRequired,
    // Yeni kullanıcı veya şifre sıfırlandı; ilk girişte zorunlu şifre değişimi.
    bool MustChangePassword,
    // Rol yönetimi panelinde kişi bazlı açılan modül anahtarları.
    IReadOnlyList<string> Modules,
    // Rol yönetimi panelinde kişi bazlı açılan işlem izinleri.
    IReadOnlyList<string> Permissions,
    // Kullanıcı için kişi bazlı rol yönetimi kaydı bulundu mu? Boş modül listesi de bilinçli seçim olabilir.
    bool HasRoleManagementPolicy
);
