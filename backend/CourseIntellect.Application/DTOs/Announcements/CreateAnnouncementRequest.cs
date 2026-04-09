namespace CourseIntellect.Application.DTOs.Announcements;

public sealed record CreateAnnouncementRequest(
    string Title,
    string Detail,
    string Audience
);
