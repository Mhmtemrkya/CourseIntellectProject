using System.Security.Claims;
using CourseIntellect.Application.DTOs.Assistant;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace CourseIntellect.Tests;

/// <summary>
/// Asistanın servis davranışları: ekrandaki öğrenci bağlamı, günlük brifing, geri bildirim
/// ve yöneticinin "cevaplanamayan sorular" listesi.
/// </summary>
public sealed class AssistantServiceTests : IDisposable
{
    private readonly SqliteConnection connection = new("DataSource=:memory:");
    private readonly CourseIntellectDbContext db;
    private static readonly Guid Tenant = Guid.NewGuid();

    public AssistantServiceTests()
    {
        connection.Open();
        db = new CourseIntellectDbContext(new DbContextOptionsBuilder<CourseIntellectDbContext>().UseSqlite(connection).Options);
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

    private sealed class AllowAll : IEntitlementService
    {
        public Task<bool> IsAllowedAsync(ClaimsPrincipal user, string module, string? action, CancellationToken cancellationToken = default) => Task.FromResult(true);
    }

    private sealed class SilentNotifier : IParentNotifier
    {
        public Task NotifyStudentParentAsync(string studentName, string title, string message, string category, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyStudentParentAsync(Guid? studentUserId, string studentName, string title, string message, string category, string? dedupeKey, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private AssistantService Service() => new(
        db,
        new RuleBasedAssistantIntentResolver(),
        new AllowAll(),
        new SilentNotifier(),
        NullLogger<AssistantService>.Instance,
        new StudentInsightService(db, new DisabledGenerator(), new NoOpBackgroundJobClient(NullLogger<NoOpBackgroundJobClient>.Instance), NullLogger<StudentInsightService>.Instance));

    private sealed class DisabledGenerator : IInsightTextGenerator
    {
        public bool IsEnabled => false;
        public string Model => "off";
        public Task<string?> GenerateJsonAsync(string systemPrompt, IReadOnlyList<(string Role, string Content)> messages, object jsonSchema, CancellationToken cancellationToken) => Task.FromResult<string?>(null);
    }

    private static AssistantRequestContext Context(Guid userId, string role, string name)
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", userId.ToString()), new Claim("tenant_id", Tenant.ToString()), new Claim("role", role), new Claim("name", name)], "test"));
        return new AssistantRequestContext(userId, Tenant, null, role, new HashSet<string>([role], StringComparer.OrdinalIgnoreCase), principal, "corr", "127.0.0.1", "test") { Language = "tr" };
    }

    private async Task<(AppUser User, StudentProfile Profile)> StudentAsync(string name, string className, Guid? parentUserId = null)
    {
        var user = new AppUser { FullName = name, Username = $"s-{Guid.NewGuid():N}"[..18], PasswordHash = "x", PrimaryRole = UserRole.Student };
        var profile = new StudentProfile { UserId = user.Id, FullName = name, ClassName = className, ParentUserId = parentUserId };
        db.Users.Add(user);
        db.Students.Add(profile);
        await db.SaveChangesAsync();
        return (user, profile);
    }

    private static SendAssistantMessageRequest Ask(string text, Guid? focusId = null, string? focusName = null, Guid? conversationId = null) =>
        new(conversationId, text, Guid.NewGuid(), new AssistantClientContext("/students", focusId, null, "tr", focusName));

    [Fact]
    public async Task ScreenFocus_AnswersAboutTheStudentOnScreen_WithoutTypingAName()
    {
        var admin = Guid.NewGuid();
        await StudentAsync("Ali Yılmaz", "10-A");
        var (ayseUser, ayse) = await StudentAsync("Ayşe Demir", "10-A");

        // Soyad kayıtta büyük harfe çevrilir ("Ayşe DEMİR"); bu yüzden ad üzerinden doğrulanır.
        var byProfile = await Service().SendAsync(Context(admin, "Admin", "Demo Yönetici"), Ask("devamsızlığı nasıl", ayse.Id), CancellationToken.None);
        Assert.Equal("attendance_summary", byProfile.Type);
        Assert.Contains("Ayşe", byProfile.Text);

        // Kullanıcı kimliği ya da ad da aynı öğrenciyi işaret eder.
        var byUser = await Service().SendAsync(Context(admin, "Admin", "Demo Yönetici"), Ask("sınav sonuçları", ayseUser.Id), CancellationToken.None);
        Assert.Contains("Ayşe", byUser.Text);
        var byName = await Service().SendAsync(Context(admin, "Admin", "Demo Yönetici"), Ask("devamsızlığı nasıl", null, "Ayşe Demir"), CancellationToken.None);
        Assert.Contains("Ayşe", byName.Text);

        // Ad yazılırsa ekran bağlamını ezer.
        var named = await Service().SendAsync(Context(admin, "Admin", "Demo Yönetici"), Ask("Ali Yılmaz devamsızlığı", ayse.Id), CancellationToken.None);
        Assert.Contains("Ali", named.Text);
        Assert.DoesNotContain("Ayşe", named.Text);
    }

    [Fact]
    public async Task ScreenFocus_CannotReachAStudentOutsideTheParentsChildren()
    {
        var parent = new AppUser { FullName = "Veli Ayşe", Username = "veli.test", PasswordHash = "x", PrimaryRole = UserRole.Parent };
        db.Users.Add(parent);
        await db.SaveChangesAsync();
        await StudentAsync("Can Arslan", "9-B", parent.Id);
        var (_, stranger) = await StudentAsync("Zeynep Çelik", "10-A");

        var response = await Service().SendAsync(Context(parent.Id, "Parent", "Veli Ayşe"), Ask("devamsızlığı nasıl", stranger.Id), CancellationToken.None);
        Assert.DoesNotContain("Zeynep", response.Text);
        Assert.Contains("Can", response.Text);
    }

    [Fact]
    public async Task Briefing_Student_ListsPendingHomeworkInSecondPerson()
    {
        var (user, _) = await StudentAsync("Ali Yılmaz", "10-A");
        db.HomeworkAssignments.Add(new HomeworkAssignment { Title = "Türev testi", ClassName = "10-A", Subject = "Matematik", Teacher = "Hasan", DeadlineLabel = "2026-11-05" });
        await db.SaveChangesAsync();

        var briefing = await Service().GetBriefingAsync(Context(user.Id, "Student", "Ali Yılmaz"), CancellationToken.None);
        Assert.Contains("Ali", briefing.Greeting);
        var homework = Assert.Single(briefing.Items, item => item.Text.Contains("Türev testi"));
        Assert.Contains("ödevin var", homework.Text);
        Assert.Equal("warn", homework.Tone);
        Assert.Equal("Bekleyen ödevlerim", homework.Ask);
    }

    [Fact]
    public async Task Briefing_Accounting_ShowsOverdueButNoAcademicLines()
    {
        var (student, _) = await StudentAsync("Ali Yılmaz", "10-A");
        db.FinanceInstallments.Add(new FinanceInstallment { TenantId = Tenant, StudentUserId = student.Id, StudentName = "Ali Yılmaz", Amount = 5000, PaidAmount = 1000, DueDateUtc = DateTime.UtcNow.AddDays(-10) });
        await db.SaveChangesAsync();

        var briefing = await Service().GetBriefingAsync(Context(Guid.NewGuid(), "Accounting", "Selim Muhasebe"), CancellationToken.None);
        Assert.Contains(briefing.Items, item => item.Tone == "warn" && item.Text.Contains("Vadesi geçmiş 1 taksit"));
        Assert.DoesNotContain(briefing.Items, item => item.Text.Contains("ders", StringComparison.OrdinalIgnoreCase) || item.Text.Contains("devamsız"));
    }

    [Fact]
    public async Task Briefing_NothingToReport_SaysAllClear()
    {
        var quiet = await Service().GetBriefingAsync(Context(Guid.NewGuid(), "Administrative", "Ceren İdari"), CancellationToken.None);
        var line = Assert.Single(quiet.Items);
        Assert.Equal("good", line.Tone);
        Assert.Contains("devamsız öğrenci yok", line.Text);

        // Profili olmayan öğrenci hesabı: söylenecek hiçbir şey yok, bunu açıkça söyler.
        var empty = await Service().GetBriefingAsync(Context(Guid.NewGuid(), "Student", "Yeni Öğrenci"), CancellationToken.None);
        Assert.Contains(empty.Items, item => item.Text.Contains("dikkat etmen gereken bir şey görünmüyor"));
    }

    /// <summary>Sohbet cümleleri kibar, türüne uygun cevap alır; öğretmene "Hoca" diye, siz diliyle hitap edilir.</summary>
    [Theory]
    [InlineData("teşekkürler", "Rica ederim|Ne demek|Memnuniyetle")]
    [InlineData("görüşürüz", "Görüşmek üzere Hasan Hoca|Hoşça kalın Hasan Hoca")]
    [InlineData("iyi geceler", "İyi geceler Hasan Hoca")]
    [InlineData("kolay gelsin", "Sağ olun Hasan Hoca, size de kolay gelsin")]
    [InlineData("iyi çalışmalar", "size de iyi çalışmalar")]
    [InlineData("harikasın", "teşekkür ederim")]
    [InlineData("özür dilerim", "Hiç sorun değil")]
    [InlineData("beni anlamıyorsun", "Kusura bakmayın")]
    [InlineData("bot musun", "İnsan değilim")]
    [InlineData("ne yapabiliyorsun", "Ben Maydi, SchoolAsist'in asistanıyım")]
    [InlineData("adın ne", "Ben Maydi")]
    [InlineData("Maydi kim?", "Ben Maydi")]
    [InlineData("Maydi, bot musun", "ben Maydi")]
    [InlineData("Maydi!", "Hasan Hoca!")]
    [InlineData("teşekkürler Maydi'ciğim", "Rica ederim|Ne demek|Memnuniyetle")]
    [InlineData("merhaba nasılsın", "İyiyim|her şey yolunda")]
    [InlineData("eyvallah çok işime yaradı", "Yardımcı olabildiysem ne mutlu bana")]
    public async Task SmallTalk_RepliesPolitelyByKind(string message, string expected)
    {
        var response = await Service().SendAsync(Context(Guid.NewGuid(), "Teacher", "Hasan Yılmaz"), Ask(message), CancellationToken.None);
        Assert.Equal("text", response.Type);
        Assert.True(expected.Split('|').Any(response.Text.Contains), response.Text);
    }

    /// <summary>"Maydi" hitabı sorudan çıkar; ad bir öğrenci sanılmaz, kalan soru aynen anlaşılır.</summary>
    [Theory]
    [InlineData("Maydi, bugün kim gelmedi?", "bugün kim gelmedi?")]
    [InlineData("selam maydi", "selam")]
    [InlineData("MAYDİ nasılsın", "nasılsın")]
    [InlineData("Maydi'ye bir sorum var: Ali'nin notları", "bir sorum var: Ali'nin notları")]
    [InlineData("maydanoz kaç para", "maydanoz kaç para")]
    [InlineData("Ali'nin notları", "Ali'nin notları")]
    public void WithoutName_StripsOnlyTheAddress(string message, string expected) =>
        Assert.Equal(expected, AssistantSmallTalk.WithoutName(message));

    [Fact]
    public async Task SmallTalk_GreetingWithHowAreYou_GreetsBack_AndFarewellHasNoSuggestions()
    {
        var hello = await Service().SendAsync(Context(Guid.NewGuid(), "Student", "Ali Yılmaz"), Ask("selam nasılsın"), CancellationToken.None);
        Assert.StartsWith("Selam Ali!", hello.Text);
        Assert.True(hello.Text.Contains("sorduğun için") || hello.Text.Contains("her şey yolunda"), hello.Text);

        var bye = await Service().SendAsync(Context(Guid.NewGuid(), "Student", "Ali Yılmaz"), Ask("hoşça kal"), CancellationToken.None);
        Assert.Empty(bye.Suggestions ?? []);
    }

    [Fact]
    public async Task Feedback_OnlyOwnAssistantMessages()
    {
        var user = Guid.NewGuid();
        var response = await Service().SendAsync(Context(user, "Admin", "Demo"), Ask("merhaba"), CancellationToken.None);

        Assert.False(await Service().SetFeedbackAsync(Context(Guid.NewGuid(), "Admin", "Başka"), response.MessageId, false, CancellationToken.None));
        Assert.True(await Service().SetFeedbackAsync(Context(user, "Admin", "Demo"), response.MessageId, false, CancellationToken.None));
        Assert.Equal((short)-1, (await db.AssistantMessages.AsNoTracking().SingleAsync(x => x.Id == response.MessageId)).Feedback);
    }

    [Fact]
    public async Task Unanswered_CollectsUnknownMissingGuideAndDownvoted_WithQuestionText()
    {
        var admin = Guid.NewGuid();
        var service = Service();
        await service.SendAsync(Context(admin, "Admin", "Demo"), Ask("zxqw blorp"), CancellationToken.None);
        await service.SendAsync(Context(admin, "Admin", "Demo"), Ask("uzay gemisi nasıl park edilir"), CancellationToken.None);
        var greeting = await service.SendAsync(Context(admin, "Admin", "Demo"), Ask("merhaba"), CancellationToken.None);
        await service.SetFeedbackAsync(Context(admin, "Admin", "Demo"), greeting.MessageId, false, CancellationToken.None);
        await service.SendAsync(Context(admin, "Admin", "Demo"), Ask("teşekkürler"), CancellationToken.None);

        var rows = await service.GetUnansweredAsync(Context(admin, "Admin", "Demo"), 30, CancellationToken.None);
        Assert.Contains(rows, row => row.Reason == "unknown" && row.Question == "zxqw blorp");
        Assert.Contains(rows, row => row.Reason == "no_guide" && row.Question.StartsWith("uzay gemisi"));
        Assert.Contains(rows, row => row.Reason == "negative" && row.Question == "merhaba");
        Assert.DoesNotContain(rows, row => row.Question == "teşekkürler");
        Assert.All(rows, row => Assert.Equal("admin", row.Portal));
    }

    [Fact]
    public async Task Conversations_AreListedPerPortal()
    {
        var user = Guid.NewGuid();
        var service = Service();
        await service.SendAsync(Context(user, "Admin", "Demo"), Ask("kurum özeti"), CancellationToken.None);

        Assert.Single(await service.GetConversationsAsync(Context(user, "Admin", "Demo"), "admin", CancellationToken.None));
        Assert.Empty(await service.GetConversationsAsync(Context(user, "Admin", "Demo"), "parent", CancellationToken.None));
    }
}
