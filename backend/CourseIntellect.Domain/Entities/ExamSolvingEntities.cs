namespace CourseIntellect.Domain.Entities;

public sealed class ExamSession : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? PlannedExamId { get; set; }
    public Guid? StudentUserId { get; set; }
    public Guid? TeacherPreviewUserId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string StudentUsername { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public int DurationSeconds { get; set; }
    public bool IsTeacherPreview { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime StartedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAtUtc { get; set; }
}

public sealed class ExamQuestion : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? PlannedExamId { get; set; }
    public Guid QuestionBankItemId { get; set; }
    public int SortOrder { get; set; }
    public int Point { get; set; } = 1;
}

public sealed class QuestionAttempt : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid ExamSessionId { get; set; }
    public Guid QuestionBankItemId { get; set; }
    public int SortOrder { get; set; }
    public string Status { get; set; } = "Unanswered";
    public bool IsFlagged { get; set; }
    public string FlagType { get; set; } = string.Empty;
    public int TimeSpentSeconds { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LastInteractionAtUtc { get; set; }
}

public sealed class AnswerSelection : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid QuestionAttemptId { get; set; }
    public int SelectedOptionIndex { get; set; } = -1;
    public string? OpenAnswer { get; set; }
    public bool IsCorrect { get; set; }
    public DateTime SavedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class CanvasStroke : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid QuestionAttemptId { get; set; }
    public string Tool { get; set; } = "pen";
    public string Color { get; set; } = "#F97316";
    public decimal Width { get; set; } = 3;
    public decimal Opacity { get; set; } = 1;
    public decimal? Pressure { get; set; }
    public string PointsJson { get; set; } = "[]";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class CanvasSnapshot : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid QuestionAttemptId { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public string ContentType { get; set; } = "image/png";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class StudentNote : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid QuestionAttemptId { get; set; }
    public string Note { get; set; } = string.Empty;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class PdfReport : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid ExamSessionId { get; set; }
    public string Status { get; set; } = "Queued";
    public string? StorageKey { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ReadyAtUtc { get; set; }
}

public sealed class TeacherReviewComment : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid QuestionAttemptId { get; set; }
    public Guid? TeacherUserId { get; set; }
    public string TeacherName { get; set; } = string.Empty;
    public string Comment { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class ReportRecipient : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid PdfReportId { get; set; }
    public Guid? UserId { get; set; }
    public string Role { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class LiveExamState : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid ExamSessionId { get; set; }
    public Guid? ActiveQuestionAttemptId { get; set; }
    public int RemainingSeconds { get; set; }
    public string StatusSummaryJson { get; set; } = "{}";
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
