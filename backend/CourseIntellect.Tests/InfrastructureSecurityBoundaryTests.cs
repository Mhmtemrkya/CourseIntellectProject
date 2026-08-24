using System.Net;
using CourseIntellect.Api;
using CourseIntellect.Api.Controllers;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace CourseIntellect.Tests;

public sealed class InfrastructureSecurityBoundaryTests
{
    [Fact]
    public async Task Untrusted_peer_cannot_spoof_remote_ip_with_x_forwarded_for()
    {
        var options = new ForwardedHeadersOptions();
        ForwardedHeadersConfiguration.Apply(options, new ConfigurationBuilder().Build(), new Host("Production"));
        IPAddress? observed = null;
        var middleware = new ForwardedHeadersMiddleware(
            context => { observed = context.Connection.RemoteIpAddress; return Task.CompletedTask; },
            NullLoggerFactory.Instance,
            Options.Create(options));
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("198.51.100.99");
        context.Request.Headers["X-Forwarded-For"] = "203.0.113.10";

        await middleware.Invoke(context);

        Assert.Equal(IPAddress.Parse("198.51.100.99"), observed);
    }

    [Fact]
    public void Production_rejects_authenticated_smtp_without_tls()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Email:Smtp:Host"] = "smtp.example.test",
            ["Email:Smtp:User"] = "mailer",
            ["Email:Smtp:UseSsl"] = "false",
            ["Email:From"] = "no-reply@example.test"
        }).Build();

        Assert.Throws<InvalidOperationException>(() =>
            new SmtpEmailSender(configuration, new Host("Production"), NullLogger<SmtpEmailSender>.Instance));
    }

    [Fact]
    public void Every_platform_only_controller_or_action_uses_platform_admin_policy()
    {
        AssertPolicy(typeof(PlatformOperationsController));
        AssertPolicy(typeof(PlatformAuditController));
        AssertPolicy(typeof(PlatformPackagesController).GetMethod(nameof(PlatformPackagesController.List))!);
        AssertPolicy(typeof(PlatformPackagesController).GetMethod(nameof(PlatformPackagesController.Upsert))!);
        AssertPolicy(typeof(PlatformPackagesController).GetMethod(nameof(PlatformPackagesController.Delete))!);
        AssertPolicy(typeof(SystemController).GetMethod(nameof(SystemController.SetMaintenance))!);
    }

    private static void AssertPolicy(System.Reflection.MemberInfo member)
        => Assert.Contains(member.GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>(),
            attribute => attribute.Policy == "PlatformAdmin");

    private sealed class Host(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;
        public string ApplicationName { get; set; } = "Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
    }
}
