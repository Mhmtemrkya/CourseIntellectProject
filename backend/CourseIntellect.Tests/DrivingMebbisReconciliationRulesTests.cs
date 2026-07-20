using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

public sealed class DrivingMebbisReconciliationRulesTests
{
    [Theory]
    [InlineData("Çağrı ŞEN", "cagri sen")]
    [InlineData("B Sınıfı", "b-sinifi")]
    public void SameText_IgnoresTurkishCaseDiacriticsAndPunctuation(string left, string right)
        => Assert.True(DrivingMebbisReconciliationRules.SameText(left, right));

    [Fact]
    public void SamePhone_UsesDigitsOnly()
        => Assert.True(DrivingMebbisReconciliationRules.SamePhone("+90 (532) 123 45 67", "05321234567"));

    [Theory]
    [InlineData(DrivingExamCandidateStatus.Passed, "Geçti")]
    [InlineData(DrivingExamCandidateStatus.Failed, "Başarısız")]
    public void SameExamResult_MapsMebbisLabels(DrivingExamCandidateStatus status, string value)
        => Assert.True(DrivingMebbisReconciliationRules.SameExamResult(status, value));

    [Theory]
    [InlineData(DrivingStudentStatus.ExamPending, "Sınav bekliyor")]
    [InlineData(DrivingStudentStatus.Graduated, "Mezun")]
    public void SameStudentStatus_MapsMebbisLabels(DrivingStudentStatus status, string value)
        => Assert.True(DrivingMebbisReconciliationRules.SameStudentStatus(status, value));
}
