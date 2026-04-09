namespace CourseIntellect.Domain.Entities;

public sealed class SupportTicket
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string TicketNumber { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string TenantName { get; set; } = string.Empty;
    public string RequestedBy { get; set; } = string.Empty;
    public string RequestedRole { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string LastMessage { get; set; } = string.Empty;
    public int MessageCount { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
