namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Kurumun belge künyesi: ekstre, makbuz ve resmî çıktıların başlığında görünen
/// ad, adres ve iletişim bilgileri. Kurum başına tek satır; alanlar boş
/// bırakıldığında belge üretici sırayla sürücü kursu form ayarlarına ve çalışma
/// alanı kaydına düşer (bkz. IInstitutionProfileService).
/// </summary>
public sealed class InstitutionProfile : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }

    /// <summary>Belgede görünen kurum adı (ör. "ERZURUM KOLEJİ").</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Açık adres — mahalle/sokak/numara.</summary>
    public string Address { get; set; } = string.Empty;

    public string District { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;

    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Website { get; set; } = string.Empty;

    /// <summary>Vergi dairesi ve numarası — kurumsal belgelerde istenir.</summary>
    public string TaxOffice { get; set; } = string.Empty;
    public string TaxNumber { get; set; } = string.Empty;

    /// <summary>Belge altına basılacak not; boşsa varsayılan bilgilendirme notu kullanılır.</summary>
    public string DocumentFooterNote { get; set; } = string.Empty;

    public Guid? UpdatedByUserId { get; set; }
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
