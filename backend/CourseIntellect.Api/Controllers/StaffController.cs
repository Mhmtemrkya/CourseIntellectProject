using CourseIntellect.Application.DTOs.Staff;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class StaffController(IStaffManagementService staffManagementService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? role, CancellationToken cancellationToken)
    {
        var staff = await staffManagementService.GetStaffAsync(role, cancellationToken);
        return Ok(staff);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(StaffCredentialsDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromBody] CreateStaffRequest request,
        CancellationToken cancellationToken)
    {
        var result = await staffManagementService.CreateStaffAsync(request, cancellationToken);
        return CreatedAtAction(nameof(Get), new { role = result.Role }, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(StaffSummaryDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateStaffRequest request,
        CancellationToken cancellationToken)
    {
        var result = await staffManagementService.UpdateStaffAsync(id, request, cancellationToken);
        return Ok(result);
    }

    [HttpPost("accounting")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(StaffCredentialsDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateAccounting(
        [FromBody] CreateAccountingStaffRequest request,
        CancellationToken cancellationToken)
    {
        var result = await staffManagementService.CreateAccountingStaffAsync(request, cancellationToken);
        return CreatedAtAction(nameof(Get), new { role = "Accounting" }, result);
    }
}
