using CourseIntellect.Application.DTOs.Scope;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Context switcher'ın veri kaynağı. Kullanıcının grant'larından erişilebilir kurum/şube
/// ağacını, o an aktif bağlamı ve "geçiş yapabilir mi" bayraklarını döner.
/// Tek-kapsamlı kullanıcıda <c>CanSwitchTenant/Branch = false</c> → frontend seçiciyi gizler.
/// </summary>
[ApiController]
[Authorize]
[Route("api/my-scope")]
public sealed class MyScopeController(
    IUserScopeService userScopeService,
    IActiveScope activeScope) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        if (ResolveUserId() is not Guid userId)
        {
            return Unauthorized();
        }

        var options = await userScopeService.GetScopeOptionsAsync(userId, cancellationToken);

        var activeTenantId = activeScope.IsResolved ? activeScope.TenantId : ParseGuid(User.FindFirstValue("tenant_id"));
        var activeBranchId = activeScope.IsResolved ? activeScope.BranchId : ParseGuid(User.FindFirstValue("branch_id"));

        var activeTenant = activeTenantId is Guid tid
            ? options.Tenants.FirstOrDefault(t => t.Id == tid)
            : null;

        var response = new MyScopeResponse(
            CanSwitchTenant: options.Tenants.Count > 1,
            CanSwitchBranch: activeTenant is { Branches.Count: > 1 },
            ReadOnly: options.ReadOnly,
            Active: new ScopeActiveDto(activeTenantId, activeBranchId),
            Tenants: options.Tenants);

        return Ok(response);
    }

    /// <summary>Konsolide roll-up: erişilebilir tüm kurumların özet metrikleri + genel toplam.
    /// Kurum sahibi/MEB'in "tüm kurumlarım tek ekranda" görünümü.</summary>
    [HttpGet("rollup")]
    public async Task<IActionResult> GetRollup(CancellationToken cancellationToken)
    {
        if (ResolveUserId() is not Guid userId)
        {
            return Unauthorized();
        }

        return Ok(await userScopeService.GetRollupAsync(userId, cancellationToken));
    }

    private Guid? ResolveUserId() =>
        ParseGuid(User.FindFirstValue("user_id")
            ?? User.FindFirstValue("nameid")
            ?? User.FindFirstValue("sub")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier));

    private static Guid? ParseGuid(string? raw) => Guid.TryParse(raw, out var value) ? value : null;
}
