namespace CourseIntellect.Domain.Entities;

public sealed class RolePolicy
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string RoleName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public bool LoginEnabled { get; set; } = true;
    public bool RequiresCriticalApproval { get; set; }
    public string MessagingScope { get; set; } = string.Empty;
    public string ModuleAccessSerialized { get; set; } = "[]";
}
