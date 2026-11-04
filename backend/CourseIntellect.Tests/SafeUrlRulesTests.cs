using System.Text.Json;
using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

public sealed class SafeUrlRulesTests
{
    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData(" JaVaScRiPt:alert(1)")]
    [InlineData("java\tscript:alert(1)")]
    [InlineData("data:text/html,<script>alert(1)</script>")]
    [InlineData("vbscript:msgbox")]
    [InlineData("//evil.example")]
    [InlineData("/\\evil.example")]
    [InlineData("ftp://files.example")]
    public void Rejects_dangerous_urls(string url) => Assert.False(SafeUrlRules.IsSafe(url));

    [Theory]
    [InlineData("/iletisim")]
    [InlineData("#fiyatlar")]
    [InlineData("https://schoolasist.com")]
    [InlineData("mailto:info@schoolasist.com")]
    [InlineData("tel:+905551112233")]
    [InlineData("")]
    public void Accepts_safe_urls(string url) => Assert.True(SafeUrlRules.IsSafe(url));

    [Fact]
    public void Finds_unsafe_links_only_in_link_fields()
    {
        using var doc = JsonDocument.Parse("""
            {"title":"javascript:metin","cta":{"href":"javascript:alert(1)"},"links":[{"url":"https://ok"},{"downloadUrl":"data:x"}]}
            """);
        var problems = SafeUrlRules.FindUnsafeLinks(doc.RootElement);
        Assert.Equal(["$.cta.href", "$.links[1].downloadUrl"], problems);
    }
}
