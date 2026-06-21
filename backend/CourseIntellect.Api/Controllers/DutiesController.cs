using System.Security.Claims;
using CourseIntellect.Application.DTOs.Duty;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/duties")]
public sealed class DutiesController(ITeacherDutyService dutyService) : ControllerBase
{
    [HttpPost]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> Create([FromBody] CreateDutyRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.DutyType) || string.IsNullOrWhiteSpace(request.Location))
        {
            return BadRequest(new { message = "Nöbet türü ve yeri zorunludur." });
        }
        if (request.Teachers is null || request.Teachers.Count == 0)
        {
            return BadRequest(new { message = "En az bir öğretmen seçilmelidir." });
        }

        try
        {
            var result = await dutyService.CreateAsync(request, CurrentUserId(), CurrentUserName(), cancellationToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDutyRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await dutyService.UpdateAsync(id, request, CurrentUserId(), CurrentUserName(), cancellationToken);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/status")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> SetStatus(Guid id, [FromBody] DutyStatusRequest request, CancellationToken cancellationToken)
    {
        var result = await dutyService.SetStatusAsync(id, request.Status ?? string.Empty, CurrentUserId(), CurrentUserName(), cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var ok = await dutyService.DeleteAsync(id, CurrentUserId(), CurrentUserName(), cancellationToken);
        return ok ? Ok(new { deleted = true }) : NotFound();
    }

    [HttpPost("group/{groupId:guid}/cancel")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> CancelSeries(Guid groupId, CancellationToken cancellationToken)
    {
        var count = await dutyService.CancelSeriesAsync(groupId, CurrentUserId(), CurrentUserName(), cancellationToken);
        return Ok(new { cancelled = count });
    }

    [HttpGet("mine")]
    [Authorize(Roles = "Teacher,Admin,Administrative")]
    public async Task<IActionResult> Mine([FromQuery] string? scope, CancellationToken cancellationToken)
    {
        return Ok(await dutyService.GetMineAsync(CurrentUserId(), CurrentUserName(), scope ?? "all", cancellationToken));
    }

    [HttpGet("mine/stats")]
    [Authorize(Roles = "Teacher,Admin,Administrative")]
    public async Task<IActionResult> MineStats(CancellationToken cancellationToken)
    {
        return Ok(await dutyService.GetMineStatsAsync(CurrentUserId(), CurrentUserName(), cancellationToken));
    }

    [HttpGet]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> All([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? dutyType, CancellationToken cancellationToken)
    {
        return Ok(await dutyService.GetAllAsync(from, to, dutyType, cancellationToken));
    }

    [HttpGet("load")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> Load([FromQuery] DateTime? monthStart, CancellationToken cancellationToken)
    {
        return Ok(await dutyService.GetLoadAsync(monthStart, cancellationToken));
    }

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    private string CurrentUserName()
    {
        return User.FindFirstValue("name")
            ?? User.FindFirstValue(ClaimTypes.Name)
            ?? User.FindFirstValue("unique_name")
            ?? User.Identity?.Name
            ?? string.Empty;
    }
}

public sealed record DutyStatusRequest(string? Status);
