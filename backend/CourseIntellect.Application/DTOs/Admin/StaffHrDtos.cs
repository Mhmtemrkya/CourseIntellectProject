namespace CourseIntellect.Application.DTOs.Admin;

public sealed record CreateLeaveRequest(
    Guid? StaffUserId,
    string StaffName,
    string LeaveType,
    DateTime StartDate,
    DateTime EndDate,
    string? Reason);

public sealed record LeaveDecisionRequest(string Status, string? Note);

public sealed record StaffLeaveDto(
    Guid Id,
    Guid? StaffUserId,
    string StaffName,
    string LeaveType,
    DateTime StartDateUtc,
    DateTime EndDateUtc,
    int Days,
    string Reason,
    string Status,
    string DecidedByName,
    DateTime CreatedAtUtc,
    DateTime? DecidedAtUtc);

public sealed record LeaveBalanceDto(
    string StaffName,
    int Entitlement,
    int UsedDays,
    int RemainingDays);

public sealed record AssignAssetRequest(
    Guid? StaffUserId,
    string StaffName,
    string AssetName,
    string? AssetCode,
    string? Note);

public sealed record StaffAssetDto(
    Guid Id,
    Guid? StaffUserId,
    string StaffName,
    string AssetName,
    string AssetCode,
    string Status,
    string Note,
    DateTime AssignedAtUtc,
    DateTime? ReturnedAtUtc);
