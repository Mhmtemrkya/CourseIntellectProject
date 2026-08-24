using System.Net;
using System.Security.Claims;
using CourseIntellect.Application.DTOs.PlatformSubscriptions;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Api;
using CourseIntellect.Api.Controllers;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
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
            ["Email:Smtp:Password"] = "not-a-production-secret",
            ["Email:Smtp:UseSsl"] = "false",
            ["Email:From"] = "no-reply@example.test"
        }).Build();

        Assert.Throws<InvalidOperationException>(() =>
            new SmtpEmailSender(configuration, new Host("Production"), NullLogger<SmtpEmailSender>.Instance));
    }

    [Theory]
    [InlineData(null, null, null, null)]
    [InlineData(null, "no-reply@example.test", null, null)]
    [InlineData("smtp.example.test", null, null, null)]
    [InlineData("smtp.example.test", "no-reply@example.test", "mailer", null)]
    [InlineData("smtp.example.test", "no-reply@example.test", null, "orphan-password")]
    public void Production_rejects_incomplete_smtp_configuration(
        string? host,
        string? from,
        string? user,
        string? password)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Email:Smtp:Host"] = host,
            ["Email:From"] = from,
            ["Email:Smtp:User"] = user,
            ["Email:Smtp:Password"] = password,
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
        AssertPolicy(typeof(TenantFeaturesController).GetMethod(nameof(TenantFeaturesController.GetForTenant))!);
        AssertPolicy(typeof(TenantFeaturesController).GetMethod(nameof(TenantFeaturesController.UpdateForTenant))!);
        AssertPolicy(typeof(PlatformSubscriptionsController).GetMethod(nameof(PlatformSubscriptionsController.GetAll))!);
        AssertPolicy(typeof(PlatformSubscriptionsController).GetMethod(nameof(PlatformSubscriptionsController.GetById))!);
        AssertPolicy(typeof(PlatformSubscriptionsController).GetMethod(nameof(PlatformSubscriptionsController.MarkPaid))!);
        AssertPolicy(typeof(PlatformSubscriptionsController).GetMethod(nameof(PlatformSubscriptionsController.Cancel))!);
    }

    [Fact]
    public async Task Tenant_subscription_purchase_cannot_target_another_tenant()
    {
        var ownTenantId = Guid.NewGuid();
        var service = new RecordingSubscriptionService();
        var controller = CreateSubscriptionController(service, ownTenantId);

        var result = await controller.Purchase(
            new CreatePlatformSubscriptionInvoiceRequest("pro", "Pro", 0, "Aylık", TenantId: Guid.NewGuid()),
            CancellationToken.None);

        Assert.IsType<ForbidResult>(result);
        Assert.False(service.CreateCalled);
    }

    [Fact]
    public async Task Tenant_subscription_purchase_stays_pending_until_platform_approval()
    {
        var ownTenantId = Guid.NewGuid();
        var service = new RecordingSubscriptionService();
        var controller = CreateSubscriptionController(service, ownTenantId);

        var result = await controller.Purchase(
            new CreatePlatformSubscriptionInvoiceRequest("pro", "Pro", 100, "Aylık"),
            CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.True(service.CreateCalled);
        Assert.Equal(ownTenantId, service.CreatedTenantId);
        Assert.False(service.AutoApprove);
    }

    private static void AssertPolicy(System.Reflection.MemberInfo member)
        => Assert.Contains(member.GetCustomAttributes(typeof(AuthorizeAttribute), true).Cast<AuthorizeAttribute>(),
            attribute => attribute.Policy == "PlatformAdmin");

    private static PlatformSubscriptionsController CreateSubscriptionController(
        RecordingSubscriptionService service,
        Guid tenantId)
    {
        var controller = new PlatformSubscriptionsController(service, new FixedTenant(tenantId));
        controller.ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity([
                    new Claim("user_id", Guid.NewGuid().ToString()),
                    new Claim("tenant_id", tenantId.ToString()),
                    new Claim("role", "Admin")
                ], "test", "name", "role"))
            }
        };
        return controller;
    }

    private sealed class FixedTenant(Guid tenantId) : ITenantContext
    {
        public Guid? CurrentTenantId => tenantId;
        public bool HasTenant => true;
    }

    private sealed class RecordingSubscriptionService : IPlatformSubscriptionService
    {
        public bool CreateCalled { get; private set; }
        public Guid CreatedTenantId { get; private set; }
        public bool AutoApprove { get; private set; }

        public Task<PlatformSubscriptionInvoiceDto> CreateAsync(Guid? actorUserId, Guid tenantId,
            CreatePlatformSubscriptionInvoiceRequest request, bool autoApprove,
            CancellationToken cancellationToken = default)
        {
            CreateCalled = true;
            CreatedTenantId = tenantId;
            AutoApprove = autoApprove;
            var now = DateTime.UtcNow;
            return Task.FromResult(new PlatformSubscriptionInvoiceDto(
                Guid.NewGuid(), tenantId, "Tenant", "tenant@example.test", "INV-1",
                request.PlanId, request.PlanName, request.Amount, request.Currency ?? "TRY",
                request.BillingPeriod, now, now.AddMonths(1), "pending", now, now.AddDays(14), null, request.Notes));
        }

        public Task<IReadOnlyList<PlatformSubscriptionInvoiceDto>> GetAllAsync(string? statusFilter = null,
            string? search = null, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<PlatformSubscriptionInvoiceDto>> GetForTenantAsync(Guid tenantId,
            CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<PlatformSubscriptionInvoiceDto?> GetByIdAsync(Guid invoiceId,
            CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<PlatformSubscriptionInvoiceDto?> MarkPaidAsync(Guid invoiceId,
            MarkPlatformInvoicePaidRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<PlatformSubscriptionInvoiceDto?> CancelAsync(Guid invoiceId, string? notes,
            CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private sealed class Host(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;
        public string ApplicationName { get; set; } = "Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
    }
}
