namespace CourseIntellect.Domain.Entities;

public sealed class AttendanceEntry : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public DateTime LessonDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Lesson { get; set; } = string.Empty;
}
