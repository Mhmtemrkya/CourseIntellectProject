namespace CourseIntellect.Domain.Entities;

public sealed class QuestionPracticeAttempt
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid QuestionId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string StudentUsername { get; set; } = string.Empty;
    public string AnswerText { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public DateTime SubmittedAtUtc { get; set; } = DateTime.UtcNow;
}
