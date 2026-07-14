using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

public sealed class DrivingGraduationRulesTests
{
    private static DrivingGraduationFacts Complete() => new(true, 720, 720, 840, 840, true, true, 0, 0, 0);

    [Fact]
    public void CompleteFile_IsEligibleForGraduation()
        => Assert.True(DrivingGraduationRules.CanGraduate(Complete()));

    [Theory]
    [InlineData("documents")]
    [InlineData("theory")]
    [InlineData("practice")]
    [InlineData("theoryExam")]
    [InlineData("drivingExam")]
    [InlineData("debt")]
    [InlineData("appointment")]
    [InlineData("request")]
    public void AnyOpenRequirement_BlocksGraduation(string missing)
    {
        var x = Complete();
        x = missing switch
        {
            "documents" => x with { DocumentsComplete = false },
            "theory" => x with { CompletedTheoryMinutes = 719 },
            "practice" => x with { CompletedPracticeMinutes = 839 },
            "theoryExam" => x with { TheoryExamPassed = false },
            "drivingExam" => x with { DrivingExamPassed = false },
            "debt" => x with { OutstandingDebt = 1 },
            "appointment" => x with { OpenAppointments = 1 },
            _ => x with { PendingAppointmentRequests = 1 },
        };
        Assert.False(DrivingGraduationRules.CanGraduate(x));
    }
}
