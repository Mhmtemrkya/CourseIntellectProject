using CourseIntellect.Application.DTOs.Common;
using CourseIntellect.Application.DTOs.Users;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class UsersController(IUserDirectoryService userDirectoryService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetUsers([FromQuery] int page = 1, [FromQuery] int pageSize = 200, CancellationToken cancellationToken = default)
    {
        var result = await userDirectoryService.GetUsersPagedAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateUser([FromBody] AdminCreateUserRequest request, CancellationToken cancellationToken)
    {
        var created = await userDirectoryService.CreateUserAsync(request, cancellationToken);
        return Ok(created);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] AdminUpdateUserRequest request, CancellationToken cancellationToken)
    {
        var updated = await userDirectoryService.UpdateUserAsync(id, request, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteUser(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await userDirectoryService.DeleteUserAsync(id, cancellationToken);
        return deleted ? Ok(new { id }) : NotFound();
    }

    [HttpGet("registrations")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetRegistrations([FromQuery] int page = 1, [FromQuery] int pageSize = 200, CancellationToken cancellationToken = default)
    {
        var result = await userDirectoryService.GetRegistrationsAsync(page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles(CancellationToken cancellationToken)
    {
        var roles = await userDirectoryService.GetRolesAsync(cancellationToken);
        return Ok(roles);
    }

    [HttpPut("{username}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateStatus(string username, [FromBody] UserStatusUpdateRequest request, CancellationToken cancellationToken)
    {
        await userDirectoryService.UpdateUserStatusAsync(username, request, cancellationToken);
        return NoContent();
    }

    [HttpPut("{username}/primary-role")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AssignPrimaryRole(string username, [FromBody] UserRoleAssignmentRequest request, CancellationToken cancellationToken)
    {
        await userDirectoryService.AssignPrimaryRoleAsync(username, request, cancellationToken);
        return NoContent();
    }

    [HttpPost("{username}/extra-roles")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddExtraRole(string username, [FromBody] UserExtraRoleRequest request, CancellationToken cancellationToken)
    {
        await userDirectoryService.AddExtraRoleAsync(username, request, cancellationToken);
        return NoContent();
    }

    [HttpPost("{username}/undo-role-assignment")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UndoRoleAssignment(string username, CancellationToken cancellationToken)
    {
        var success = await userDirectoryService.UndoLastRoleAssignmentAsync(username, cancellationToken);
        return Ok(new { success });
    }

    [HttpPut("roles/{roleName}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateRolePolicy(string roleName, [FromBody] RolePolicyUpdateRequest request, CancellationToken cancellationToken)
    {
        await userDirectoryService.UpdateRolePolicyAsync(roleName, request, cancellationToken);
        return NoContent();
    }
}
