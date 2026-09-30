using System.Reflection;
using CourseIntellect.Application.DTOs.ExamSolving;
using CourseIntellect.Application.DTOs.QuestionBank;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

public sealed class ExamSessionXpTests : IDisposable
{
    private readonly TestDb db = new();

    private ExamSolvingService Solving => new(
        db.Context,
        NullService<IFileStorageService>.Create(),
        NullService<IExamSolvingRealtimeNotifier>.Create(),
        NullService<INotificationService>.Create(),
        new StudyPlanService(db.Context));

    private QuestionBankService Bank => new(db.Context, new StudyPlanService(db.Context));

    private static CreateQuestionBankItemRequest Question(string text) => new(
        Subject: "Matematik", Topic: "Türev", Difficulty: "Orta", Type: "Çoktan Seçmeli",
        QuestionText: text, Teacher: "Test Öğretmen", ImagePath: null, ImagePlacement: "Top",
        Options: ["1", "2", "x", "2x"], CorrectOptionIndex: 1, ClassTargets: ["Tüm Sınıflar"],
        SolutionAssetPath: null, SolutionAssetType: null, RevealCorrectAnswerToStudent: true,
        ExpectedAnswer: null, PublicationStatus: null);

    private async Task<SolutionSummaryResponse> SolveAsync(IReadOnlyList<Guid> ids, bool awardXp, bool preview = false)
    {
        var session = await Solving.StartAsync(
            new StartSolutionSessionRequest("Test", "Matematik", "ali", "Ali Kaya", null, 600, preview, null, ids),
            CancellationToken.None);
        var picks = new[] { 1, 0 }; // ilk soru doğru, ikinci yanlış
        foreach (var (question, index) in session.Questions.Select((q, i) => (q, i)))
        {
            await Solving.SaveAnswerAsync(session.Id, new SaveSolutionAnswerRequest(question.AttemptId, picks[index % 2], null, 5), CancellationToken.None);
        }
        return await Solving.CompleteAsync(session.Id, "http://localhost", awardXp, CancellationToken.None);
    }

    [Fact]
    public async Task CompletingSession_AwardsXpOncePerQuestion_AndNeverTwice()
    {
        var q1 = await Bank.CreateQuestionAsync(Question("Soru 1"));
        var q2 = await Bank.CreateQuestionAsync(Question("Soru 2"));
        var plans = new StudyPlanService(db.Context);

        // Doğru 18 + yanlış 6.
        var first = await SolveAsync([q1.Id, q2.Id], awardXp: true);
        Assert.Equal(24, first.XpAwarded);
        Assert.Equal(24, (await plans.GetOrCreateAsync("Ali Kaya")).XpPoints);

        // Aynı oturumu yeniden tamamlamak XP vermez.
        var again = await Solving.CompleteAsync(first.SessionId, "http://localhost", true, CancellationToken.None);
        Assert.Equal(0, again.XpAwarded);

        // Aynı soruları yeni oturumda ya da pratikte tekrar çözmek XP vermez.
        Assert.Equal(0, (await SolveAsync([q1.Id, q2.Id], awardXp: true)).XpAwarded);
        var practice = await Bank.SubmitAttemptAsync(q1.Id, new SubmitQuestionPracticeAttemptRequest("Ali Kaya", "ali", "2"), awardXp: true);
        Assert.Equal(0, practice!.XpAwarded);
        Assert.Equal(24, (await plans.GetOrCreateAsync("Ali Kaya")).XpPoints);
    }

    [Fact]
    public async Task StaffCompletionAndTeacherPreview_AwardNoXp()
    {
        var q1 = await Bank.CreateQuestionAsync(Question("Soru 1"));
        Assert.Equal(0, (await SolveAsync([q1.Id], awardXp: false)).XpAwarded);
        var q2 = await Bank.CreateQuestionAsync(Question("Soru 2"));
        Assert.Equal(0, (await SolveAsync([q2.Id], awardXp: true, preview: true)).XpAwarded);
        Assert.Equal(0, (await new StudyPlanService(db.Context).GetOrCreateAsync("Ali Kaya")).XpPoints);
    }

    public void Dispose() => db.Dispose();
}

// Test için etkisiz arayüz uygulaması: her çağrı tamamlanmış görev / varsayılan döner.
public class NullService<T> : DispatchProxy where T : class
{
    public static T Create() => DispatchProxy.Create<T, NullService<T>>();

    protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
    {
        var returnType = targetMethod?.ReturnType;
        if (returnType is null || returnType == typeof(void)) return null;
        if (returnType == typeof(Task)) return Task.CompletedTask;
        if (returnType.IsGenericType && returnType.GetGenericTypeDefinition() == typeof(Task<>))
        {
            var resultType = returnType.GetGenericArguments()[0];
            var fromResult = typeof(Task).GetMethod(nameof(Task.FromResult))!.MakeGenericMethod(resultType);
            return fromResult.Invoke(null, [resultType.IsValueType ? Activator.CreateInstance(resultType) : null]);
        }
        return returnType.IsValueType ? Activator.CreateInstance(returnType) : null;
    }
}
