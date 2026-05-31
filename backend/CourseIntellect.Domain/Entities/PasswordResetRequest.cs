namespace CourseIntellect.Domain.Entities;

public sealed class PasswordResetRequest : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid UserId { get; set; }
    public string RequestedEmail { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string PrimaryRole { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public string ReviewNote { get; set; } = string.Empty;
    public Guid? ReviewedByUserId { get; set; }
    public string ReviewedByName { get; set; } = string.Empty;
    public DateTime RequestedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ReviewedAtUtc { get; set; }
    public DateTime? TemporaryPasswordCreatedAtUtc { get; set; }
    public DateTime? ExpiresAtUtc { get; set; }
    public DateTime? UsedAtUtc { get; set; }
}
