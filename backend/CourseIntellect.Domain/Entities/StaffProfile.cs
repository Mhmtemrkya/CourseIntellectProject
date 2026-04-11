using CourseIntellect.Domain.Enums;
using System.ComponentModel.DataAnnotations.Schema;

namespace CourseIntellect.Domain.Entities;

public sealed class StaffProfile : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string TcNo { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Education { get; set; } = string.Empty;
    public string StartDate { get; set; } = string.Empty;
    public string Campus { get; set; } = string.Empty;
    public string DepartmentOrBranch { get; set; } = string.Empty;
    public string HomeroomClass { get; set; } = string.Empty;
    public string MaritalStatus { get; set; } = string.Empty;
    public int ChildCount { get; set; }
    public string Note { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public string AssignedClassesSerialized { get; set; } = string.Empty;

    [NotMapped]
    public List<string> AssignedClasses
    {
        get => string.IsNullOrWhiteSpace(AssignedClassesSerialized)
            ? []
            : AssignedClassesSerialized
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList();
        set => AssignedClassesSerialized = string.Join(',', value);
    }
}
