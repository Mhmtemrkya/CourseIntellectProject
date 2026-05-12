namespace CourseIntellect.Domain.Entities;

public sealed class StudentQuestionReply : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid ThreadId { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string SenderRole { get; set; } = string.Empty;
    public string MessageText { get; set; } = string.Empty;
    public string CreatedAtLabel { get; set; } = string.Empty;
    public string AttachmentsSerialized { get; set; } = "[]";
}
