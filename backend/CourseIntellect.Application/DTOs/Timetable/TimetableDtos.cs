namespace CourseIntellect.Application.DTOs.Timetable;

public sealed record TimetableSlotRequest(
    int DayOfWeek,
    string StartTime,
    string EndTime,
    string? ClassName,
    string? Lesson);

public sealed record SetTimetableRequest(
    Guid? TeacherUserId,
    string TeacherName,
    IReadOnlyList<TimetableSlotRequest> Slots);

public sealed record TimetableSlotResponse(
    Guid Id,
    Guid? TeacherUserId,
    string TeacherName,
    int DayOfWeek,
    string StartTime,
    string EndTime,
    string ClassName,
    string Lesson);
