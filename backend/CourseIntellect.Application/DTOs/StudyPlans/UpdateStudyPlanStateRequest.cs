namespace CourseIntellect.Application.DTOs.StudyPlans;

public sealed record UpdateStudyPlanStateRequest(
    string StudentName,
    string PlanItemsSerialized,
    int StreakCount,
    int XpPoints,
    DateTime? LastCompletedAt);
