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

public sealed class FcmAssertionTests
{
    [Fact]
    public void Assertion_CanBeCreatedRepeatedly_AndCarriesIat()
    {
        using var rsa = System.Security.Cryptography.RSA.Create(2048);
        var options = new FcmPushOptions
        {
            ProjectId = "p",
            ClientEmail = "svc@p.iam.gserviceaccount.com",
            PrivateKey = rsa.ExportPkcs8PrivateKeyPem(),
        };

        // İkinci çağrı önceden atılmış RSA yüzünden ObjectDisposedException veriyordu.
        var first = FcmPushNotificationService.CreateServiceAccountAssertion(options);
        var second = FcmPushNotificationService.CreateServiceAccountAssertion(options);

        foreach (var assertion in new[] { first, second })
        {
            var jwt = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().ReadJwtToken(assertion);
            Assert.Contains(jwt.Claims, claim => claim.Type == "iat");
            Assert.Equal(options.TokenUri, Assert.Single(jwt.Audiences));
        }
    }
}
