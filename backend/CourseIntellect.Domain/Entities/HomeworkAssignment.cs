namespace CourseIntellect.Domain.Entities;

public sealed class HomeworkAssignment : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Teacher { get; set; } = string.Empty;
    public string DeadlineLabel { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string MaterialsSerialized { get; set; } = "[]";
    public int TotalStudents { get; set; } = 25;
    public string CreatedAtLabel { get; set; } = string.Empty;
}
