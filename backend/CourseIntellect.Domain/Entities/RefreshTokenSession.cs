namespace CourseIntellect.Domain.Entities;

public sealed class RefreshTokenSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public DateTime? AdminLastActivityAtUtc { get; set; }
    public string? AdminVerificationMethod { get; set; }
    public DateTime? AdminMfaVerifiedAtUtc { get; set; }
    public long SecurityVersion { get; set; } = 1;
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedAtUtc { get; set; }
    public bool IsActive => RevokedAtUtc is null && ExpiresAtUtc > DateTime.UtcNow;
}
