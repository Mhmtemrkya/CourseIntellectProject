namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Ziyaretçi kaydı (giriş/çıkış). KVKK gereği yalnız gerekli veri tutulur: kimlik
/// numarasının tamamı SAKLANMAZ (yalnız son 4 hane), kayıtlar saklama süresi
/// dolunca otomatik silinir, aydınlatma metninin gösterildiği işaretlenir.
/// </summary>
public sealed class VisitorEntry : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    /// <summary>T.C./pasaport numarasının yalnız son 4 hanesi.</summary>
    public string IdentityLast4 { get; set; } = string.Empty;
    /// <summary>Parent, Guest, Supplier, Official, JobCandidate, Maintenance, Other.</summary>
    public string VisitorType { get; set; } = "Guest";
    public string Purpose { get; set; } = string.Empty;
    /// <summary>Ziyaret edilen personel (varsa) — gelişinde bildirim alır.</summary>
    public Guid? HostUserId { get; set; }
    /// <summary>Ziyaret edilen kişi ya da birim adı (ör. "Müdür Yardımcısı", "Muhasebe").</summary>
    public string HostName { get; set; } = string.Empty;
    /// <summary>Veli ziyaretinde ilgili öğrenci.</summary>
    public Guid? StudentUserId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string BadgeNo { get; set; } = string.Empty;
    public string VehiclePlate { get; set; } = string.Empty;
    public int CompanionCount { get; set; }
    public string Note { get; set; } = string.Empty;
    public bool PrivacyNoticeShown { get; set; }
    public DateTime CheckInAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CheckOutAtUtc { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public string CreatedByName { get; set; } = string.Empty;
    public Guid? CheckedOutByUserId { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
}
