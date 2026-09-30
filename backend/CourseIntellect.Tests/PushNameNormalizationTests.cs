using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

public sealed class PushNameNormalizationTests
{
    [Theory]
    [InlineData("Ali YİLMAZ", "Ali Yilmaz")]
    [InlineData("İREM ŞAHİN", "irem sahin")]
    [InlineData("  Ayşe Işık ", "AYSE ISIK")]
    [InlineData("Çağla Öztürk", "CAGLA OZTURK")]
    public void TurkishCaseVariants_NormalizeToSameKey(string stored, string lookup)
        => Assert.Equal(FcmPushNotificationService.NormalizeName(stored), FcmPushNotificationService.NormalizeName(lookup));

    [Fact]
    public void DifferentNames_DoNotCollide()
        => Assert.NotEqual(FcmPushNotificationService.NormalizeName("Ali Yılmaz"), FcmPushNotificationService.NormalizeName("Ali Yalmaz"));
}
