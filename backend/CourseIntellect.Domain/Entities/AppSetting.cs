namespace CourseIntellect.Domain.Entities;

/// <summary>Kuruma aittir (TenantId); TenantId null kayıtlar platform düzeyidir ve
/// yalnız platform yöneticisi tarafından yazılır. Eskiden tablo kurumlar arası
/// ortaktı: bir kurum yöneticisinin değişikliği tüm kurumları etkiliyordu.</summary>
public sealed class AppSetting : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string Type { get; set; } = "string";
    public string Category { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
