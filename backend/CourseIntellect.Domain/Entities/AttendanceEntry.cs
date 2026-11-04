namespace CourseIntellect.Domain.Entities;

public sealed class AttendanceEntry : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    /// <summary>
    /// Öğrenci profili (<see cref="StudentProfile.Id"/>). Aynı adlı iki öğrencinin
    /// kayıtları karışmasın diye eşleşme önce buna bakar; eski/çözülemeyen kayıtta null
    /// kalır ve ada düşülür. StudentName görüntü ve geriye uyum için tutulur.
    /// </summary>
    public Guid? StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public DateTime LessonDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Lesson { get; set; } = string.Empty;
}
