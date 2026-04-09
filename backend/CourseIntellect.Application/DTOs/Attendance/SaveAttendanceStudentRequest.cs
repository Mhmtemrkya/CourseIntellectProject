namespace CourseIntellect.Application.DTOs.Attendance;

public sealed record SaveAttendanceStudentRequest(
    string Name,
    string Status);
