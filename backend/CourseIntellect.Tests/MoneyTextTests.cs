using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

/// <summary>
/// Bildirim/not metinlerindeki para biçimi istemcilerdekiyle (format.js,
/// format.dart) birebir aynı olmalı: tam sayıda kuruş yok, birim sonda.
/// </summary>
public sealed class MoneyTextTests
{
    [Theory]
    [InlineData(5000, "5.000 TL")]
    [InlineData(5000.5, "5.000,50 TL")]
    [InlineData(1234567.89, "1.234.567,89 TL")]
    [InlineData(0, "0 TL")]
    public void Format_MatchesClientRules(decimal amount, string expected)
    {
        Assert.Equal(expected, MoneyText.Format(amount));
    }

    [Fact]
    public void Format_UsesCurrencyLabel()
    {
        Assert.Equal("100 TL", MoneyText.Format(100, "TRY"));
        Assert.Equal("100 USD", MoneyText.Format(100, "usd"));
        Assert.Equal("100 TL", MoneyText.Format(100, "  "));
    }

    [Fact]
    public void Format_KeepsNegativeSign()
    {
        Assert.Equal("-250 TL", MoneyText.Format(-250));
    }
}
