namespace CourseIntellect.Application.DTOs.Clubs;

/// <summary>İsteği yapan kişinin kulüp modülündeki konumu (denetleyici oturumdan kurar).</summary>
public enum ClubViewerKind
{
    Manager = 1,
    Staff = 2,
    Teacher = 3,
    Student = 4,
    Parent = 5,
}

public sealed record ClubViewer(ClubViewerKind Kind, Guid? UserId, IReadOnlyList<Guid> ChildUserIds);

public sealed record ClubSummaryDto(
    Guid Id,
    string Name,
    string Category,
    string Description,
    string AcademicYear,
    Guid? AdvisorTeacherUserId,
    string AdvisorTeacherName,
    int Capacity,
    int MemberCount,
    int PendingCount,
    string MeetingSchedule,
    string Location,
    string Color,
    bool AcceptsRequests,
    string Status,
    /// <summary>Öğrenci için kendi üyelik durumu (Pending/Active/Rejected/Left); yoksa null.</summary>
    string? MyStatus,
    string? MyRole,
    /// <summary>İsteyen kişi bu kulübü yönetebilir mi (yönetici ya da danışman).</summary>
    bool CanManage,
    DateTime? NextActivityAtUtc);

public sealed record ClubMemberDto(
    Guid Id,
    Guid StudentUserId,
    string StudentName,
    string ClassName,
    string Role,
    string Status,
    string RequestNote,
    string DecisionNote,
    DateTime RequestedAtUtc,
    DateTime? JoinedAtUtc);

public sealed record ClubActivityDto(
    Guid Id,
    Guid ClubId,
    string ClubName,
    string Title,
    string Description,
    DateTime StartsAtUtc,
    string Location,
    string Status,
    int? AttendeeCount,
    string Outcome);

public sealed record ClubDetailDto(
    ClubSummaryDto Club,
    IReadOnlyList<ClubMemberDto> Members,
    IReadOnlyList<ClubActivityDto> Activities);

public sealed record ClubOverviewDto(
    string AcademicYear,
    int ClubCount,
    int ActiveMemberCount,
    int PendingRequestCount,
    int StudentsInClubs,
    int UpcomingActivityCount,
    IReadOnlyList<ClubSummaryDto> Clubs);

public sealed record SaveClubRequest(
    string Name,
    string? Category,
    string? Description,
    string? AcademicYear,
    Guid? AdvisorTeacherUserId,
    int? Capacity,
    string? MeetingSchedule,
    string? Location,
    string? Color,
    bool? AcceptsRequests,
    string? Status);

public sealed record AddClubMemberRequest(Guid StudentUserId, string? Role);

/// <summary>Action: approve, reject, setRole, remove. Role yalnız setRole/approve ile.</summary>
public sealed record UpdateClubMemberRequest(string Action, string? Role, string? Note);

public sealed record JoinClubRequest(string? Note);

public sealed record SaveClubActivityRequest(
    string Title,
    string? Description,
    DateTime StartsAtUtc,
    string? Location,
    string? Status,
    int? AttendeeCount,
    string? Outcome);

public sealed record ClubPersonOptionDto(Guid UserId, string FullName, string Detail);
