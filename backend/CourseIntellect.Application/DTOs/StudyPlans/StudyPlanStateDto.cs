namespace CourseIntellect.Application.DTOs.StudyPlans;

public sealed record StudyPlanStateDto(
    Guid Id,
    string StudentName,
    string PlanItemsSerialized,
    int StreakCount,
    int XpPoints,
    DateTime? LastCompletedAt);
