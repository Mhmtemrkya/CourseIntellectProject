namespace CourseIntellect.Domain.Services;

/// <summary>
/// Tahsilat toplamlarının tek doğru kaynağı. Okul finans modülü ile sürücü kursu
/// modülü aynı öğrenci için farklı bakiye üretmesin diye her iki taraf da buradaki
/// kuralları kullanır.
/// </summary>
public static class FinanceTotals
{
    /// <summary>
    /// Brüt tahsilat: yalnız pozitif (gerçek para girişi olan) hareketlerin toplamı.
    /// </summary>
    public static decimal Gross(IEnumerable<decimal> amounts)
    {
        decimal total = 0;
        foreach (var amount in amounts)
        {
            if (amount > 0) total += amount;
        }
        return total;
    }

    /// <summary>
    /// İade toplamı: negatif hareketlerin mutlak değeri.
    /// </summary>
    public static decimal Refunded(IEnumerable<decimal> amounts)
    {
        decimal total = 0;
        foreach (var amount in amounts)
        {
            if (amount < 0) total += -amount;
        }
        return total;
    }

    /// <summary>
    /// Net tahsilat = brüt − iade. İade brütü aşarsa aşan kısım yok sayılır.
    /// Kaynağı silinmiş/eşleşmeyen iade satırları yüzünden "tahsil edilen"in
    /// eksiye düşmesini ve buna bağlı olarak kalan borcun sözleşme tutarının
    /// üstüne çıkmasını engeller.
    /// </summary>
    public static decimal NetCollected(IEnumerable<decimal> amounts)
    {
        decimal gross = 0, refunded = 0;
        foreach (var amount in amounts)
        {
            if (amount > 0) gross += amount;
            else refunded += -amount;
        }
        return gross - Math.Min(gross, refunded);
    }

    /// <summary>
    /// Kalan borç. Hiçbir zaman negatif olmaz (fazla/avans tahsilat) ve hiçbir zaman
    /// sözleşme tutarının üstüne çıkmaz (iade kaynaklı şişme).
    /// </summary>
    public static decimal Outstanding(decimal net, decimal netCollected)
    {
        if (net <= 0) return 0;
        var remaining = net - netCollected;
        return remaining < 0 ? 0 : remaining > net ? net : remaining;
    }
}
