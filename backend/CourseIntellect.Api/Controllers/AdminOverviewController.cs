using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Administrative")]
[Route("api/admin/overview")]
public sealed class AdminOverviewController(CourseIntellectDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var soon = now.AddDays(30);

        var pendingApprovals = await dbContext.ApprovalRequests.CountAsync(x => x.Status == "Pending", cancellationToken);
        var pendingLeaves = await dbContext.StaffLeaveRequests.CountAsync(x => x.Status == "Pending", cancellationToken);
        var openTasks = await dbContext.AdminTasks.CountAsync(x => x.Status == "Open" || x.Status == "InProgress", cancellationToken);
        var overdueTasks = await dbContext.AdminTasks.CountAsync(x => (x.Status == "Open" || x.Status == "InProgress") && x.DueDateUtc != null && x.DueDateUtc < now, cancellationToken);
        var expiringDocuments = await dbContext.AdminDocuments.CountAsync(x => x.Status == "Active" && x.ExpiryDateUtc != null && x.ExpiryDateUtc <= soon, cancellationToken);
        var assignedAssets = await dbContext.StaffAssetAssignments.CountAsync(x => x.Status == "Assigned", cancellationToken);
        var recentAudit = await dbContext.AuditLogEntries.CountAsync(x => x.CreatedAtUtc >= now.AddDays(-7), cancellationToken);

        return Ok(new
        {
            pendingApprovals,
            pendingLeaves,
            openTasks,
            overdueTasks,
            expiringDocuments,
            assignedAssets,
            recentAudit,
        });
    }
}
