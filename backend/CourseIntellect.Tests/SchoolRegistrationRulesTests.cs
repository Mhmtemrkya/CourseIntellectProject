using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

public sealed class SchoolRegistrationRulesTests
{
    [Theory]
    [InlineData("10000000146", "10000000146")]
    [InlineData("100 000 001 46", "10000000146")]
    public void NormalizeTcNo_NormalizesValidValues(string input, string expected)
    {
        Assert.Equal(expected, SchoolRegistrationRules.NormalizeTcNo(input));
    }

    [Theory]
    [InlineData("123")]              // 11 haneden kısa
    [InlineData("02345678901")]      // 0 ile başlıyor
    [InlineData("11111111111")]      // biçimsel doğru ama checksum geçersiz
    [InlineData("12345678901")]      // checksum geçersiz
    public void NormalizeTcNo_RejectsInvalidValues(string input)
    {
        Assert.Throws<InvalidOperationException>(() => SchoolRegistrationRules.NormalizeTcNo(input));
    }

    [Fact]
    public void NormalizeTcNo_RequiredByDefault_RejectsEmpty()
    {
        Assert.Throws<InvalidOperationException>(() => SchoolRegistrationRules.NormalizeTcNo(""));
    }

    [Fact]
    public void NormalizeTcNo_Optional_AllowsEmpty()
    {
        Assert.Equal(string.Empty, SchoolRegistrationRules.NormalizeTcNo("", required: false));
    }

    [Theory]
    [InlineData("+90 555 123 45 67", "5551234567")]
    [InlineData("0555 123 45 67", "5551234567")]
    [InlineData("5551234567", "5551234567")]
    public void NormalizePhone_ReducesToLastTenDigits(string input, string expected)
    {
        Assert.Equal(expected, SchoolRegistrationRules.NormalizePhone(input));
    }

    [Theory]
    [InlineData("+90 555 123 45 67", true)]
    [InlineData("0212 123 45 67", false)]   // sabit hat, 5 ile başlamıyor
    [InlineData("555 12", false)]           // eksik hane
    public void IsValidTrMobile_ValidatesMobileFormat(string input, bool expected)
    {
        Assert.Equal(expected, SchoolRegistrationRules.IsValidTrMobile(input));
    }

    [Theory]
    [InlineData("")]              // opsiyonel — boş kabul
    [InlineData("2010-05-01")]    // geçmiş, geçerli
    public void ValidateBirthDate_AcceptsValidOrEmpty(string input)
    {
        SchoolRegistrationRules.ValidateBirthDate(input);
    }

    [Theory]
    [InlineData("2999-01-01")]    // gelecek
    [InlineData("1800-01-01")]    // çok eski
    [InlineData("not-a-date")]    // geçersiz biçim
    public void ValidateBirthDate_RejectsInvalid(string input)
    {
        Assert.Throws<InvalidOperationException>(() => SchoolRegistrationRules.ValidateBirthDate(input));
    }

    [Fact]
    public void NextSchoolNumber_StartsAt1001AndSkipsNonNumericValues()
    {
        Assert.Equal("1001", SchoolRegistrationRules.NextSchoolNumber([]));
        Assert.Equal("1251", SchoolRegistrationRules.NextSchoolNumber(["A-12", "1250", "0999", null]));
    }
}
