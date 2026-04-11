namespace CourseIntellect.Domain.Entities;

public sealed class StudentProfile : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string TcNo { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string CurrentSchool { get; set; } = string.Empty;
    public string SchoolNumber { get; set; } = string.Empty;
    public string BirthDate { get; set; } = string.Empty;
    public string ProgramType { get; set; } = string.Empty;
    public string ParentName { get; set; } = string.Empty;
    public string ParentPhone { get; set; } = string.Empty;
    public string ParentEmail { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
}
