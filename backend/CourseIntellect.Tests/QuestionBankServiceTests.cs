using CourseIntellect.Application.DTOs.QuestionBank;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

public sealed class QuestionBankServiceTests : IDisposable
{
    private readonly TestDb db = new();
    private QuestionBankService Service => new(db.Context);

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

    public void Dispose() => db.Dispose();
}
