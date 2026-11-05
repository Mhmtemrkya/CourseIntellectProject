using System.Text;
using System.Text.Json;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.DTOs.OpticalExams;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

/// <summary>Deneme sonrası çalışma planı: zayıf konular, görev önerisi, onayla yazma, veli özeti.</summary>
public sealed class OpticalStudyPlanServiceTests : IDisposable
{
    private readonly SqliteConnection connection = new("DataSource=:memory:");
    private readonly CourseIntellectDbContext db;
    private readonly RecordingNotifier notifier = new();
    private readonly RecordingAudit audit = new();
    private static readonly Guid Tenant = Guid.NewGuid();

    public OpticalStudyPlanServiceTests()
    {
        connection.Open();
        db = new CourseIntellectDbContext(new DbContextOptionsBuilder<CourseIntellectDbContext>().UseSqlite(connection).Options, null);
        db.Database.EnsureCreated();
        db.TenantWorkspaces.Add(new TenantWorkspace { Id = Tenant, Name = "Okul", Slug = $"t-{Guid.NewGuid():N}"[..20], ContactEmail = "a@b.co", Plan = "free", Status = "active" });
        db.SaveChanges();
        db.SetTenantOverride(Tenant);
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
    }

    public void Dispose()
    {
        db.Dispose();
        connection.Dispose();
    }

    private OpticalStudyPlanService Service() => new(db, new StudyPlanService(db), notifier, audit);

    private static string Line(string no, string name, string answers) => no.PadRight(6) + name.PadRight(20)[..20] + "8-A " + "A" + answers;

    private static byte[] File1254(params string[] lines) => Encoding.GetEncoding(1254).GetBytes(string.Join("\r\n", lines) + "\r\n");

    private async Task<AppUser> StudentAsync(string name, string schoolNo, bool withParent = true)
    {
        var user = new AppUser { FullName = name, Username = $"s-{Guid.NewGuid():N}"[..18], PasswordHash = "x", PrimaryRole = UserRole.Student };
        db.Users.Add(user);
        db.Students.Add(new StudentProfile { UserId = user.Id, FullName = name, ClassName = "8-A", SchoolNumber = schoolNo, ParentUserId = withParent ? Guid.NewGuid() : null });
        await db.SaveChangesAsync();
        return user;
    }

    /// <summary>
    /// 6 soruluk matematik: 1-3 Üslü İfadeler, 4-5 Kareköklü İfadeler, 6 Olasılık. Anahtar ABCDAB.
    /// Ayşe: üslüde 2 yanlış + 1 boş, karekökte 1 yanlış. Mert: hepsi doğru.
    /// </summary>
    private async Task<(Guid ExamId, AppUser Ayse, AppUser Mert)> ImportedExamAsync(bool topics = true)
    {
        var ayse = await StudentAsync("Ayşe Doğan", "101");
        var mert = await StudentAsync("Mert Kaya", "102");
        var exams = new OpticalExamService(db);
        var template = await exams.SaveTemplateAsync(null, new SaveOpticalTemplateRequest(
            "LGS formu", "windows-1254", 1, 6, 7, 20, 27, 4, 31, 1, [new("Matematik", 32, 6)]));
        var topicList = topics ? new[] { "Üslü İfadeler", "Üslü İfadeler", "Üslü İfadeler", "Kareköklü İfadeler", "Kareköklü İfadeler", "Olasılık" } : [];
        var exam = await exams.SaveExamAsync(null, new SaveOpticalExamRequest("2. LGS Denemesi", new DateTime(2026, 11, 1), template.Id, 3, true, "exclude",
            [new("A", [new("Matematik", "ABCDAB", topicList)])], "LGS"));
        await exams.ImportAsync(exam.Id, File1254(Line("101", "AYŞE DOĞAN", "CD DBB"), Line("102", "MERT KAYA", "ABCDAB")), null, "d.txt", [], null);
        return (exam.Id, ayse, mert);
    }

    [Fact]
    public async Task Preview_FindsWeakTopics_BuildsWeekPlan_AndWritesNothing()
    {
        var (examId, ayse, mert) = await ImportedExamAsync();
        var preview = await Service().PreviewAsync(examId, studyPlanEnabled: true);

        Assert.True(preview.HasTopics);
        var row = preview.Students.Single(item => item.StudentUserId == ayse.Id);
        Assert.Equal(["Üslü İfadeler", "Kareköklü İfadeler"], row.WeakTopics.Select(item => item.Topic));
        var uslu = row.WeakTopics[0];
        Assert.Equal((0, 2, 1, 3), (uslu.Correct, uslu.Wrong, uslu.Blank, uslu.Total));
        Assert.Equal(5, row.Tasks.Count); // 2 konu × (tekrar + soru) + yanlış tekrarı
        Assert.Equal("Üslü İfadeler: 25 soru çöz", row.Tasks[1].Title);
        var days = row.Tasks.Select(item => DateTime.Parse(item.Date)).ToList();
        Assert.Equal(days.OrderBy(day => day), days); // sıra korunur, başa sarmaz
        Assert.Equal(6, (days[^1] - days[0]).Days); // ilk gün yarın, son görev haftanın son günü
        Assert.All(days, day => Assert.InRange(day, DateTime.UtcNow.AddHours(3).Date.AddDays(1), DateTime.UtcNow.AddHours(3).Date.AddDays(7)));
        Assert.Contains("Öncelikli çalışma konuları: Üslü İfadeler, Kareköklü İfadeler", row.ParentSummary);
        Assert.DoesNotContain("yanlış", row.ParentSummary);
        Assert.Null(row.SkipReason);

        var strong = preview.Students.Single(item => item.StudentUserId == mert.Id);
        Assert.Empty(strong.WeakTopics);
        Assert.Equal("Bu denemede belirgin bir zayıf konu yok.", strong.SkipReason);
        Assert.Equal(0, await db.StudyPlanStates.CountAsync());
    }

    [Fact]
    public async Task Preview_WithoutTopics_ExplainsWhy()
    {
        var (examId, _, _) = await ImportedExamAsync(topics: false);
        var preview = await Service().PreviewAsync(examId, studyPlanEnabled: true);
        Assert.False(preview.HasTopics);
        Assert.Contains("konuları girilmemiş", preview.Message);
        Assert.All(preview.Students, item => Assert.Empty(item.Tasks));
    }

    [Fact]
    public async Task Apply_WritesEditedTasks_KeepsXp_ReapplyReplacesOnlyPending_NotifiesParentOnce()
    {
        var (examId, ayse, _) = await ImportedExamAsync();
        // Çalışma programı öğrenci kimliğiyle tutulur (ad yalnız gösterim).
        db.StudyPlanStates.Add(new StudyPlanState { StudentUserId = ayse.Id, StudentName = ayse.FullName, XpPoints = 40, PlanItemsSerialized = "[{\"id\":\"m1\",\"type\":\"task\",\"title\":\"Kendi görevim\"}]" });
        await db.SaveChangesAsync();
        var row = (await Service().PreviewAsync(examId, true)).Students.Single(item => item.StudentUserId == ayse.Id);
        var edited = row.Tasks.Take(2).Select(task => task with { Title = task.Title + " (öğretmen)" }).ToList();

        var result = await Service().ApplyAsync(examId, new ApplyOpticalStudyPlansRequest([new(ayse.Id, edited, true, null)]), null);

        Assert.Equal((1, 2, 1), (result.Applied, result.TasksWritten, result.ParentsNotified));
        var plan = await db.StudyPlanStates.AsNoTracking().SingleAsync();
        Assert.Equal(40, plan.XpPoints);
        var items = JsonDocument.Parse(plan.PlanItemsSerialized).RootElement.EnumerateArray().ToList();
        Assert.Equal(3, items.Count);
        Assert.Contains(items, item => item.GetProperty("title").GetString() == "Üslü İfadeler konu tekrarı (öğretmen)" && item.GetProperty("source").GetString() == $"optical-exam:{examId}");
        Assert.Equal(("Çalışma planı hazırlandı", $"optical-plan:{examId}:{ayse.Id}"), (notifier.Sent.Single().Title, notifier.Sent.Single().Dedupe));
        Assert.Contains("optical-study-plan-applied", audit.Entries.Single());
        Assert.True((await Service().PreviewAsync(examId, true)).Students.Single(item => item.StudentUserId == ayse.Id).AlreadyApplied);

        // Bir görev tamamlanmışsa yeniden uygulamada kalır; bekleyen görevler yenisiyle değişir.
        var node = System.Text.Json.Nodes.JsonNode.Parse(plan.PlanItemsSerialized)!.AsArray();
        node.First(item => item!["source"]?.ToString() == $"optical-exam:{examId}")!["status"] = "done";
        await new StudyPlanService(db).UpdatePlanItemsAsync(ayse.Id, ayse.FullName, node.ToJsonString());
        await Service().ApplyAsync(examId, new ApplyOpticalStudyPlansRequest([new(ayse.Id, row.Tasks, true, null)]), null);

        var after = JsonDocument.Parse((await db.StudyPlanStates.AsNoTracking().SingleAsync()).PlanItemsSerialized).RootElement.EnumerateArray().ToList();
        Assert.Equal(1 + 1 + row.Tasks.Count, after.Count); // kendi görevi + tamamlanan + yeni plan
        Assert.Equal(2, notifier.Sent.Count); // bildirim isteği gider; tekrarı dedupe anahtarı engeller
        Assert.All(notifier.Sent, item => Assert.Equal($"optical-plan:{examId}:{ayse.Id}", item.Dedupe));
    }

    [Fact]
    public async Task Apply_RejectsInvalidTasks_AndKeepsNamesakesSeparate()
    {
        var (examId, ayse, _) = await ImportedExamAsync();
        var row = (await Service().PreviewAsync(examId, true)).Students.Single(item => item.StudentUserId == ayse.Id);

        var badDate = row.Tasks.Take(1).Select(task => task with { Date = "2020-01-01" }).ToList();
        await Assert.ThrowsAsync<ArgumentException>(() => Service().ApplyAsync(examId, new ApplyOpticalStudyPlansRequest([new(ayse.Id, badDate, false, null)]), null));
        var tooMany = Enumerable.Repeat(row.Tasks[0], 11).ToList();
        await Assert.ThrowsAsync<ArgumentException>(() => Service().ApplyAsync(examId, new ApplyOpticalStudyPlansRequest([new(ayse.Id, tooMany, false, null)]), null));
        await Assert.ThrowsAsync<ArgumentException>(() => Service().ApplyAsync(examId, new ApplyOpticalStudyPlansRequest([]), null));

        // Aynı adlı ikinci öğrenci: program öğrenci kimliğiyle tutulduğu için plan yazılır ve yalnız
        // o öğrenciye gider; adaşın planı oluşmaz/etkilenmez.
        var twin = await StudentAsync("Ayşe Doğan", "999");
        var preview = (await Service().PreviewAsync(examId, true)).Students.Single(item => item.StudentUserId == ayse.Id);
        Assert.Null(preview.SkipReason);
        var result = await Service().ApplyAsync(examId, new ApplyOpticalStudyPlansRequest([new(ayse.Id, row.Tasks, true, null)]), null);
        Assert.Equal(1, result.Applied);
        var plan = await db.StudyPlanStates.AsNoTracking().SingleAsync();
        Assert.Equal(ayse.Id, plan.StudentUserId);
        Assert.NotEqual(twin.Id, plan.StudentUserId);
    }

    private sealed class RecordingNotifier : IParentNotifier
    {
        public List<(string Title, string? Dedupe)> Sent { get; } = [];

        public Task NotifyStudentParentAsync(string studentName, string title, string message, string category, CancellationToken cancellationToken = default)
        {
            Sent.Add((title, null));
            return Task.CompletedTask;
        }

        public Task NotifyStudentParentAsync(Guid? studentUserId, string studentName, string title, string message, string category, string? dedupeKey, CancellationToken cancellationToken = default)
        {
            Sent.Add((title, dedupeKey));
            return Task.CompletedTask;
        }
    }

    private sealed class RecordingAudit : IAuditLogService
    {
        public List<string> Entries { get; } = [];

        public Task LogAsync(Guid? actorUserId, string actorName, string action, string category, string entityType, string entityId, string detail, CancellationToken cancellationToken = default)
        {
            Entries.Add($"{action}|{detail}");
            return Task.CompletedTask;
        }

        public Task LogAsync(string action, string category, string entityType, string entityId, string detail, CancellationToken cancellationToken = default)
        {
            Entries.Add($"{action}|{detail}");
            return Task.CompletedTask;
        }

        public Task LogChangeAsync(string action, string category, string entityType, string entityId, string detail, object? before, object? after, CancellationToken cancellationToken = default)
        {
            Entries.Add($"{action}|{detail}");
            return Task.CompletedTask;
        }

        public Task<IReadOnlyList<AuditLogDto>> GetAsync(string? category, int take, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<AuditLogPageDto> GetPagedAsync(AuditLogQuery query, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<AuditBranchSummaryDto>> GetBranchSummaryAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }
}
