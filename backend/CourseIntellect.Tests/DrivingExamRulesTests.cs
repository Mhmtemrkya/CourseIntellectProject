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

    // ─── 4 sınav hakkı (mevzuat) ─────────────────────────────────────────────

    [Fact]
    public void ExamRights_MaxAttemptsIsFour()
        => Assert.Equal(4, DrivingExamRules.MaxAttempts);

    [Theory]
    [InlineData(0, 4, false)]
    [InlineData(1, 3, false)]
    [InlineData(3, 1, false)]
    [InlineData(4, 0, true)]
    [InlineData(7, 0, true)] // veri bozulsa bile hak eksiye düşmez
    public void ExamRights_RemainingAndExhaustion(int used, int expectedRemaining, bool expectedOut)
    {
        Assert.Equal(expectedRemaining, DrivingExamRules.RemainingAttempts(used));
        Assert.Equal(expectedOut, DrivingExamRules.IsOutOfAttempts(used));
    }

    [Theory]
    [InlineData(DrivingExamCandidateStatus.Planned, true)]
    [InlineData(DrivingExamCandidateStatus.Passed, true)]
    [InlineData(DrivingExamCandidateStatus.Failed, true)]
    [InlineData(DrivingExamCandidateStatus.Cancelled, false)] // iptal hak yakmaz
    public void ExamRights_CancelledAttemptDoesNotConsume(DrivingExamCandidateStatus status, bool consumes)
        => Assert.Equal(consumes, DrivingExamRules.ConsumesAttempt(status));

    [Fact]
    public void ExamRights_OutOfAttemptsMessage_TellsStaffToReRegister()
    {
        var message = DrivingExamRules.OutOfAttemptsMessage(DrivingExamType.DrivingPractice);
        Assert.Contains("4 sınav hakkı doldu", message);
        Assert.Contains("yeniden kayıt", message);
    }

    // ─── Toplu sonuç içe aktarma ─────────────────────────────────────────────

    [Theory]
    [InlineData("Geçti", true)]
    [InlineData("GEÇTİ", true)]
    [InlineData("basarili", true)]
    [InlineData("passed", true)]
    [InlineData("Kaldı", false)]
    [InlineData("BAŞARISIZ", false)]
    [InlineData("failed", false)]
    public void Import_ExplicitResultText_Wins(string text, bool expected)
        => Assert.Equal(expected, DrivingExamRules.ParseImportedResult(text, null, DrivingExamType.DrivingPractice));

    [Fact]
    public void Import_TheoryScore_UsesSeventyThreshold()
    {
        Assert.Equal(true, DrivingExamRules.ParseImportedResult(null, 70, DrivingExamType.TheoryEExam));
        Assert.Equal(true, DrivingExamRules.ParseImportedResult("", 85, DrivingExamType.TheoryEExam));
        Assert.Equal(false, DrivingExamRules.ParseImportedResult(null, 69, DrivingExamType.TheoryEExam));
    }

    [Fact]
    public void Import_ExplicitText_OverridesScore()
        // Liste "kaldı" diyorsa puan 90 bile olsa metin kazanır — resmî liste esastır.
        => Assert.Equal(false, DrivingExamRules.ParseImportedResult("kaldı", 90, DrivingExamType.TheoryEExam));

    [Fact]
    public void Import_PracticeWithoutText_CannotBeInferred()
        // Direksiyon sınavında puan barajı yok; açık sonuç metni şart.
        => Assert.Null(DrivingExamRules.ParseImportedResult(null, 80, DrivingExamType.DrivingPractice));

    [Fact]
    public void Import_Garbage_ReturnsNull()
        => Assert.Null(DrivingExamRules.ParseImportedResult("belirsiz", null, DrivingExamType.TheoryEExam));
}
