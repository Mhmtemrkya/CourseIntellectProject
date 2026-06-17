using CourseIntellect.Application.DTOs.Admin;

namespace CourseIntellect.Application.Interfaces;

public interface IStaffHrService
{
    Task<StaffLeaveDto> CreateLeaveAsync(
        CreateLeaveRequest request,
        Guid? requesterUserId,
        string requesterName,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<StaffLeaveDto>> GetLeavesAsync(
        string? status,
        string? staffName,
        CancellationToken cancellationToken = default);

    Task<StaffLeaveDto?> DecideLeaveAsync(
        Guid id,
        LeaveDecisionRequest decision,
        Guid? deciderUserId,
        string deciderName,
        CancellationToken cancellationToken = default);

    Task<LeaveBalanceDto> GetLeaveBalanceAsync(
        string staffName,
        CancellationToken cancellationToken = default);

    Task<StaffAssetDto> AssignAssetAsync(
        AssignAssetRequest request,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<StaffAssetDto>> GetAssetsAsync(
        string? staffName,
        CancellationToken cancellationToken = default);

    Task<StaffAssetDto?> ReturnAssetAsync(
        Guid id,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default);
}
