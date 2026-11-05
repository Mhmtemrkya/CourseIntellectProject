using System.Security.Claims;
using CourseIntellect.Application.DTOs.Insights;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace CourseIntellect.Tests;

public sealed class StudentInsightServiceTests : IDisposable
{
    private readonly SqliteConnection connection = new("DataSource=:memory:");
    private readonly CourseIntellectDbContext db;
    private static readonly Guid Tenant = Guid.NewGuid();
    private DateTime clock = new(2026, 9, 1, 8, 0, 0, DateTimeKind.Utc);

    public StudentInsightServiceTests()
    {
        connection.Open();
        db = NewContext(null);
        db.Database.EnsureCreated();
        db.TenantWorkspaces.Add(new TenantWorkspace { Id = Tenant, Name = "Test Okulu", Slug = $"t-{Guid.NewGuid():N}"[..20], ContactEmail = "a@b.co", Plan = "free", Status = "active" });
        db.SaveChanges();
        db.SetTenantOverride(Tenant);
    }

    public void Dispose()
    {
        db.Dispose();
        connection.Dispose();
    }

    private CourseIntellectDbContext NewContext(ClaimsPrincipal? user)
    {
        var options = new DbContextOptionsBuilder<CourseIntellectDbContext>().UseSqlite(connection).Options;
        var accessor = user is null ? null : new HttpContextAccessor { HttpContext = new DefaultHttpContext { User = user } };
        return new CourseIntellectDbContext(options, accessor);
    }

    private sealed class FakeGenerator(bool enabled, string? output) : IInsightTextGenerator
    {
        public bool IsEnabled => enabled;
        public string Model => "fake:3b";
        public string? LastUserMessage { get; private set; }
        public Task<string?> GenerateJsonAsync(string systemPrompt, IReadOnlyList<(string Role, string Content)> messages, object jsonSchema, CancellationToken cancellationToken)
        {
            LastUserMessage = messages.Last().Content;
            return Task.FromResult(output);
        }
    }

    private StudentInsightService Service(CourseIntellectDbContext context, IInsightTextGenerator? generator = null) =>
        new(context, generator ?? new FakeGenerator(false, null), new NoOpBackgroundJobClient(NullLogger<NoOpBackgroundJobClient>.Instance), NullLogger<StudentInsightService>.Instance);

    private async Task<AppUser> StudentAsync(string name, string className, Guid? branchId = null)
    {
        var user = new AppUser { FullName = name, Username = $"s-{Guid.NewGuid():N}"[..18], PasswordHash = "x", PrimaryRole = UserRole.Student, BranchId = branchId };
        db.Users.Add(user);
        db.Students.Add(new StudentProfile { UserId = user.Id, FullName = user.FullName, ClassName = className, BranchId = branchId });
        await db.SaveChangesAsync();
        return user;
    }

    private async Task<QuestionBankItem> QuestionAsync(string subject, string topic)
    {
        var item = new QuestionBankItem { Subject = subject, Topic = topic, QuestionText = "?", Type = "Test", Difficulty = "Orta", Teacher = "T" };
        db.QuestionBankItems.Add(item);
        await db.SaveChangesAsync();
        return item;
    }

    /// <summary>Tamamlanmış online sınav: her durum için bir soru denemesi (Correct/Answered/Empty).</summary>
    private async Task ExamAsync(AppUser student, QuestionBankItem question, IEnumerable<string> statuses, bool preview = false, bool completed = true, Guid? branchId = null)
    {
        clock = clock.AddDays(1);
        var session = new ExamSession
        {
            StudentUserId = student.Id,
            StudentUsername = student.Username,
            StudentName = student.FullName,
            Subject = question.Subject,
            IsTeacherPreview = preview,
            CompletedAtUtc = completed ? clock : null,
            Status = completed ? "Completed" : "Active",
            BranchId = branchId,
        };
        db.ExamSessions.Add(session);
        var order = 0;
        foreach (var status in statuses)
        {
            db.QuestionAttempts.Add(new QuestionAttempt { ExamSessionId = session.Id, QuestionBankItemId = question.Id, SortOrder = order++, Status = status });
        }
        await db.SaveChangesAsync();
    }

    private async Task PracticeAsync(AppUser student, QuestionBankItem question, params bool[] results)
    {
        foreach (var correct in results)
        {
            clock = clock.AddHours(1);
            db.QuestionPracticeAttempts.Add(new QuestionPracticeAttempt { QuestionId = question.Id, StudentUsername = student.Username, StudentName = student.FullName, IsCorrect = correct, SubmittedAtUtc = clock });
        }
        await db.SaveChangesAsync();
    }

    private static string[] Repeat(string status, int count) => Enumerable.Repeat(status, count).ToArray();

    // ── Hesap kuralları ────────────────────────────────────────────────────────

    [Fact]
    public async Task Topics_CombineExamAndPractice_ExcludePreviewAndUnfinished()
    {
        var ali = await StudentAsync("Ali Yılmaz", "9-A");
        var us = await QuestionAsync("Matematik", "Üslü Sayılar");
        await ExamAsync(ali, us, ["Correct", "Answered", "Empty", "Unanswered"]);
        await ExamAsync(ali, us, Repeat("Correct", 10), preview: true);
        await ExamAsync(ali, us, Repeat("Correct", 10), completed: false);
        await PracticeAsync(ali, us, true, false);

        var insight = await Service(db).GetStudentAsync(ali.Id);

        var topic = Assert.Single(insight!.Topics);
        Assert.Equal(6, topic.Solved);
        Assert.Equal(2, topic.Correct);
        Assert.Equal(2, topic.Wrong);
        Assert.Equal(2, topic.Blank);
        Assert.Equal(33.3m, topic.SuccessRate);
    }

    [Fact]
    public async Task InSystemExamBlanks_CountAsBlank_AndEnableSkippingDiagnosis()
    {
        var ali = await StudentAsync("Ali Yılmaz", "9-A");
        var cumle = await QuestionAsync("Türkçe", "Cümle Bilgisi");
        // Sistemde çözülen deneme: cevaplananlar practice tablosuna, boşlar ayrı tabloya yazılır.
        await PracticeAsync(ali, cumle, true, false);
        foreach (var _ in Enumerable.Range(0, 4))
        {
            db.ExamBlankAnswers.Add(new ExamBlankAnswer { QuestionId = cumle.Id, StudentUsername = ali.Username, ExamSessionId = Guid.NewGuid(), CompletedAtUtc = clock });
        }
        await db.SaveChangesAsync();

        var topic = Assert.Single((await Service(db).GetStudentAsync(ali.Id))!.Topics);

        Assert.Equal(6, topic.Solved);
        Assert.Equal(4, topic.Blank);
        Assert.Equal(16.7m, topic.SuccessRate);
        Assert.Equal("skipping", topic.Diagnosis);
    }

    [Fact]
    public async Task Weak_RequiresMinimumSample()
    {
        var ali = await StudentAsync("Ali Yılmaz", "9-A");
        var kok = await QuestionAsync("Matematik", "Köklü Sayılar");
        await PracticeAsync(ali, kok, false, false, false, false);

        var topic = Assert.Single((await Service(db).GetStudentAsync(ali.Id))!.Topics);

        Assert.False(topic.HasEnoughData);
        Assert.False(topic.IsWeak);
        Assert.Null(topic.Diagnosis);
    }

    [Fact]
    public async Task Weak_RelativeToRestOfClass_AndDiagnoses()
    {
        var ali = await StudentAsync("Ali Yılmaz", "9-A");
        var ayse = await StudentAsync("Ayşe Kaya", "9-A");
        var veli = await StudentAsync("Veli Can", "9-B");
        var olas = await QuestionAsync("Matematik", "Olasılık");
        var us = await QuestionAsync("Matematik", "Üslü Sayılar");
        var cumle = await QuestionAsync("Türkçe", "Cümle Bilgisi");

        // Olasılık: Ali %60 (mutlak eşiğin üstü) ama sınıf arkadaşı %100 → göreli zayıf, yanlışlar ağırlıkta.
        await PracticeAsync(ali, olas, true, true, true, false, false);
        await PracticeAsync(ayse, olas, true, true, true, true, true, true);
        // Başka sınıftaki öğrenci karşılaştırmaya girmez.
        await PracticeAsync(veli, olas, false, false, false, false, false, false);
        // Üslü: önce iyi sonra kötü → düşüş.
        await PracticeAsync(ali, us, true, true, true, true, true, false, false, false, false, false);
        // Cümle bilgisi: çoğu boş → boş bırakma eğilimi.
        await ExamAsync(ali, cumle, ["Correct", "Empty", "Empty", "Unanswered", "Answered"]);

        var insight = (await Service(db).GetStudentAsync(ali.Id))!;

        var olasilik = insight.Topics.Single(item => item.Topic == "Olasılık");
        Assert.Equal(100m, olasilik.ClassSuccessRate);
        Assert.True(olasilik.IsWeak);
        Assert.Equal("misconception", olasilik.Diagnosis);

        var uslu = insight.Topics.Single(item => item.Topic == "Üslü Sayılar");
        Assert.Equal("down", uslu.Trend);
        Assert.Equal("declining", uslu.Diagnosis);

        Assert.Equal("skipping", insight.Topics.Single(item => item.Topic == "Cümle Bilgisi").Diagnosis);
        // Öncelik: %20'deki Cümle Bilgisi, %50'den düşen Üslü Sayılar'dan önce; sıra 1'den başlar.
        Assert.Equal("Cümle Bilgisi", insight.WeakTopics[0].Topic);
        Assert.Equal([1, 2, 3], insight.WeakTopics.Select(item => item.Priority ?? 0));
        Assert.All(insight.WeakTopics, item => Assert.InRange(item.SuggestedQuestions ?? 0, 10, 40));
        Assert.All(insight.Topics.Where(item => !item.IsWeak), item => Assert.Null(item.Priority));
    }

    [Fact]
    public async Task Recommendations_AreRecordedOnce_ThenMeasuredAgainstLaterAnswers()
    {
        var ali = await StudentAsync("Ali Yılmaz", "9-A");
        var olas = await QuestionAsync("Matematik", "Olasılık");
        await PracticeAsync(ali, olas, false, false, false, true, false, false); // %16,7 → zayıf, öncelik 1

        var first = (await Service(db).GetStudentAsync(ali.Id))!;
        Assert.Empty(first.Followups!); // yeni açılan öneri bu çağrıda ölçülmez
        var record = Assert.Single(db.StudentRecommendations.AsNoTracking());
        Assert.Equal(("Matematik", "Olasılık", 1), (record.Subject, record.Topic, record.Priority));
        Assert.Equal(16.7m, record.BaselineSuccessRate);

        // Aynı pencere içinde tekrar bakmak ikinci kayıt açmaz; az yeni cevapla sonuç "bekliyor".
        clock = DateTime.UtcNow.AddMinutes(1);
        await PracticeAsync(ali, olas, true, true);
        var pending = Assert.Single((await Service(db).GetStudentAsync(ali.Id))!.Followups!);
        Assert.Equal("pending", pending.Status);
        Assert.Single(db.StudentRecommendations.AsNoTracking());

        // Öneriden sonra 6 cevabın 5'i doğru → %83,3; öncekine göre ilerleme.
        await PracticeAsync(ali, olas, true, true, true, false);
        var improved = Assert.Single((await Service(db).GetStudentAsync(ali.Id))!.Followups!);
        Assert.Equal("improved", improved.Status);
        Assert.Equal(6, improved.AfterSolved);
        Assert.Equal(83.3m, improved.AfterSuccessRate);

        var summary = (await Service(db).GetClassAsync("9-A"))!.Followups!;
        Assert.Equal(1, summary.Improved);
    }

    [Fact]
    public async Task Strong_Topics_AreNotWeak()
    {
        var ali = await StudentAsync("Ali Yılmaz", "9-A");
        var carp = await QuestionAsync("Matematik", "Çarpanlara Ayırma");
        await PracticeAsync(ali, carp, true, true, true, true, true, false);

        var insight = (await Service(db).GetStudentAsync(ali.Id))!;

        var topic = Assert.Single(insight.StrongTopics);
        Assert.Equal("Çarpanlara Ayırma", topic.Topic);
        Assert.Empty(insight.WeakTopics);
    }

    [Fact]
    public async Task Class_RanksStudentsByWeakTopics_AndCountsStruggling()
    {
        var ali = await StudentAsync("Ali Yılmaz", "9-A");
        var ayse = await StudentAsync("Ayşe Kaya", "9-A");
        await StudentAsync("Can Ak", "9-A");
        var us = await QuestionAsync("Matematik", "Üslü Sayılar");
        await PracticeAsync(ali, us, false, false, false, false, true);
        await PracticeAsync(ayse, us, true, true, true, true, true);

        var result = (await Service(db).GetClassAsync("9-a"))!;

        Assert.Equal(3, result.StudentCount);
        Assert.Equal(2, result.ActiveStudentCount);
        Assert.Equal(ali.FullName, result.Students[0].FullName);
        Assert.Equal("Üslü Sayılar", result.Students[0].TopWeakTopic);
        Assert.Equal(1, Assert.Single(result.Topics).StrugglingStudentCount);
    }

    [Fact]
    public async Task BranchManager_SeesOnlyOwnBranchStudents()
    {
        var branchA = Guid.NewGuid();
        var branchB = Guid.NewGuid();
        var ali = await StudentAsync("Ali Yılmaz", "9-A", branchA);
        var veli = await StudentAsync("Veli Can", "9-A", branchB);
        var us = await QuestionAsync("Matematik", "Üslü Sayılar");
        await PracticeAsync(ali, us, true, false, false, false, false);
        await PracticeAsync(veli, us, true, true, true, true, true);

        using var managerContext = NewContext(new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.Role, "Admin"),
            new Claim(ClaimTypes.Role, "BranchManager"),
            new Claim("branch_id", branchA.ToString()),
        ], "test")));
        managerContext.SetTenantOverride(Tenant);
        var service = Service(managerContext);

        Assert.Null(await service.GetStudentAsync(veli.Id));
        var classView = (await service.GetClassAsync("9-A"))!;
        Assert.Equal(ali.FullName, Assert.Single(classView.Students).FullName);
        // Diğer şubedeki öğrenci sınıf ortalamasına da girmez.
        Assert.Null((await service.GetStudentAsync(ali.Id))!.Topics.Single().ClassSuccessRate);
    }

    // ── Not ──────────────────────────────────────────────────────────────────

    private async Task<AppUser> WeakStudentAsync()
    {
        var ali = await StudentAsync("Ali Yılmaz", "9-A");
        var us = await QuestionAsync("Matematik", "Üslü Sayılar");
        var carp = await QuestionAsync("Matematik", "Çarpanlara Ayırma");
        await PracticeAsync(ali, us, true, false, false, false, false, false);
        await PracticeAsync(ali, carp, true, true, true, true, true);
        return ali;
    }

    [Fact]
    public async Task Note_WhenAiDisabled_IsTemplate_WithoutPersonalData()
    {
        var ali = await WeakStudentAsync();
        var service = Service(db);

        var note = (await service.RequestNoteAsync(ali.Id, null))!;

        Assert.Equal("ready", note.Status);
        Assert.Equal("template", note.Source);
        Assert.Contains("Üslü Sayılar", note.Text);
        Assert.True(note.IsCurrent);
        var stored = await db.StudentInsightNotes.SingleAsync();
        Assert.DoesNotContain("Ali", stored.Draft);
        Assert.DoesNotContain("9-A", stored.Draft);
        Assert.DoesNotMatch(@"\d", stored.Draft);
        // Veri değişmediyse ikinci istek yeni not üretmez.
        await service.RequestNoteAsync(ali.Id, null);
        Assert.Equal(1, await db.StudentInsightNotes.CountAsync());
    }

    [Fact]
    public async Task Note_FromModel_UsedOnlyWhenValid()
    {
        var ali = await WeakStudentAsync();
        var good = new FakeGenerator(true, "{\"not\":\"Öğrencinin üslü sayılar konusunda yanlışları ağırlıkta; temel kuralları tekrar edip çözümlü örneklerle hata analizi yapması önerilir. Çarpanlara ayırma konusunda başarılı.\"}");
        var service = Service(db, good);

        var pending = (await service.RequestNoteAsync(ali.Id, null))!;
        Assert.Equal("pending", pending.Status);
        await service.GenerateNoteAsync(Tenant, pending.Id!.Value);

        var note = (await service.GetStudentAsync(ali.Id))!.Note;
        Assert.Equal("llm", note.Source);
        Assert.StartsWith("Öğrencinin üslü sayılar", note.Text);
        Assert.DoesNotContain("Ali", good.LastUserMessage);
    }

    [Theory]
    [InlineData("{\"not\":\"Öğrenci üslü sayılar konusunda yüzde otuz üç başarı gösterdi ve 3 test çözmeli; tekrar önerilir.\"}", "Rakam")]
    [InlineData("{\"not\":\"Öğrenci üslü sayılar konusunda 需要 tekrar yapmalı ve çözümlü örneklerle çalışmalı.\"}", "Türkçe dışı")]
    [InlineData("{\"not\":\"Öğrenci matematikte genel olarak iyi durumda, düzenli tekrar yapması yeterli olur gibi görünüyor.\"}", "Zayıf konu eksik")]
    [InlineData("{\"not\":\"Öğrenci üslü sayılar konusunda zorlanıyor. Çarpanlara ayırma konusunda da tekrar yapmalı.\"}", "Güçlü konu")]
    [InlineData("not json", "Boş")]
    [InlineData("{\"not\":\"Özür dilerim, öğrencinizin üslü sayılar konusunda yanlışları ağırlıkta; temel kuralları tekrar etmesi önerilir.\"}", "hitap")]
    [InlineData("{\"not\":\"Öğrencinin üslü sayılar konusunda son çalışmalarında düşüş var; temel kuralları tekrar etmesi önerilir.\"}", "düşüş")]
    public async Task Note_InvalidModelOutput_FallsBackToTemplate(string output, string reason)
    {
        var ali = await WeakStudentAsync();
        var service = Service(db, new FakeGenerator(true, output));

        var pending = (await service.RequestNoteAsync(ali.Id, null))!;
        await service.GenerateNoteAsync(Tenant, pending.Id!.Value);

        var stored = await db.StudentInsightNotes.SingleAsync();
        Assert.Equal("template", stored.Source);
        Assert.Contains(reason, stored.Error);
        Assert.Contains("Üslü Sayılar", stored.Text);
    }

    [Fact]
    public async Task Review_EditStoresTrainingExample()
    {
        var ali = await WeakStudentAsync();
        var service = Service(db);
        var note = (await service.RequestNoteAsync(ali.Id, null))!;

        await Assert.ThrowsAsync<ArgumentException>(() => service.ReviewNoteAsync(note.Id!.Value, new ReviewInsightNoteRequest("edit", "kısa"), null));
        var edited = (await service.ReviewNoteAsync(note.Id!.Value, new ReviewInsightNoteRequest("edit", "Üslü sayılarda kuralları karıştırıyor; kısa bir tekrar ve hata analizi öneriyorum."), null))!;

        Assert.Equal("Edited", edited.ReviewStatus);
        Assert.StartsWith("Üslü sayılarda", edited.Text);
        var stored = await db.StudentInsightNotes.SingleAsync();
        Assert.False(string.IsNullOrWhiteSpace(stored.Draft));
        Assert.Equal(edited.Text, stored.ReviewedText);
    }

    [Fact]
    public async Task Note_RequiresTopicData()
    {
        var ali = await StudentAsync("Ali Yılmaz", "9-A");
        await Assert.ThrowsAsync<InvalidOperationException>(() => Service(db).RequestNoteAsync(ali.Id, null));
    }
}
