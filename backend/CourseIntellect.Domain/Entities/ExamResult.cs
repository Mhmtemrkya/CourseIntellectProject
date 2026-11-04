using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Entities;

public sealed class ExamResult : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string ExamTitle { get; set; } = string.Empty;
    public ExamType Type { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string DateLabel { get; set; } = string.Empty;
    /// <summary>
    /// Öğrenci profili (<see cref="StudentProfile.Id"/>). Aynı adlı iki öğrencinin
    /// sonuçları karışmasın diye eşleşme önce buna bakar; eski/çözülemeyen kayıtta null
    /// kalır ve ada düşülür. StudentName görüntü ve geriye uyum için tutulur.
    /// </summary>
    public Guid? StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public int Score { get; set; }
    public decimal Net { get; set; }
}
