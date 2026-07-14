using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

public sealed class DrivingExamRulesTests
{
    [Fact]
    public void PassedTheoryExam_MovesStudentToPractice()
        => Assert.Equal(
            DrivingStudentStatus.PracticeOngoing,
            DrivingExamRules.StudentStatusAfterResult(DrivingExamType.TheoryEExam, true));

    [Fact]
    public void PassedDrivingExam_MovesStudentToGraduationCheck()
        => Assert.Equal(
            DrivingStudentStatus.GraduationPending,
            DrivingExamRules.StudentStatusAfterResult(DrivingExamType.DrivingPractice, true));

    [Theory]
    [InlineData(DrivingExamType.TheoryEExam)]
    [InlineData(DrivingExamType.DrivingPractice)]
    public void FailedExam_KeepsStudentWaitingForExam(DrivingExamType type)
        => Assert.Equal(
            DrivingStudentStatus.ExamPending,
            DrivingExamRules.StudentStatusAfterResult(type, false));

    [Theory]
    [InlineData(DrivingExamCandidateStatus.Failed, true)]
    [InlineData(DrivingExamCandidateStatus.Planned, false)]
    [InlineData(DrivingExamCandidateStatus.Passed, false)]
    [InlineData(DrivingExamCandidateStatus.Cancelled, false)]
    public void Retry_IsOnlyAvailableAfterFailure(DrivingExamCandidateStatus status, bool expected)
        => Assert.Equal(expected, DrivingExamRules.CanScheduleRetry(status));
}
