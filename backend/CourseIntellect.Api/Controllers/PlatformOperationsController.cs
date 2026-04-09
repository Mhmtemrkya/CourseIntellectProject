using CourseIntellect.Application.DTOs.PlatformOperations;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/platformops")]
public sealed class PlatformOperationsController(IPlatformOperationsService platformOperationsService) : ControllerBase
{
    [HttpGet("overview")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetOverview(CancellationToken cancellationToken)
    {
        var overview = await platformOperationsService.GetOverviewAsync(cancellationToken);
        return Ok(overview);
    }

    [HttpGet("tenants")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetTenants(CancellationToken cancellationToken)
    {
        var items = await platformOperationsService.GetTenantsAsync(cancellationToken);
        return Ok(items);
    }

    [HttpPut("tenants")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpsertTenant([FromQuery] Guid? id, [FromBody] UpsertTenantWorkspaceRequest request, CancellationToken cancellationToken)
    {
        var item = await platformOperationsService.UpsertTenantAsync(id, request, cancellationToken);
        return Ok(item);
    }

    [HttpGet("support-tickets")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetSupportTickets(CancellationToken cancellationToken)
    {
        var items = await platformOperationsService.GetSupportTicketsAsync(cancellationToken);
        return Ok(items);
    }

    [HttpPost("support-tickets")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateSupportTicket([FromBody] CreateSupportTicketRequest request, CancellationToken cancellationToken)
    {
        var item = await platformOperationsService.CreateSupportTicketAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpPut("support-tickets/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateSupportTicket(Guid id, [FromBody] UpdateSupportTicketRequest request, CancellationToken cancellationToken)
    {
        var item = await platformOperationsService.UpdateSupportTicketAsync(id, request, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }
}
