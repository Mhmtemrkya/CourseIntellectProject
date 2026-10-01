using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

/// <summary>
/// Kurum kaydı alanları: her etiket amacına uygun doğrulanır (TC checksum, telefon
/// 10 hane, e-posta/web biçimi, posta kodu 5 hane…). Boş = opsiyonel (null döner),
/// dolu ama geçersiz = reddedilir.
/// </summary>
public sealed class InstitutionFieldRulesTests
{
    [Theory]
    [InlineData("", null)]
    [InlineData("  ", null)]
    [InlineData("info@kurum.com", "info@kurum.com")]
    [InlineData("INFO@Kurum.COM", "info@kurum.com")]
    public void Email_optional_and_lowercased(string input, string? expected) =>
        Assert.Equal(expected, InstitutionFieldRules.NormalizeEmail(input));

    [Theory]
    [InlineData("kurum")]
    [InlineData("kurum@")]
    [InlineData("a@b")]
    public void Email_rejects_malformed(string input) =>
        Assert.Throws<InvalidOperationException>(() => InstitutionFieldRules.NormalizeEmail(input));

    [Theory]
    [InlineData("kurum.com", "https://kurum.com")]
    [InlineData("https://okul.edu.tr/x", "https://okul.edu.tr/x")]
    public void Website_adds_scheme(string input, string expected) =>
        Assert.Equal(expected, InstitutionFieldRules.NormalizeWebsite(input));

    [Fact]
    public void Website_rejects_malformed() =>
        Assert.Throws<InvalidOperationException>(() => InstitutionFieldRules.NormalizeWebsite("not a site"));

    [Theory]
    [InlineData("750456", "750456")]
    [InlineData("12 34 56 78", "12345678")]
    public void MebCode_6_to_8_digits(string input, string expected) =>
        Assert.Equal(expected, InstitutionFieldRules.NormalizeMebCode(input));

    [Theory]
    [InlineData("123")]
    [InlineData("123456789")]
    public void MebCode_rejects_wrong_length(string input) =>
        Assert.Throws<InvalidOperationException>(() => InstitutionFieldRules.NormalizeMebCode(input));

    [Fact]
    public void TaxNumber_accepts_10_digit_vkn() =>
        Assert.Equal("1234567890", InstitutionFieldRules.NormalizeTaxNumber("1234567890"));

    [Fact]
    public void TaxNumber_11_digit_requires_valid_tckn()
    {
        Assert.Equal("10000000146", InstitutionFieldRules.NormalizeTaxNumber("10000000146"));
        Assert.Throws<InvalidOperationException>(() => InstitutionFieldRules.NormalizeTaxNumber("12345678901"));
    }

    [Theory]
    [InlineData("06500", "06500")]
    [InlineData("1234")]
    public void PostalCode_must_be_5_digits(string input, string? expected = null)
    {
        if (expected is null)
            Assert.Throws<InvalidOperationException>(() => InstitutionFieldRules.NormalizePostalCode(input));
        else
            Assert.Equal(expected, InstitutionFieldRules.NormalizePostalCode(input));
    }

    [Theory]
    [InlineData("05321234567", "5321234567")]
    [InlineData("0 (212) 444 55 66", "2124445566")]
    public void InstitutionPhone_reduced_to_10(string input, string expected) =>
        Assert.Equal(expected, InstitutionFieldRules.NormalizeInstitutionPhone(input));

    [Fact]
    public void InstitutionPhone_rejects_short() =>
        Assert.Throws<InvalidOperationException>(() => InstitutionFieldRules.NormalizeInstitutionPhone("12345"));

    [Theory]
    [InlineData("istanbul", "İstanbul")]
    [InlineData("ANKARA", "Ankara")]
    public void Province_canonicalised(string input, string expected) =>
        Assert.Equal(expected, InstitutionFieldRules.NormalizeProvince(input));

    [Fact]
    public void Province_rejects_unknown() =>
        Assert.Throws<InvalidOperationException>(() => InstitutionFieldRules.NormalizeProvince("Atlantis"));
}
