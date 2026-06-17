using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class StaffHrService(
    CourseIntellectDbContext dbContext,
    IApprovalService approvalService,
    IAuditLogService auditLogService) : IStaffHrService
{
    private const int AnnualLeaveEntitlement = 14;

    public async Task<StaffLeaveDto> CreateLeaveAsync(
        CreateLeaveRequest request,
        Guid? requesterUserId,
        string requesterName,
        CancellationToken cancellationToken = default)
    {
        var start = AsUtc(request.StartDate);
        var end = AsUtc(request.EndDate);
        if (end < start) end = start;
        var days = (int)Math.Round((end.Date - start.Date).TotalDays) + 1;
        if (days < 1) days = 1;

        var staffName = string.IsNullOrWhiteSpace(request.StaffName) ? requesterName : request.StaffName.Trim();
        var leaveType = string.IsNullOrWhiteSpace(request.LeaveType) ? "Yıllık" : request.LeaveType.Trim();

        var leave = new StaffLeaveRequest
        {
            StaffUserId = request.StaffUserId ?? requesterUserId,
            StaffName = staffName,
            LeaveType = leaveType,
            StartDateUtc = start,
            EndDateUtc = end,
            Days = days,
            Reason = request.Reason?.Trim() ?? string.Empty,
            Status = "Pending",
            CreatedAtUtc = DateTime.UtcNow,
        };
        await dbContext.StaffLeaveRequests.AddAsync(leave, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        // Merkezi onay motoruna düşür (Onay Merkezi'nde görünür).
        var approval = await approvalService.CreateAsync(
            new CreateApprovalRequest(
                "İzin",
                $"{staffName} • {leaveType} izni ({days} gün)",
                leave.Reason,
                null,
                "Normal",
                staffName,
                "Leave",
                leave.Id.ToString()),
            requesterUserId,
            requesterName,
            cancellationToken);
        leave.ApprovalRequestId = approval.Id;
        await dbContext.SaveChangesAsync(cancellationToken);

        return Map(leave);
    }

    public async Task<IReadOnlyList<StaffLeaveDto>> GetLeavesAsync(
        string? status,
        string? staffName,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.StaffLeaveRequests.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalized = status.Trim();
            query = query.Where(item => item.Status == normalized);
        }

        if (!string.IsNullOrWhiteSpace(staffName))
        {
            var normalized = staffName.Trim();
            query = query.Where(item => item.StaffName == normalized);
        }

        return await query
            .OrderByDescending(item => item.CreatedAtUtc)
            .Select(item => Map(item))
            .ToListAsync(cancellationToken);
    }

    public async Task<StaffLeaveDto?> DecideLeaveAsync(
        Guid id,
        LeaveDecisionRequest decision,
        Guid? deciderUserId,
        string deciderName,
        CancellationToken cancellationToken = default)
    {
        var leave = await dbContext.StaffLeaveRequests.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (leave is null) return null;

        var status = decision.Status.Trim();
        leave.Status = status switch
        {
            "Approved" or "Onaylandı" => "Approved",
            "Rejected" or "Reddedildi" => "Rejected",
            _ => leave.Status,
        };
        leave.DecidedByUserId = deciderUserId;
        leave.DecidedByName = string.IsNullOrWhiteSpace(deciderName) ? "Yönetici" : deciderName.Trim();
        leave.DecidedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        // Bağlı onay kaydını da senkronla.
        if (leave.ApprovalRequestId is Guid approvalId)
        {
            await approvalService.DecideAsync(approvalId, new ApprovalDecisionRequest(leave.Status, decision.Note), deciderUserId, deciderName, cancellationToken);
        }

        await auditLogService.LogAsync(deciderUserId, leave.DecidedByName, $"İzin {leave.Status}",
            "HR", nameof(StaffLeaveRequest), leave.Id.ToString(),
            $"{leave.StaffName} • {leave.LeaveType} • {leave.Days} gün", cancellationToken);

        return Map(leave);
    }

    public async Task<LeaveBalanceDto> GetLeaveBalanceAsync(
        string staffName,
        CancellationToken cancellationToken = default)
    {
        var name = staffName.Trim();
        var used = await dbContext.StaffLeaveRequests.AsNoTracking()
            .Where(item => item.StaffName == name && item.Status == "Approved" && item.LeaveType == "Yıllık")
            .SumAsync(item => (int?)item.Days, cancellationToken) ?? 0;

        return new LeaveBalanceDto(name, AnnualLeaveEntitlement, used, AnnualLeaveEntitlement - used);
    }

    public async Task<StaffAssetDto> AssignAssetAsync(
        AssignAssetRequest request,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var asset = new StaffAssetAssignment
        {
            StaffUserId = request.StaffUserId,
            StaffName = request.StaffName.Trim(),
            AssetName = request.AssetName.Trim(),
            AssetCode = request.AssetCode?.Trim() ?? string.Empty,
            Status = "Assigned",
            Note = request.Note?.Trim() ?? string.Empty,
            AssignedAtUtc = DateTime.UtcNow,
        };
        await dbContext.StaffAssetAssignments.AddAsync(asset, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(actorUserId, actorName, "Zimmet atandı",
            "HR", nameof(StaffAssetAssignment), asset.Id.ToString(),
            $"{asset.StaffName} ← {asset.AssetName}", cancellationToken);

        return Map(asset);
    }

    public async Task<IReadOnlyList<StaffAssetDto>> GetAssetsAsync(
        string? staffName,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.StaffAssetAssignments.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(staffName))
        {
            var normalized = staffName.Trim();
            query = query.Where(item => item.StaffName == normalized);
        }

        return await query
            .OrderByDescending(item => item.AssignedAtUtc)
            .Select(item => Map(item))
            .ToListAsync(cancellationToken);
    }

    public async Task<StaffAssetDto?> ReturnAssetAsync(
        Guid id,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var asset = await dbContext.StaffAssetAssignments.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (asset is null) return null;

        asset.Status = "Returned";
        asset.ReturnedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(actorUserId, actorName, "Zimmet iade edildi",
            "HR", nameof(StaffAssetAssignment), asset.Id.ToString(),
            $"{asset.StaffName} → {asset.AssetName}", cancellationToken);

        return Map(asset);
    }

    private static DateTime AsUtc(DateTime value) =>
        value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);

    private static StaffLeaveDto Map(StaffLeaveRequest item) => new(
        item.Id,
        item.StaffUserId,
        item.StaffName,
        item.LeaveType,
        item.StartDateUtc,
        item.EndDateUtc,
        item.Days,
        item.Reason,
        item.Status,
        item.DecidedByName,
        item.CreatedAtUtc,
        item.DecidedAtUtc);

    private static StaffAssetDto Map(StaffAssetAssignment item) => new(
        item.Id,
        item.StaffUserId,
        item.StaffName,
        item.AssetName,
        item.AssetCode,
        item.Status,
        item.Note,
        item.AssignedAtUtc,
        item.ReturnedAtUtc);
}
