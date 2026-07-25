using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

public sealed class PersonNameFormatterTests
{
    [Theory]
    [InlineData("aLİ veLİ yılMaz", "Ali Veli YILMAZ")]
    [InlineData("ayşe nur demir", "Ayşe Nur DEMİR")]
    [InlineData("  mehmet   can   ışık  ", "Mehmet Can IŞIK")]
    [InlineData("gül-şen o'naL", "Gül-Şen O'NAL")]
    public void FormatFullName_UsesTurkishGivenNameAndUppercaseSurname(
        string input,
        string expected)
    {
        Assert.Equal(expected, PersonNameFormatter.FormatFullName(input));
    }

    [Fact]
    public void SeparateNameParts_AreFormattedIndependently()
    {
        Assert.Equal("İpek Su", PersonNameFormatter.FormatGivenNames("İPEK sU"));
        Assert.Equal("ÖZTÜRK YILMAZ", PersonNameFormatter.FormatSurname("öztürk yılmaz"));
    }
}
