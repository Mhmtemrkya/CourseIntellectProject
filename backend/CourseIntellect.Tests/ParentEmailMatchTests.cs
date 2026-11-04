using CourseIntellect.Api.Security;

namespace CourseIntellect.Tests;

/// <summary>
/// Veli e-postası kullanıcı adıyla birebir ya da "@" öncesiyle eşleşmeli; "içeriyor" değil
/// (kullanıcı adı "ali" olan veli, e-postasında "ali" geçen her öğrenciyi görüyordu).
/// </summary>
public sealed class ParentEmailMatchTests
{
    [Theory]
    [InlineData("veli.ayse@example.com", "veli.ayse", true)]
    [InlineData("veli.ayse@example.com", "veli.ayse@example.com", true)]
    [InlineData("aliveli@example.com", "ali", false)]
    [InlineData("veli.ayse2@example.com", "veli.ayse", false)]
    [InlineData("", "ali", false)]
    [InlineData("ali@example.com", "", false)]
    public void EmailMatchesUsername_RequiresExactLocalPart(string email, string username, bool expected) =>
        Assert.Equal(expected, StudentScope.EmailMatchesUsername(email, username));
}
