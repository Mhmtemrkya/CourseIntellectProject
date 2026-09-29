using System.Security.Claims;
using CourseIntellect.Application.DTOs.PlatformSubscriptions;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/platformsubscriptions")]
public sealed class PlatformSubscriptionsController(
    IPlatformSubscriptionService service,
    ITenantContext tenantContext,
    IConfiguration configuration) : ControllerBase
{
    /// <summary>
    /// Marketing site checkout: kullanıcı giriş yapmış kurum, paket satın alır.
    /// Şu an direkt onaylama (autoApprove=true). Ödeme entegrasyonu sonra eklenir.
    /// </summary>
    [HttpPost("purchase")]
    public async Task<IActionResult> Purchase(
        [FromBody] CreatePlatformSubscriptionInvoiceRequest request,
        CancellationToken cancellationToken)
    {
        // Ücretsiz dönemde self-servis satın alma kapalıdır (akış silinmedi; geri
        // açmak için "Billing:Enabled" = true). Platform faturaları yönetim ekranından
        // yürümeye devam eder.
        if (!configuration.GetValue<bool>("Billing:Enabled"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                code = "BILLING_DISABLED",
                message = "Paket satın alma şu an kapalı; kurumlar platformu ücretsiz kullanabilir.",
            });
        }

        var (actorId, tenantId) = GetClaims();
        // Başka bir kurum adına fatura yalnız kurumsuz platform hesabı açabilir;
        // aksi hâlde herhangi bir kullanıcı başka kuruma "ödenmiş" abonelik yazabilirdi.
        if (tenantId == Guid.Empty && request.TenantId.HasValue && request.TenantId.Value != Guid.Empty)
        {
            tenantId = request.TenantId.Value;
        }

        if (tenantId == Guid.Empty)
        {
            return BadRequest(new { message = "Kurum kimliği belirlenemedi. Lütfen tekrar giriş yapın." });
        }

        try
        {
            var invoice = await service.CreateAsync(actorId, tenantId, request, autoApprove: true, cancellationToken);
            return Ok(invoice);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Mevcut kurumun aboneliği faturaları (kendisi görür).
    /// </summary>
    [HttpGet("mine")]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
    {
        var (_, tenantId) = GetClaims();
        if (tenantId == Guid.Empty)
        {
            return Ok(Array.Empty<PlatformSubscriptionInvoiceDto>());
        }
        var list = await service.GetForTenantAsync(tenantId, cancellationToken);
        return Ok(list);
    }

    /// <summary>
    /// Platform admin: tüm faturalar.
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status,
        [FromQuery] string? search,
        CancellationToken cancellationToken)
    {
        var list = await service.GetAllAsync(status, search, cancellationToken);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var invoice = await service.GetByIdAsync(id, cancellationToken);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    [HttpPut("{id:guid}/pay")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> MarkPaid(
        Guid id,
        [FromBody] MarkPlatformInvoicePaidRequest request,
        CancellationToken cancellationToken)
    {
        var invoice = await service.MarkPaidAsync(id, request ?? new MarkPlatformInvoicePaidRequest(), cancellationToken);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    [HttpPut("{id:guid}/cancel")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Cancel(
        Guid id,
        [FromBody] MarkPlatformInvoicePaidRequest request,
        CancellationToken cancellationToken)
    {
        var invoice = await service.CancelAsync(id, request?.Notes, cancellationToken);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    private (Guid actorId, Guid tenantId) GetClaims()
    {
        var actorRaw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        Guid.TryParse(actorRaw, out var actorId);
        var tenantId = tenantContext.CurrentTenantId ?? Guid.Empty;
        return (actorId, tenantId);
    }
}
