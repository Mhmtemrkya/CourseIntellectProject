namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Kurum grubu / marka: bir sahibin altındaki birden çok <see cref="TenantWorkspace"/>'i
/// tek çatı altında toplar. Kurum sahibi bu gruba verilen bir grant ile tüm
/// kurumlarını tek ekrandan görebilir. Platform seviyesinin (MEB) hemen altındadır.
/// </summary>
public sealed class TenantGroup
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;

    /// <summary>Grubun sahibi olan kullanıcı (opsiyonel; bilgi amaçlı).</summary>
    public Guid? OwnerUserId { get; set; }

    public string Note { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
