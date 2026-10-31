namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Gün sonu kasa kapanışı. Kapanan güne (kurumun yerel takvimiyle) tahsilat, iade,
/// gider ve ödeme yazılamaz; düzeltme için gün yeniden açılmalıdır (yönetici).
/// </summary>
public sealed class FinanceDayClosing : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    /// <summary>Kapanan gün (00:00 UTC olarak tutulan yerel tarih).</summary>
    public DateTime Day { get; set; }
    public decimal CashIn { get; set; }
    public decimal CashOut { get; set; }
    public decimal ExpectedCash { get; set; }
    public decimal CountedCash { get; set; }
    public decimal Difference { get; set; }
    public decimal CardIn { get; set; }
    public decimal TransferIn { get; set; }
    public int CollectionCount { get; set; }
    public string Note { get; set; } = string.Empty;
    public Guid? ClosedByUserId { get; set; }
    public string ClosedByName { get; set; } = string.Empty;
    public DateTime ClosedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Banka ekstresinden yüklenen bir hareket ve eşleştiği sistem kaydı. Kaydedildiği
/// için mutabakat ekranı kapanınca kaybolmaz; eşleşen kayıt tekrar aday olmaz.
/// </summary>
public sealed class BankReconciliationEntry : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Reference { get; set; } = string.Empty;
    public DateTime BankDate { get; set; }
    /// <summary>Pozitif: hesaba giren; negatif: hesaptan çıkan.</summary>
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    /// <summary>Matched / Unmatched / Ignored.</summary>
    public string Status { get; set; } = "Unmatched";
    /// <summary>Payment / Expense / Salary / Invoice.</summary>
    public string MatchedType { get; set; } = string.Empty;
    public Guid? MatchedId { get; set; }
    public string MatchedLabel { get; set; } = string.Empty;
    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
}

/// <summary>Gecikme kuralı hatırlatmasının bir kez gönderildiğinin kaydı (kanal fark etmeksizin).</summary>
public sealed class FinanceReminderLog : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string DedupeKey { get; set; } = string.Empty;
    public string Channel { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    public DateTime SentAtUtc { get; set; } = DateTime.UtcNow;
}
