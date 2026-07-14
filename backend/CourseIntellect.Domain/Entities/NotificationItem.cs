namespace CourseIntellect.Domain.Entities;

public sealed class NotificationItem : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string TimeLabel { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public string TargetRole { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public bool IsRead { get; set; }

    /// <summary>
    /// Belirli bir kişiye gönderilen bildirim. Boşsa bildirim role/kitleye yayındır
    /// (eski davranış korunur). Doluysa yalnızca o kullanıcı görür.
    /// </summary>
    public Guid? TargetUserId { get; set; }

    /// <summary>
    /// Aynı olayın ikinci kez bildirim üretmesini engelleyen anahtar
    /// (ör. <c>appointment-cancelled:{id}</c>). Aynı anahtar tekrar gelirse
    /// bildirim yazılmaz — hatırlatma işleri bunu tekrar tekrar çağırabilir.
    /// </summary>
    public string? DedupeKey { get; set; }

    /// <summary>Bildirime dokununca açılacak kayıt (randevu, belge, ödeme…).</summary>
    public string? RelatedEntityType { get; set; }
    public string? RelatedEntityId { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
