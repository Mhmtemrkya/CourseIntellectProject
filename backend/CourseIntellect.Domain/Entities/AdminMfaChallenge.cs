namespace CourseIntellect.Domain.Entities;

// Password verification grants only this short-lived email challenge, never a JWT.
public sealed class AdminMfaChallenge
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public string AccessEmail { get; set; } = string.Empty;
    public long SecurityVersion { get; set; }
    public string CodeHash { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? DeliveredAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public int Attempts { get; set; }
    public DateTime? ConsumedAtUtc { get; set; }
    public long Version { get; set; }
}
