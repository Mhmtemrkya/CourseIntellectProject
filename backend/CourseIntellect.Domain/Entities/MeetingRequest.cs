namespace CourseIntellect.Domain.Entities;

public sealed class MeetingRequest : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string ParentName { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    public string Advisor { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
    public string Slot { get; set; } = string.Empty;
    public bool OnlineMeeting { get; set; }
    public string Note { get; set; } = string.Empty;
    public string Status { get; set; } = "Bekliyor";
}
