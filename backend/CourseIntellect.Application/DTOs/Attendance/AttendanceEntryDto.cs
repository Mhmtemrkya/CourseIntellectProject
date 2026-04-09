namespace CourseIntellect.Application.DTOs.Attendance;

public sealed record AttendanceEntryDto(
    Guid Id,
    string StudentName,
    string ClassName,
    DateTime LessonDate,
    string Status,
    string Lesson);
