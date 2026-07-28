using CourseIntellect.Application.DTOs.Staff;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using CourseIntellect.Api.Authorization;
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
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("teachers", "create")]
    [ProducesResponseType(typeof(StaffCredentialsDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromBody] CreateStaffRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await staffManagementService.CreateStaffAsync(request, cancellationToken);
            return CreatedAtAction(nameof(Get), new { role = result.Role }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("teachers", "edit")]
    [ProducesResponseType(typeof(StaffSummaryDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateStaffRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await staffManagementService.UpdateStaffAsync(id, request, cancellationToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Var olan kullanıcının rol/şube/özel rol atamasını günceller (ev grant'ı yenilenir).
    /// Örn. mevcut bir öğretmeni şube müdürü yapmak için kişiyi silip yeniden açmak GEREKMEZ.</summary>
    [HttpPut("users/{userId:guid}/assignment")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateAssignment(
        Guid userId,
        [FromBody] UpdateStaffAssignmentRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return await staffManagementService.UpdateAssignmentAsync(userId, request, cancellationToken)
                ? Ok(new { message = "Atama güncellendi." })
                : NotFound(new { message = "Kullanıcı bulunamadı." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("users/{userId:guid}")]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("teachers")]
    public async Task<IActionResult> DeleteByUserId(Guid userId, CancellationToken cancellationToken)
    {
        try
        {
            return await staffManagementService.DeleteStaffByUserIdAsync(userId, cancellationToken)
                ? NoContent()
                : NotFound(new { message = "Personel kullanıcısı bulunamadı." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("accounting")]
    [Authorize(Roles = "Admin")]
    [RequireEntitlement("registrations", "staff-register")]
    [ProducesResponseType(typeof(StaffCredentialsDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateAccounting(
        [FromBody] CreateAccountingStaffRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await staffManagementService.CreateAccountingStaffAsync(request, cancellationToken);
            return CreatedAtAction(nameof(Get), new { role = "Accounting" }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
