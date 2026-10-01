namespace CourseIntellect.Domain.Entities;

// Platform-level outbox. Never expose this table through tenant APIs or audit payloads.
public sealed class OnboardingEmail
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string EventKey { get; set; } = string.Empty;
    public string Kind { get; set; } = string.Empty;
    public Guid RelatedId { get; set; }
    public string? Version { get; set; }
    public string ProtectedPayload { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime NextAttemptAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LeaseUntilUtc { get; set; }
    public Guid? LeaseId { get; set; }
    public int Attempts { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public bool Delivered { get; set; }
}
