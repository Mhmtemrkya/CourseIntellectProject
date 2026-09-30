using CourseIntellect.Application.DTOs.QuestionBank;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

public sealed class QuestionBankServiceTests : IDisposable
{
    private readonly TestDb db = new();
    private QuestionBankService Service => new(db.Context, new StudyPlanService(db.Context));

    private static CreateQuestionBankItemRequest Request(string? status = null) => new(
        Subject: "Matematik",
        Topic: "Türev",
        Difficulty: "Orta",
        Type: "Çoktan Seçmeli",
        QuestionText: "2x'in türevi nedir?",
        Teacher: "Test Öğretmen",
        ImagePath: null,
        ImagePlacement: "Top",
        Options: ["1", "2", "x", "2x"],
        CorrectOptionIndex: 1,
        ClassTargets: ["Tüm Sınıflar"],
        SolutionAssetPath: null,
        SolutionAssetType: null,
        RevealCorrectAnswerToStudent: true,
        ExpectedAnswer: null,
        PublicationStatus: status);

    [Fact]
    public async Task PassiveQuestions_AreHiddenFromStudents_ButVisibleToTeachers()
    {
        var created = await Service.CreateQuestionAsync(Request("Passive"));

        // Öğrenci listesi (includeDrafts=false) pasif soruyu görmemeli.
        var studentList = await Service.GetQuestionsAsync(null, includeDrafts: false);
        Assert.DoesNotContain(studentList, item => item.Id == created.Id);

        // Öğretmen listesi (includeDrafts=true) pasif soruyu görmeli — sınav
        // oluştururken kaynak olarak kullanılabilmesi gerekir.
        var teacherList = await Service.GetQuestionsAsync(null, includeDrafts: true);
        Assert.Contains(teacherList, item => item.Id == created.Id && item.PublicationStatus == "Passive");
    }

    [Fact]
    public async Task PublishedQuestions_AreVisibleToStudents()
    {
        var created = await Service.CreateQuestionAsync(Request());
        var studentList = await Service.GetQuestionsAsync(null, includeDrafts: false);
        Assert.Contains(studentList, item => item.Id == created.Id && item.PublicationStatus == "Published");
    }

    [Fact]
    public async Task UnknownPublicationStatus_FallsBackToPublished()
    {
        var created = await Service.CreateQuestionAsync(Request("garbage-status"));
        Assert.Equal("Published", created.PublicationStatus);
    }

    [Fact]
    public async Task DeleteQuestion_HidesItFromTeacherListToo()
    {
        var created = await Service.CreateQuestionAsync(Request());
        await Service.DeleteQuestionAsync(created.Id);
        var teacherList = await Service.GetQuestionsAsync(null, includeDrafts: true);
        Assert.DoesNotContain(teacherList, item => item.Id == created.Id);
    }

    [Fact]
    public async Task StudentXp_IsAwardedOnlyOnFirstAttempt_AndNeverForStaff()
    {
        var created = await Service.CreateQuestionAsync(Request());
        var plans = new StudyPlanService(db.Context);

        // İlk doğru deneme: 18 XP (resim/çözüm eki yok).
        var first = await Service.SubmitAttemptAsync(created.Id, new SubmitQuestionPracticeAttemptRequest("Ali Kaya", "ali", "2"), awardXp: true);
        Assert.NotNull(first);
        Assert.True(first!.IsCorrect);
        Assert.Equal(18, first.XpAwarded);

        // Aynı soruya tekrar deneme XP getirmez (tekrar tekrar deneyerek XP toplanamaz).
        var second = await Service.SubmitAttemptAsync(created.Id, new SubmitQuestionPracticeAttemptRequest("Ali Kaya", "ali", "2"), awardXp: true);
        Assert.Equal(0, second!.XpAwarded);
        Assert.Equal(18, (await plans.GetOrCreateAsync("Ali Kaya")).XpPoints);

        // Personel denemesi (awardXp=false) hiçbir öğrenciye XP yazmaz.
        var staff = await Service.SubmitAttemptAsync(created.Id, new SubmitQuestionPracticeAttemptRequest("Ayşe Demir", "ayse", "2"), awardXp: false);
        Assert.Equal(0, staff!.XpAwarded);
        Assert.Equal(0, (await plans.GetOrCreateAsync("Ayşe Demir")).XpPoints);
    }

    [Fact]
    public async Task StudyPlan_ClientCannotSetXp_AndChecklistDoesNotAwardXp()
    {
        var plans = new StudyPlanService(db.Context);
        await plans.AddXpAsync("Can Öz", 30);

        // PUT gövdesindeki XP/seri yok sayılır.
        var updated = await plans.UpdateAsync(new CourseIntellect.Application.DTOs.StudyPlans.UpdateStudyPlanStateRequest("Can Öz", "[]", 99, 99999, null));
        Assert.Equal(30, updated.XpPoints);
        Assert.Equal(0, updated.StreakCount);

        // Kendi eklediği maddeyi işaretlemek XP vermez.
        var withItem = await plans.AddItemAsync("Can Öz", new CourseIntellect.Application.DTOs.StudyPlans.StudyPlanItemRequest(System.Text.Json.JsonDocument.Parse("{\"id\":\"m1\",\"title\":\"Madde\"}").RootElement));
        var done = await plans.SetItemDoneAsync("Can Öz", "m1", true);
        Assert.Equal(30, done.XpPoints);
        Assert.Equal(1, done.StreakCount);
        _ = withItem;
    }

    public void Dispose() => db.Dispose();
}
