namespace CourseIntellect.Domain.Entities;

/// <summary>
/// İdari organizasyon birimi: kampüs / birim / departman hiyerarşisi.
/// ParentUnitId ile ağaç yapısı kurulur; her birime sorumlu atanabilir.
/// </summary>
public sealed class OrgUnit : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string UnitType { get; set; } = "Birim";
    public Guid? ParentUnitId { get; set; }
    public string ManagerName { get; set; } = string.Empty;

    /// <summary>Sorumlunun kullanıcı kaydı (personel listesinden seçilir). Şube/kampüs
    /// birimlerinde zorunludur; ManagerName görüntüleme kopyasıdır.</summary>
    public Guid? ManagerUserId { get; set; }

    /// <summary>Pasif birim seçim listelerinde görünmez (veri korunur, silinmez).</summary>
    public bool IsActive { get; set; } = true;
    public string Note { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
