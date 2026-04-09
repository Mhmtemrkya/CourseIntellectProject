namespace CourseIntellect.Domain.Entities;

public sealed class PlatformConfiguration
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ConfigurationType { get; set; } = string.Empty;
    public string ScopeKey { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
