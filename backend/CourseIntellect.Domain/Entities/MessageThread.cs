namespace CourseIntellect.Domain.Entities;

public sealed class MessageThread
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ParticipantOneName { get; set; } = string.Empty;
    public string ParticipantOneRole { get; set; } = string.Empty;
    public string ParticipantTwoName { get; set; } = string.Empty;
    public string ParticipantTwoRole { get; set; } = string.Empty;
    public string LastMessagePreview { get; set; } = string.Empty;
    public DateTime LastMessageAtUtc { get; set; } = DateTime.UtcNow;
}
