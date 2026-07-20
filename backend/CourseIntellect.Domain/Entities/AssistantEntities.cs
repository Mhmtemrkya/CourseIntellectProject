using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Entities;

public sealed class AssistantConversation : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid UserId { get; set; }
    public string Title { get; set; } = "Yeni sohbet";
    public Guid? SelectedStudentId { get; set; }
    public AssistantIntent? LastIntent { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LastMessageAtUtc { get; set; }
    public bool IsArchived { get; set; }
}

public sealed class AssistantMessage : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid ConversationId { get; set; }
    public Guid UserId { get; set; }
    public AssistantSenderType SenderType { get; set; }
    public AssistantMessageType MessageType { get; set; }
    public string Text { get; set; } = string.Empty;
    public AssistantIntent Intent { get; set; }
    public string StructuredPayloadJson { get; set; } = "{}";
    public Guid? ClientMessageId { get; set; }
    public long? ProcessingDurationMs { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class AssistantAuditLog : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid UserId { get; set; }
    public Guid ConversationId { get; set; }
    public AssistantIntent Intent { get; set; }
    public string ToolName { get; set; } = string.Empty;
    public Guid? TargetStudentId { get; set; }
    public bool WasAuthorized { get; set; }
    public string FailureReasonCode { get; set; } = string.Empty;
    public string CorrelationId { get; set; } = string.Empty;
    public string IpAddressMasked { get; set; } = string.Empty;
    public string UserAgent { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
