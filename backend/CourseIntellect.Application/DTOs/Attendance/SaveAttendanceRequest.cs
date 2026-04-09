namespace CourseIntellect.Application.DTOs.Attendance;

public sealed record SaveAttendanceRequest(
    string ClassName,
    string Lesson,
    DateTime? LessonDate,
    IReadOnlyList<SaveAttendanceStudentRequest> Students);
