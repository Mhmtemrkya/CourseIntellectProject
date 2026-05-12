namespace CourseIntellect.Application.DTOs.Announcements;

public sealed record AnnouncementDto(
    Guid Id,
    string Title,
    string Detail,
    string Audience,
    string DateLabel,
    string? ClassName,
    string? TeacherName
);
