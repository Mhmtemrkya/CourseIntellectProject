namespace CourseIntellect.Domain.Entities;

public sealed class AnnouncementItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public string DateLabel { get; set; } = string.Empty;
}
