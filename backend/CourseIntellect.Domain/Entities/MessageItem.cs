namespace CourseIntellect.Domain.Entities;

public sealed class MessageItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ThreadId { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string SenderRole { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTime SentAtUtc { get; set; } = DateTime.UtcNow;
}
