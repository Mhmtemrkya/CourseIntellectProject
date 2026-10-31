namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Zümre: aynı dersi okutan öğretmenlerin kurulu (MEB ders zümresi). Bir şubede
/// aynı ders için aynı öğretim yılında tek zümre olur. Zümre başkanı her zaman
/// zümrenin üyesidir.
/// </summary>
public sealed class SubjectGroup : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    /// <summary>Ders adı (ör. "Matematik").</summary>
    public string Subject { get; set; } = string.Empty;
    /// <summary>Görünen ad; boşsa "{Ders} Zümresi".</summary>
    public string Name { get; set; } = string.Empty;
    /// <summary>"2026-2027" biçiminde öğretim yılı.</summary>
    public string AcademicYear { get; set; } = string.Empty;
    public Guid? HeadTeacherUserId { get; set; }
    public string HeadTeacherName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    /// <summary>Kartlarda kullanılan vurgu rengi (#RRGGBB).</summary>
    public string Color { get; set; } = "#2563EB";
    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; set; }
}

public sealed class SubjectGroupMember : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }
    public Guid SubjectGroupId { get; set; }
    public Guid TeacherUserId { get; set; }
    public string TeacherName { get; set; } = string.Empty;
    public DateTime JoinedAtUtc { get; set; } = DateTime.UtcNow;
}
