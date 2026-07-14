using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Sürücü adayına çıkarılan ek ücret kalemi (ek direksiyon dersi, sınav ücreti,
/// dosya masrafı, ek hizmet…).
///
/// <para>Kalem yalnızca "neden" bilgisini taşır: borç, tahsilat ve gecikme takibi
/// mevcut finans altyapısında yürür — her kalem sözleşmeye bir <see cref="FinanceInstallment"/>
/// olarak düşer, böylece kasa, gecikmiş ödeme ve makbuz ekranları kendiliğinden çalışır.</para>
/// </summary>
public sealed class DrivingCharge : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid StudentDrivingProfileId { get; set; }

    public DrivingChargeType ChargeType { get; set; }

    public string Description { get; set; } = string.Empty;

    public decimal GrossAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public string DiscountReason { get; set; } = string.Empty;

    /// <summary>Öğrenciden tahsil edilecek net tutar (brüt − indirim).</summary>
    public decimal NetAmount { get; set; }

    /// <summary>Ek ders satışında öğrenciye eklenen direksiyon dakikası.</summary>
    public int Minutes { get; set; }

    /// <summary>Kalemin borç olarak düştüğü taksit.</summary>
    public Guid? FinanceInstallmentId { get; set; }
    public Guid? EnrollmentContractId { get; set; }

    /// <summary>İade edildiyse iade tutarı ve nedeni.</summary>
    public decimal RefundedAmount { get; set; }
    public string RefundReason { get; set; } = string.Empty;
    public DateTime? RefundedAtUtc { get; set; }

    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
