using CourseIntellect.Domain.Enums;
using System.Text.Json;
using System.ComponentModel.DataAnnotations.Schema;

namespace CourseIntellect.Domain.Entities;

public sealed class AppUser : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole PrimaryRole { get; set; }
    public UserStatus Status { get; set; } = UserStatus.Active;
    public string Campus { get; set; } = string.Empty;
    public string DepartmentOrBranch { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public bool IsEmailVerified { get; set; }
    public bool MustChangePassword { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAtUtc { get; set; }
    public string ExtraRolesSerialized { get; set; } = string.Empty;
    public string RoleHistorySerialized { get; set; } = "[]";

    [NotMapped]
    public List<UserRole> ExtraRoles
    {
        get => string.IsNullOrWhiteSpace(ExtraRolesSerialized)
            ? []
            : ExtraRolesSerialized
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(value => Enum.Parse<UserRole>(value))
                .ToList();
        set => ExtraRolesSerialized = string.Join(',', value.Select(x => x.ToString()));
    }

    [NotMapped]
    public List<string> RoleHistory
    {
        get => string.IsNullOrWhiteSpace(RoleHistorySerialized)
            ? []
            : JsonSerializer.Deserialize<List<string>>(RoleHistorySerialized) ?? [];
        set => RoleHistorySerialized = JsonSerializer.Serialize(value);
    }
}
