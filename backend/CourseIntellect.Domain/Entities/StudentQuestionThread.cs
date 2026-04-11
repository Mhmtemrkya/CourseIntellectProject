namespace CourseIntellect.Domain.Entities;

public sealed class StudentQuestionThread : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    public string StudentUsername { get; set; } = string.Empty;
    public string TeacherName { get; set; } = string.Empty;
    public string QuestionText { get; set; } = string.Empty;
    public string Status { get; set; } = "Bekliyor";
    public string CreatedAtLabel { get; set; } = string.Empty;
    public string LastActivityLabel { get; set; } = string.Empty;
    public string AttachmentSummary { get; set; } = "Eksiz";
    public string AttachmentsSerialized { get; set; } = "[]";
}
