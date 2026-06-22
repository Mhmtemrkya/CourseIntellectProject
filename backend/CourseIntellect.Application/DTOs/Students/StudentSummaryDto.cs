namespace CourseIntellect.Application.DTOs.Students;

public sealed record StudentSummaryDto(
    Guid Id,
    Guid UserId,
    string FullName,
    string TcNo,
    string ClassName,
    string CurrentSchool,
    string SchoolNumber,
    string BirthDate,
    string ProgramType,
    string ParentName,
    string ParentPhone,
    string ParentEmail,
    string Address,
    string Note,
    string Username,
    string Status,
    IReadOnlyList<string> ExtraRoles
);
