using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

/// <summary>Başarı raporu: "Özet ve sonraki adımlar" bölümü ve uç verilerle çizim.</summary>
public sealed class StudentSuccessReportPdfTests
{
    private static StudentSuccessReport Report(IReadOnlyList<SuccessTopicRow> weak, IReadOnlyList<SuccessTrendPoint>? trend = null, int exams = 3) => new(
        "Test Okulu", "Ali Yılmaz", "10-A", "123", "R-1", new DateTime(2026, 11, 5, 9, 0, 0, DateTimeKind.Utc),
        exams > 0 ? 62 : null, exams > 0 ? 70 : null, 96, 2, 50, 80, 1, exams, exams > 0 ? 5 : null, 20, 55, 120,
        [], weak, [], [], [], trend ?? [], []);

    [Fact]
    public void NextSteps_FollowPriority_WithQuestionTargets()
    {
        var steps = StudentSuccessReportPdf.NextSteps(Report(
        [
            new("Fen Bilimleri", "Basınç", 35, 56, "declining", "down", 14, Priority: 2, SuggestedQuestions: 20),
            new("Matematik", "Olasılık", 20, 60, "misconception", "flat", 10, Priority: 1, SuggestedQuestions: 15),
            new("Türkçe", "Fiiller", 40, 60, "misconception", "flat", 8),
        ]));
        Assert.Equal(2, steps.Count);
        Assert.StartsWith("1. Olasılık (Matematik) — bu hafta 15 soru", steps[0]);
        Assert.StartsWith("2. Basınç", steps[1]);
    }

    [Fact]
    public void Render_HandlesEmptyDataAndVeryLongTopicNames()
    {
        Assert.NotEmpty(StudentSuccessReportPdf.Render(Report([], exams: 0)));

        var longName = string.Join(' ', Enumerable.Repeat("Çok uzun bir konu başlığı", 12));
        var weak = Enumerable.Range(1, 8).Select(i => new SuccessTopicRow("Matematik", $"{longName} {i}", 20 + i, 55, i % 2 == 0 ? "stale" : "improving", "up", 12, i, 40)).ToList();
        var pdf = StudentSuccessReportPdf.Render(Report(weak, [new("1", 40), new("2", 70)]));
        Assert.True(pdf.Length > 1000);
    }
}
