using CourseIntellect.Application.DTOs.PlatformOperations;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/platformops")]
public sealed class PlatformOperationsController(IPlatformOperationsService platformOperationsService) : ControllerBase
{
    private bool HasTenantContext()
    {
        var isPlatformAdmin = string.Equals(User.FindFirstValue("platform_admin"), "true", StringComparison.OrdinalIgnoreCase)
                              || User.IsInRole("Developer");
        return !isPlatformAdmin && !string.IsNullOrWhiteSpace(User.FindFirstValue("tenant_id"));
    }

    [HttpGet("overview")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetOverview(CancellationToken cancellationToken)
    {
        if (HasTenantContext()) return Forbid();
        var overview = await platformOperationsService.GetOverviewAsync(cancellationToken);
        return Ok(overview);
    }

    [HttpGet("tenants")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetTenants(CancellationToken cancellationToken)
    {
        if (HasTenantContext()) return Forbid();
        var items = await platformOperationsService.GetTenantsAsync(cancellationToken);
        return Ok(items);
    }

    [HttpPut("tenants")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpsertTenant([FromQuery] Guid? id, [FromBody] UpsertTenantWorkspaceRequest request, CancellationToken cancellationToken)
    {
        if (HasTenantContext()) return Forbid();
        var item = await platformOperationsService.UpsertTenantAsync(id, request, cancellationToken);
        return Ok(item);
    }

    [HttpGet("support-tickets")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetSupportTickets(CancellationToken cancellationToken)
    {
        if (HasTenantContext()) return Forbid();
        var items = await platformOperationsService.GetSupportTicketsAsync(cancellationToken);
        return Ok(items);
    }

    [HttpPost("support-tickets")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateSupportTicket([FromBody] CreateSupportTicketRequest request, CancellationToken cancellationToken)
    {
        if (HasTenantContext()) return Forbid();
        var item = await platformOperationsService.CreateSupportTicketAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpPost("tenants/register")]
    [AllowAnonymous]
    public async Task<IActionResult> RegisterTenant([FromBody] RegisterTenantRequest request, CancellationToken cancellationToken)
    {
        var item = await platformOperationsService.RegisterTenantAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpPut("tenants/{id:guid}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ApproveTenant(Guid id, CancellationToken cancellationToken)
    {
        if (HasTenantContext()) return Forbid();
        var item = await platformOperationsService.ApproveTenantAsync(id, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPut("tenants/{id:guid}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RejectTenant(Guid id, CancellationToken cancellationToken)
    {
        if (HasTenantContext()) return Forbid();
        var item = await platformOperationsService.RejectTenantAsync(id, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpDelete("tenants/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteTenant(Guid id, CancellationToken cancellationToken)
    {
        if (HasTenantContext()) return Forbid();
        var deleted = await platformOperationsService.DeleteTenantAsync(id, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("tenants/{id:guid}/reset-data")]
    [Authorize(Roles = "Admin,Developer")]
    public async Task<IActionResult> ResetTenantData(
        Guid id,
        [FromBody] ResetTenantDataRequest request,
        CancellationToken cancellationToken)
    {
        if (HasTenantContext()) return Forbid();

        var expectedConfirmation = $"RESET:{id:D}";
        if (!string.Equals(request.Confirmation?.Trim(), expectedConfirmation, StringComparison.Ordinal))
        {
            return BadRequest(new
            {
                message = "Kurum sıfırlama onayı geçersiz.",
                expectedConfirmation
            });
        }

        if (string.IsNullOrWhiteSpace(request.PreserveUsername))
        {
            return BadRequest(new { message = "Korunacak yönetici kullanıcı adı zorunludur." });
        }

        var result = await platformOperationsService.ResetTenantDataAsync(
            id,
            request.PreserveUsername.Trim(),
            cancellationToken);

        return result is null ? NotFound() : Ok(result);
    }

    [HttpPut("support-tickets/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateSupportTicket(Guid id, [FromBody] UpdateSupportTicketRequest request, CancellationToken cancellationToken)
    {
        if (HasTenantContext()) return Forbid();
        var item = await platformOperationsService.UpdateSupportTicketAsync(id, request, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }
}
