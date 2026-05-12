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
    private bool HasTenantContext() => !string.IsNullOrWhiteSpace(User.FindFirstValue("tenant_id"));

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
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
        {
            return BadRequest(new { message = "Kurum yöneticisi şifresi en az 8 karakter olmalı." });
        }

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

    [HttpPut("support-tickets/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateSupportTicket(Guid id, [FromBody] UpdateSupportTicketRequest request, CancellationToken cancellationToken)
    {
        if (HasTenantContext()) return Forbid();
        var item = await platformOperationsService.UpdateSupportTicketAsync(id, request, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }
}
