namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Öğretmenin haftalık ders programı slotu. Nöbet atamasında "kendi ders saatinde
/// çakışma" tespiti için kullanılır. <see cref="DayOfWeek"/>: 1=Pazartesi .. 7=Pazar.
/// </summary>
public sealed class TeacherTimetableSlot : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? TeacherUserId { get; set; }
    public string TeacherName { get; set; } = string.Empty;
    public int DayOfWeek { get; set; }
    public string StartTime { get; set; } = string.Empty;
    public string EndTime { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string Lesson { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
