namespace CourseIntellect.Domain.Services;

public sealed record DrivingGraduationFacts(
    bool DocumentsComplete,
    int CompletedTheoryMinutes,
    int RequiredTheoryMinutes,
    int CompletedPracticeMinutes,
    int RequiredPracticeMinutes,
    bool TheoryExamPassed,
    bool DrivingExamPassed,
    decimal OutstandingDebt,
    int OpenAppointments,
    int PendingAppointmentRequests);

public static class DrivingGraduationRules
{
    public static bool CanGraduate(DrivingGraduationFacts facts) =>
        facts.DocumentsComplete
        && facts.CompletedTheoryMinutes >= facts.RequiredTheoryMinutes
        && facts.CompletedPracticeMinutes >= facts.RequiredPracticeMinutes
        && facts.TheoryExamPassed
        && facts.DrivingExamPassed
        && facts.OutstandingDebt <= 0
        && facts.OpenAppointments == 0
        && facts.PendingAppointmentRequests == 0;
}
