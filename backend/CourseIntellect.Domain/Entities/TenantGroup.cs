namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Kurum grubu düğümü: bir <see cref="TenantWorkspace"/> üstü gruplama katmanı. AĞAÇTIR
/// (<see cref="ParentGroupId"/>) — böylece hem düz marka (Sahip → kurumlar) hem de derin
/// coğrafi hiyerarşi (MEB → İl → İlçe → Okul) aynı yapıyla ifade edilir. Bir gruba verilen
/// grant, o düğümün ALT AĞACINDAKİ tüm kurumları kapsar (İlçe müdürü ilçedeki tüm okulları,
/// İl müdürü ildeki tüm ilçelerin okullarını görür).
/// </summary>
public sealed class TenantGroup
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;

    /// <summary>Üst grup düğümü (ağaç). <c>null</c> = kök (ör. İl, ya da düz marka).</summary>
    public Guid? ParentGroupId { get; set; }

    /// <summary>Grubun sahibi olan kullanıcı (opsiyonel; bilgi amaçlı).</summary>
    public Guid? OwnerUserId { get; set; }

    public string Note { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
