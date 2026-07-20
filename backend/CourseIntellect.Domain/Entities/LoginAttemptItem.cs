namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Giriş denemesi kaydı: kim, nereden, hangi cihazla giriş yapmayı denedi.
/// Hesap kilitleme politikası ve kayıt geçmişi ekranı bu tablodan beslenir.
/// </summary>
public sealed class LoginAttemptItem : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Denemenin ait olduğu kurum. Kurum yöneticisi yalnız kendi kurumunun
    /// denemelerini görsün diye kapsanır. Tanınmayan bir e-posta ile yapılan
    /// denemede kullanıcı çözülemediğinden <c>null</c> kalır; bu kayıtlar hiçbir
    /// kuruma görünmez.
    /// </summary>
    public Guid? TenantId { get; set; }

    public Guid? UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public bool Success { get; set; }
    public string IpAddress { get; set; } = string.Empty;
    public string UserAgent { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
}
