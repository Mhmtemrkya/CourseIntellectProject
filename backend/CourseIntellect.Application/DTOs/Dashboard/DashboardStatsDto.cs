namespace CourseIntellect.Application.DTOs.Dashboard;

public sealed record DashboardStatsDto(
    int TotalUsers,
    int ActiveUsers,
    int TotalCourses,
    int ActiveCourses,
    int TotalMessages,
    int UnreadMessages,
    int TotalRegistrations,
    int PendingRegistrations,
    int TotalLoginAttempts,
    int FailedLoginAttempts
);
