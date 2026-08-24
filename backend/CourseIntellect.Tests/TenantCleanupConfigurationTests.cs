using CourseIntellect.Infrastructure.Services;
using Microsoft.Extensions.Configuration;

namespace CourseIntellect.Tests;

public sealed class TenantCleanupConfigurationTests
{
    [Fact]
    public void Cleanup_is_fail_safe_disabled_when_setting_is_absent()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection([]).Build();

        Assert.False(RejectedTenantCleanupService.IsEnabled(configuration));
    }

    [Theory]
    [InlineData("false", false)]
    [InlineData("true", true)]
    public void Cleanup_requires_explicit_enabled_setting(string configured, bool expected)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["TenantCleanup:Enabled"] = configured,
            })
            .Build();

        Assert.Equal(expected, RejectedTenantCleanupService.IsEnabled(configuration));
    }
}
