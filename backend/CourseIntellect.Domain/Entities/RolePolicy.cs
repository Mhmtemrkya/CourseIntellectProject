namespace CourseIntellect.Domain.Entities;

/// <summary>Kuruma aittir (TenantId); TenantId null kayıtlar platform düzeyidir ve
/// yalnız platform yöneticisi tarafından yazılır. Eskiden tablo kurumlar arası
/// ortaktı: bir kurum yöneticisinin değişikliği tüm kurumları etkiliyordu.</summary>
public sealed class RolePolicy : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public bool LoginEnabled { get; set; } = true;
    public bool RequiresCriticalApproval { get; set; }
    public string MessagingScope { get; set; } = string.Empty;
    public string ModuleAccessSerialized { get; set; } = "[]";
}
