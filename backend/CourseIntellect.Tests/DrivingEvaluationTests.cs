using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

public sealed class DrivingEvaluationTests
{
    [Fact]
    public void ManualEvaluation_RequiresAll24Criteria()
    {
        var scores = DrivingEvaluation.Criteria.ToDictionary(x => x.Key, _ => 4);

        Assert.Equal(24, scores.Count);
        Assert.Null(DrivingEvaluation.Validate(scores, TransmissionType.Manual));

        scores.Remove("clutchControl");
        Assert.NotNull(DrivingEvaluation.Validate(scores, TransmissionType.Manual));
    }

    [Fact]
    public void AutomaticEvaluation_HidesBothClutchCriteria()
    {
        var visible = DrivingEvaluation.For(TransmissionType.Automatic);
        var scores = visible.ToDictionary(x => x.Key, _ => 3);

        Assert.Equal(22, visible.Count);
        Assert.DoesNotContain(visible, x => x.ManualOnly);
        Assert.Null(DrivingEvaluation.Validate(scores, TransmissionType.Automatic));
    }

    [Fact]
    public void CategoryScore_IsDerivedFromDetailedCriteria()
    {
        var scores = DrivingEvaluation.Criteria.ToDictionary(x => x.Key, _ => 3);
        scores["trafficObservation"] = 5;
        scores["signsAndSignals"] = 5;
        scores["laneDiscipline"] = 5;

        Assert.Equal(4, DrivingEvaluation.CategoryScore(scores, "trafficRules", TransmissionType.Manual));
    }

    [Fact]
    public void Evaluation_RejectsScoresOutsideOneToFive()
    {
        var scores = DrivingEvaluation.Criteria.ToDictionary(x => x.Key, _ => 3);
        scores["parking"] = 6;

        Assert.Contains("1-5", DrivingEvaluation.Validate(scores, TransmissionType.Manual));
    }
}
