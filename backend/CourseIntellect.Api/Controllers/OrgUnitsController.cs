using System.Security.Claims;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Administrative")]
[Route("api/org-units")]
public sealed class OrgUnitsController(IOrgUnitService orgUnitService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken) =>
        Ok(await orgUnitService.GetAsync(cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateOrgUnitRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Birim adı zorunludur." });
        }

        return Ok(await orgUnitService.CreateAsync(request, CurrentUserId(), CurrentUserName(), cancellationToken));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateOrgUnitRequest request, CancellationToken cancellationToken)
    {
        var result = await orgUnitService.UpdateAsync(id, request, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        await orgUnitService.DeleteAsync(id, cancellationToken) ? NoContent() : NotFound();

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
