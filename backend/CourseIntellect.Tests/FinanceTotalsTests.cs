using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

/// <summary>
/// Tahsilat toplamlarının sözleşmesi. Canlıda kaynağı silinmiş bir iade kaydı
/// "tahsil edilen"i eksiye düşürüp kalan borcu sözleşme tutarının iki katına
/// çıkarmıştı; bu testler o davranışın geri gelmesini engeller.
/// </summary>
public sealed class FinanceTotalsTests
{
    [Fact]
    public void NetCollected_SubtractsRefundsFromGross()
    {
        decimal[] amounts = [1000m, 500m, -300m];
        Assert.Equal(1200m, FinanceTotals.NetCollected(amounts));
    }

    [Fact]
    public void NetCollected_NeverGoesNegative_WhenRefundExceedsCollected()
    {
        // Canlı senaryo: 1 TL tahsil edilmiş, 18.000 TL iade kaydı var.
        decimal[] amounts = [1m, -18000m];
        Assert.Equal(0m, FinanceTotals.NetCollected(amounts));
    }

    [Fact]
    public void Gross_And_Refunded_ReportRawTotals()
    {
        decimal[] amounts = [1m, -18000m, -14000m];
        Assert.Equal(1m, FinanceTotals.Gross(amounts));
        Assert.Equal(32000m, FinanceTotals.Refunded(amounts));
    }

    [Fact]
    public void Outstanding_NeverExceedsContractNet()
    {
        // 18.000 sözleşme, hiç net tahsilat yok → borç tam olarak 18.000 olmalı,
        // 35.999 (iki katı) değil.
        Assert.Equal(18000m, FinanceTotals.Outstanding(18000m, 0m));
    }

    [Fact]
    public void Outstanding_IsZero_WhenOverpaid()
    {
        Assert.Equal(0m, FinanceTotals.Outstanding(15000m, 16000m));
    }

    [Fact]
    public void Outstanding_IsZero_WhenNoContract()
    {
        Assert.Equal(0m, FinanceTotals.Outstanding(0m, 0m));
    }

    [Fact]
    public void Outstanding_ReflectsPartialPayment()
    {
        Assert.Equal(9000m, FinanceTotals.Outstanding(15000m, 6000m));
    }
}
