using System.Security.Claims;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using CourseIntellect.Api.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/approvals")]
public sealed class ApprovalsController(IApprovalService approvalService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? status,
        [FromQuery] string? category,
        CancellationToken cancellationToken)
    {
        return Ok(await approvalService.GetAsync(status, category, cancellationToken));
    }

    [HttpGet("mine")]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId is null)
        {
            return Ok(Array.Empty<object>());
        }

        return Ok(await approvalService.GetByRequesterAsync(userId.Value, cancellationToken));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateApprovalRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Başlık zorunludur." });
        }

        return Ok(await approvalService.CreateAsync(request, CurrentUserId(), CurrentUserName(), cancellationToken));
    }

    [HttpPost("{id:guid}/decide")]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("approvals", "approve")]
    public async Task<IActionResult> Decide(Guid id, [FromBody] ApprovalDecisionRequest decision, CancellationToken cancellationToken)
    {
        var result = await approvalService.DecideAsync(id, decision, CurrentUserId(), CurrentUserName(), cancellationToken);
        return result is null ? NotFound() : Ok(result);
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
            ?? "Bilinmiyor";
    }
}

[ApiController]
[Authorize(Roles = "Admin,Administrative")]
[Route("api/audit-logs")]
public sealed class AuditLogsController(IAuditLogService auditLogService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? category,
        [FromQuery] int take = 200,
        CancellationToken cancellationToken = default)
    {
        return Ok(await auditLogService.GetAsync(category, take, cancellationToken));
    }

    /// <summary>
    /// Gelişmiş görünüm: kategori/şube/tarih/arama filtreleri + sayfalama.
    /// Şube müdürü query filter sayesinde yalnız kendi şubesinin kayıtlarını görür.
    /// </summary>
    [HttpGet("paged")]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? category,
        [FromQuery] Guid? branchId,
        [FromQuery] string? search,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 100,
        [FromQuery] string source = AuditLogSources.All,
        [FromQuery] bool onlyFailedLogins = false,
        [FromQuery] string? actor = null,
        CancellationToken cancellationToken = default)
    {
        var query = new AuditLogQuery(
            category, branchId, search, fromUtc, toUtc, skip, take, source, onlyFailedLogins, actor);
        return Ok(await auditLogService.GetPagedAsync(query, cancellationToken));
    }

    /// <summary>Şube bazında kayıt özetleri: kurum yöneticisi logları şube şube izleyebilsin.</summary>
    [HttpGet("branch-summary")]
    public async Task<IActionResult> GetBranchSummary(CancellationToken cancellationToken = default)
    {
        return Ok(await auditLogService.GetBranchSummaryAsync(cancellationToken));
    }
}
