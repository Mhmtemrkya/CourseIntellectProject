namespace CourseIntellect.Domain.Entities;

public sealed class StudyPlanState : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string PlanItemsSerialized { get; set; } = "[]";
    public int StreakCount { get; set; }
    public int XpPoints { get; set; }
    public DateTime? LastCompletedAt { get; set; }
}
