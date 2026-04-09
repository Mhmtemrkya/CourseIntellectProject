using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Entities;

public sealed class ExamResult
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ExamTitle { get; set; } = string.Empty;
    public ExamType Type { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string DateLabel { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public int Score { get; set; }
    public int Net { get; set; }
}
