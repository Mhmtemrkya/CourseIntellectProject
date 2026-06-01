using System.Text.Json;

namespace CourseIntellect.Application.DTOs.StudyPlans;

public sealed record UpdateStudyPlanStateRequest(
    string StudentName,
    string PlanItemsSerialized,
    int StreakCount,
    int XpPoints,
    DateTime? LastCompletedAt);

public sealed record AddStudyPlanXpRequest(int Amount);

public sealed record StudyPlanItemRequest(JsonElement Item);

public sealed record SetStudyPlanItemDoneRequest(bool Done);
