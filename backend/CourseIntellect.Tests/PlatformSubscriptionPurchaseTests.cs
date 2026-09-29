using CourseIntellect.Api.Controllers;
using CourseIntellect.Application.DTOs.PlatformSubscriptions;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace CourseIntellect.Tests;

/// <summary>
/// Ücretsiz dönemde self-servis paket satın alma kapalıdır; açıldığında da bir
/// kurum kullanıcısı başka bir kurum adına fatura oluşturamamalıdır.
/// </summary>
public sealed class PlatformSubscriptionPurchaseTests
{
    private static readonly Guid OwnTenant = Guid.NewGuid();
    private static readonly Guid OtherTenant = Guid.NewGuid();

    private static readonly CreatePlatformSubscriptionInvoiceRequest Request =
        new("pro", "Pro", 1000m, "Aylık", TenantId: OtherTenant);

    private static PlatformSubscriptionsController CreateController(
        RecordingService service, Guid? currentTenant, bool billingEnabled)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Billing:Enabled"] = billingEnabled ? "true" : "false",
            })
            .Build();

        return new PlatformSubscriptionsController(service, new FixedTenant(currentTenant), configuration)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };
    }

    [Fact]
    public async Task Ucretsiz_donemde_satin_alma_kapalidir()
    {
        var service = new RecordingService();

        var result = await CreateController(service, OwnTenant, billingEnabled: false)
            .Purchase(Request, CancellationToken.None);

        Assert.Equal(StatusCodes.Status403Forbidden, Assert.IsType<ObjectResult>(result).StatusCode);
        Assert.Null(service.CreatedFor);
    }

    [Fact]
    public async Task Kurum_kullanicisi_baska_kurum_adina_fatura_olusturamaz()
    {
        var service = new RecordingService();

        await CreateController(service, OwnTenant, billingEnabled: true)
            .Purchase(Request, CancellationToken.None);

        Assert.Equal(OwnTenant, service.CreatedFor);
    }

    [Fact]
    public async Task Kurumsuz_platform_hesabi_hedef_kurumu_secebilir()
    {
        var service = new RecordingService();

        await CreateController(service, currentTenant: null, billingEnabled: true)
            .Purchase(Request, CancellationToken.None);

        Assert.Equal(OtherTenant, service.CreatedFor);
    }

    private sealed class FixedTenant(Guid? tenantId) : ITenantContext
    {
        public Guid? CurrentTenantId => tenantId;
        public bool HasTenant => tenantId.HasValue;
    }

    private sealed class RecordingService : IPlatformSubscriptionService
    {
        public Guid? CreatedFor { get; private set; }

        public Task<PlatformSubscriptionInvoiceDto> CreateAsync(
            Guid? actorUserId, Guid tenantId, CreatePlatformSubscriptionInvoiceRequest request,
            bool autoApprove, CancellationToken cancellationToken = default)
        {
            CreatedFor = tenantId;
            return Task.FromResult<PlatformSubscriptionInvoiceDto>(null!);
        }

        public Task<IReadOnlyList<PlatformSubscriptionInvoiceDto>> GetAllAsync(
            string? statusFilter = null, string? search = null, CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        public Task<IReadOnlyList<PlatformSubscriptionInvoiceDto>> GetForTenantAsync(
            Guid tenantId, CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        public Task<PlatformSubscriptionInvoiceDto?> GetByIdAsync(
            Guid invoiceId, CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        public Task<PlatformSubscriptionInvoiceDto?> MarkPaidAsync(
            Guid invoiceId, MarkPlatformInvoicePaidRequest request, CancellationToken cancellationToken = default)
            => throw new NotImplementedException();

        public Task<PlatformSubscriptionInvoiceDto?> CancelAsync(
            Guid invoiceId, string? notes, CancellationToken cancellationToken = default)
            => throw new NotImplementedException();
    }
}
