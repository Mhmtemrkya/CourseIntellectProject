namespace CourseIntellect.Domain.Entities;

public sealed class AttendanceEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string StudentName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public DateTime LessonDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Lesson { get; set; } = string.Empty;
}
