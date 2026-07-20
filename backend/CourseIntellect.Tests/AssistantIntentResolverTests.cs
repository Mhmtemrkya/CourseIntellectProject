using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

public sealed class AssistantIntentResolverTests
{
    private readonly RuleBasedAssistantIntentResolver resolver = new();

    [Theory]
    [InlineData("Zeynep Kaya'nın devamsızlığını göster", AssistantIntent.GetAttendance)]
    [InlineData("Bekleyen ödevlerimi göster", AssistantIntent.GetHomework)]
    [InlineData("Bugünkü derslerim", AssistantIntent.GetSchedule)]
    [InlineData("Kalan direksiyon ders hakkım", AssistantIntent.GetDrivingProgress)]
    [InlineData("Direksiyon sınav durumum", AssistantIntent.GetDrivingExamStatus)]
    [InlineData("Borcu olan öğrencileri listele", AssistantIntent.ListStudentsWithDebt)]
    public void ResolvesExpectedIntent(string message, AssistantIntent expected)
    {
        Assert.Equal(expected, resolver.Resolve(message).Intent);
    }

    [Theory]
    [InlineData("Ahmet Yılmaz 10-A", 10, "A")]
    [InlineData("Ahmet Yılmaz 10/A", 10, "A")]
    [InlineData("10. sınıf A şubesi öğrencileri", 10, "A")]
    [InlineData("8B sınıfını listele", 8, "B")]
    public void ParsesClassFormats(string message, int grade, string section)
    {
        var result = resolver.Resolve(message);
        Assert.Equal(grade, result.GradeLevel);
        Assert.Equal(section, result.SectionName);
    }

    [Fact]
    public void PreservesAndValidatesTurkishIdentityNumber()
    {
        var result = resolver.Resolve("10000000146 TC'li öğrenciyi getir");
        Assert.Equal("10000000146", result.TcNo);
        Assert.True(RuleBasedAssistantIntentResolver.IsValidTurkishIdentityNumber(result.TcNo));
        Assert.False(RuleBasedAssistantIntentResolver.IsValidTurkishIdentityNumber("12345678901"));
    }

    [Fact]
    public void NormalizationIsTurkishAware()
    {
        var result = resolver.Resolve("  İPEK   ŞEN'in ÖDEVLERİNİ göster  ");
        Assert.Equal(AssistantIntent.GetHomework, result.Intent);
        Assert.Contains("ipek", result.SearchText);
    }
}
