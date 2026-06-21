namespace CourseIntellect.Application.DTOs.Duty;

public sealed record DutyTeacherRef(Guid? TeacherUserId, string TeacherName, string? TeacherUsername, string? TeacherBranch);

public sealed record CreateDutyRequest(
    string DutyType,
    string Location,
    DateTime DutyDate,
    string Day,
    string StartTime,
    string EndTime,
    string? Description,
    IReadOnlyList<DutyTeacherRef> Teachers,
    bool RepeatWeekly = false,
    int RepeatWeeks = 1);

public sealed record UpdateDutyRequest(
    string DutyType,
    string Location,
    DateTime DutyDate,
    string Day,
    string StartTime,
    string EndTime,
    string? Description);

public sealed record DutyResponse(
    Guid Id,
    Guid GroupId,
    string DutyType,
    string Location,
    DateTime DutyDateUtc,
    string Day,
    string StartTime,
    string EndTime,
    string Description,
    string Status,
    Guid? TeacherUserId,
    string TeacherName,
    string TeacherUsername,
    string TeacherBranch,
    DateTime CreatedAtUtc);

public sealed record DutyConflictDto(string TeacherName, DateTime DutyDateUtc, string StartTime, string EndTime);

public sealed record CreateDutyResult(
    IReadOnlyList<DutyResponse> Created,
    IReadOnlyList<DutyConflictDto> Conflicts);

public sealed record DutyStatsResponse(int Total, int Completed, int Planned, int Cancelled);

public sealed record TeacherDutyLoadDto(Guid? TeacherUserId, string TeacherName, int Count);
