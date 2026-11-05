using Microsoft.Extensions.Configuration;
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

    // ── Haftalık özet ve sınıf önerileri ───────────────────────────────────────

    /// <summary>10-A: 4 öğrenciden 3'ü Olasılık'ta zayıf (sınıf tekrarı), biri iyi. Öğretmen 10-A'ya giriyor.</summary>
    private async Task<(Guid Teacher, Guid Parent, AppUser WeakStudent)> SeedClassWithSharedWeaknessAsync()
    {
        var teacher = Guid.NewGuid();
        var parent = Guid.NewGuid();
        db.TeacherTimetableSlots.Add(new TeacherTimetableSlot { TeacherUserId = teacher, TeacherName = "Hasan Hoca", DayOfWeek = 1, StartTime = "09:00", EndTime = "09:40", ClassName = "10-A", Lesson = "Matematik" });
        var question = new QuestionBankItem { Subject = "Matematik", Topic = "Olasılık", QuestionText = "?", Type = "Test", Difficulty = "Orta", Teacher = "T" };
        db.QuestionBankItems.Add(question);
        await db.SaveChangesAsync();
        var students = new[]
        {
            await StudentAsync("Ece Kurt", "10-A", parent),
            await StudentAsync("Deniz Ak", "10-A"),
            await StudentAsync("Ozan Er", "10-A"),
            await StudentAsync("Mina Tan", "10-A"),
        };
        var at = DateTime.UtcNow.AddDays(-3);
        for (var index = 0; index < students.Length; index++)
        {
            for (var i = 0; i < 8; i++)
            {
                db.QuestionPracticeAttempts.Add(new QuestionPracticeAttempt
                {
                    QuestionId = question.Id, StudentUsername = students[index].User.Username, StudentName = students[index].User.FullName,
                    IsCorrect = index == 3 || i == 0, SubmittedAtUtc = at.AddMinutes(index * 10 + i),
                });
            }
        }
        await db.SaveChangesAsync();
        return (teacher, parent, students[0].User);
    }

    /// <summary>Brifingdeki her maddenin sorusu aynı rol için Maydi'de cevaplanır ("anlamadım"a düşmez).</summary>
    private async Task AssertAsksResolveAsync(AssistantRequestContext context)
    {
        var briefing = await Service().GetBriefingAsync(context, CancellationToken.None);
        foreach (var ask in briefing.Items.Select(item => item.Ask).OfType<string>())
        {
            var response = await Service().SendAsync(context, Ask(ask), CancellationToken.None);
            Assert.True(response.Type is not ("quick_actions" or "error" or "permission_denied"), $"\"{ask}\" → {response.Type}: {response.Text}");
        }
    }

    [Fact]
    public async Task WeeklyDigest_GivesEachRoleActionableItems_ThatMaydiCanAnswer()
    {
        var (teacher, parent, weak) = await SeedClassWithSharedWeaknessAsync();

        var teacherBriefing = await Service().GetBriefingAsync(Context(teacher, "Teacher", "Hasan Hoca"), CancellationToken.None);
        var classItem = Assert.Single(teacherBriefing.Items, item => item.Ask == "10-A sınıfının zayıf konuları");
        Assert.Contains("Olasılık", classItem.Text);
        Assert.Contains("sınıf tekrarı", classItem.Text);
        await AssertAsksResolveAsync(Context(teacher, "Teacher", "Hasan Hoca"));

        var admin = Guid.NewGuid();
        var adminBriefing = await Service().GetBriefingAsync(Context(admin, "Admin", "Demo Yönetici"), CancellationToken.None);
        Assert.Contains(adminBriefing.Items, item => item.Text.Contains("Sınıf tekrarı önerdiğim sınıflar") && item.Text.Contains("10-A"));
        await AssertAsksResolveAsync(Context(admin, "Admin", "Demo Yönetici"));

        var parentBriefing = await Service().GetBriefingAsync(Context(parent, "Parent", "Veli"), CancellationToken.None);
        Assert.Contains(parentBriefing.Items, item => item.Text.Contains("Olasılık") && item.Text.Contains("soru"));
        await AssertAsksResolveAsync(Context(parent, "Parent", "Veli"));

        var studentBriefing = await Service().GetBriefingAsync(Context(weak.Id, "Student", weak.FullName), CancellationToken.None);
        Assert.Contains(studentBriefing.Items, item => item.Text.Contains("Olasılık") && item.Text.Contains("soru"));
        await AssertAsksResolveAsync(Context(weak.Id, "Student", weak.FullName));
        Assert.All(new[] { teacherBriefing, adminBriefing, parentBriefing, studentBriefing }, briefing => Assert.InRange(briefing.Items.Count, 1, 6));
    }

    private sealed class RecordingPush : IPushNotificationService
    {
        public List<(Guid User, string Title, string Body)> Sent { get; } = [];
        public bool IsConfigured => true;
        public Task SendToUserAsync(Guid userId, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default)
        {
            Sent.Add((userId, title, body));
            return Task.CompletedTask;
        }
        public Task SendToUserByNameAsync(string fullName, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task SendToRoleAsync(string role, string title, string body, IReadOnlyDictionary<string, string>? data = null, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private WeeklyDigestJob DigestJob(RecordingPush push, bool enabled) => new(
        db,
        new StudentInsightService(db, new DisabledGenerator(), new NoOpBackgroundJobClient(NullLogger<NoOpBackgroundJobClient>.Instance), NullLogger<StudentInsightService>.Instance),
        push,
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Assistant:WeeklyDigest:Enabled"] = enabled ? "true" : "false" }).Build(),
        NullLogger<WeeklyDigestJob>.Instance);

    [Fact]
    public async Task WeeklyDigestJob_IsOffByDefault_SendsCountsOnly_AndNeverTwiceAWeek()
    {
        var (teacher, _, _) = await SeedClassWithSharedWeaknessAsync();
        var quietTeacher = Guid.NewGuid();
        db.TeacherTimetableSlots.Add(new TeacherTimetableSlot { TeacherUserId = quietTeacher, TeacherName = "Sessiz", DayOfWeek = 3, StartTime = "11:00", EndTime = "11:40", ClassName = "12-C", Lesson = "Tarih" });
        await db.SaveChangesAsync();
        db.SetTenantOverride(null);

        var push = new RecordingPush();
        Assert.Equal(0, await DigestJob(push, enabled: false).RunAsync());
        Assert.Empty(push.Sent);
        Assert.DoesNotContain(db.Notifications.IgnoreQueryFilters(), item => item.Category == WeeklyDigestJob.Category);

        Assert.Equal(1, await DigestJob(push, enabled: true).RunAsync());
        var (user, _, body) = Assert.Single(push.Sent);
        Assert.Equal(teacher, user);
        Assert.Contains("1 sınıf tekrarı", body);
        foreach (var name in new[] { "Ece", "Deniz", "Ozan", "Mina", "Olasılık" }) Assert.DoesNotContain(name, body);

        // Aynı hafta yeniden çalışırsa (Hangfire yeniden denemesi) ikinci kez gönderilmez.
        Assert.Equal(0, await DigestJob(push, enabled: true).RunAsync());
        Assert.Single(push.Sent);
        db.SetTenantOverride(Tenant);
    }

    [Fact]
    public async Task ParentDigest_CountsAbsencesById_AndComparesWithLastWeek()
    {
        var parent = Guid.NewGuid();
        var (_, mine) = await StudentAsync("Ece Kurt", "7-A", parent);
        var (_, namesake) = await StudentAsync("Ece Kurt", "8-B");
        var today = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(3).Date, DateTimeKind.Utc);
        void Absent(StudentProfile who, DateTime day) => db.AttendanceEntries.Add(new AttendanceEntry
            { StudentId = who.Id, StudentName = who.FullName, ClassName = who.ClassName, LessonDate = day, Status = "Devamsiz", Lesson = "Matematik" });
        Absent(mine, today.AddDays(-1));
        Absent(mine, today.AddDays(-2));
        Absent(mine, today.AddDays(-9));
        for (var i = 0; i < 5; i++) Absent(namesake, today.AddDays(-1)); // aynı adlı başka öğrenci sayılmaz
        await db.SaveChangesAsync();

        var briefing = await Service().GetBriefingAsync(Context(parent, "Parent", "Veli"), CancellationToken.None);
        var line = Assert.Single(briefing.Items, item => item.Text.Contains("devamsız"));
        Assert.Contains("son 7 günde 2 ders", line.Text);
        Assert.Contains("önceki 7 günde 1", line.Text);
        Assert.Equal("warn", line.Tone);
    }

    [Fact]
    public async Task ClassTopicQuestion_IsLimitedToTheTeachersOwnClasses()
    {
        var (teacher, parent, _) = await SeedClassWithSharedWeaknessAsync();

        var own = await Service().SendAsync(Context(teacher, "Teacher", "Hasan Hoca"), Ask("10-A sınıfının zayıf konuları"), CancellationToken.None);
        Assert.Equal("text", own.Type);
        Assert.Contains("sınıf tekrarı", own.Text);

        var otherTeacher = Guid.NewGuid();
        db.TeacherTimetableSlots.Add(new TeacherTimetableSlot { TeacherUserId = otherTeacher, TeacherName = "Başka", DayOfWeek = 2, StartTime = "10:00", EndTime = "10:40", ClassName = "9-B", Lesson = "Fizik" });
        await db.SaveChangesAsync();
        var foreign = await Service().SendAsync(Context(otherTeacher, "Teacher", "Başka Hoca"), Ask("10-A sınıfının zayıf konuları"), CancellationToken.None);
        Assert.Equal("permission_denied", foreign.Type);
        Assert.DoesNotContain("Olasılık", foreign.Text);

        // Veli sınıf yoluna hiç girmez: kendi çocuğunun konu analizi döner, sınıf önerisi/adlar değil.
        var byParent = await Service().SendAsync(Context(parent, "Parent", "Veli"), Ask("10-A sınıfının zayıf konuları"), CancellationToken.None);
        Assert.NotEqual("permission_denied", byParent.Type);
        Assert.DoesNotContain("Deniz", byParent.Text);
        Assert.DoesNotContain("etüt", byParent.Text);
    }

    [Fact]
    public async Task MisspelledStudentName_FindsTheRightStudent()
    {
        var admin = Guid.NewGuid();
        await StudentAsync("Ahmet Yılmaz", "10-A");
        await StudentAsync("Ahmet Kaya", "10-B");
        await StudentAsync("Ayşe Demir", "10-A");

        // Soyadı yanlış yazıldı: birçok Ahmet arasından Yılmaz seçilir, seçim kartı çıkmaz.
        var typoSurname = await Service().SendAsync(Context(admin, "Admin", "Demo"), Ask("Ahmet Yılmz devamsızlığı"), CancellationToken.None);
        Assert.Equal("attendance_summary", typoSurname.Type);
        Assert.Contains("Ahmet Y", typoSurname.Text);

        // Ad ve anahtar kelime birlikte yanlış: ad + devamsızlık yine anlaşılır.
        var bothTypos = await Service().SendAsync(Context(admin, "Admin", "Demo"), Ask("Ayşe Demr devamszlığı"), CancellationToken.None);
        Assert.Equal("attendance_summary", bothTypos.Type);
        Assert.Contains("Ayşe", bothTypos.Text);

        // Ekli yazım: "Yılmz'ın".
        var suffixed = await Service().SendAsync(Context(admin, "Admin", "Demo"), Ask("Ahmet Yılmz'ın sınav sonuçları"), CancellationToken.None);
        Assert.Equal("exam_results", suffixed.Type);

        // Birebir yazılan ad her zaman yazım hatalı adaydan öne geçer.
        await StudentAsync("Ali Kaya", "9-A");
        await StudentAsync("Ali Kara", "9-B");
        var exact = await Service().SendAsync(Context(admin, "Admin", "Demo"), Ask("Ali Kara devamsızlığı"), CancellationToken.None);
        Assert.Contains("Kara", exact.Text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Kaya", exact.Text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task KeywordsAreNotMistakenForSimilarStudentNames()
    {
        var admin = Guid.NewGuid();
        await StudentAsync("Sinan Öz", "10-A");
        await StudentAsync("Mert Ak", "10-A");

        // "sınav" Sinan'a bir harf uzak ama anahtar kelimedir: öğrenci seçilmez, hangi öğrenci diye sorulur.
        var response = await Service().SendAsync(Context(admin, "Admin", "Demo"), Ask("sınav sonuçları"), CancellationToken.None);
        Assert.DoesNotContain("Sinan", response.Text);

        // Sinan yazılınca yine Sinan bulunur (ad "sınav"a düzeltilmez).
        var byName = await Service().SendAsync(Context(admin, "Admin", "Demo"), Ask("Sinan"), CancellationToken.None);
        Assert.Contains("Sinan", byName.Text);
    }

    [Fact]
    public async Task MisspelledName_NeverReachesAStudentOutsideTheParentsChildren()
    {
        var parent = Guid.NewGuid();
        await StudentAsync("Zeynep Arslan", "7-A", parent);
        await StudentAsync("Zeynep Aslan", "7-B");

        var response = await Service().SendAsync(Context(parent, "Parent", "Veli"), Ask("Zeynep Arsln devamsızlığı"), CancellationToken.None);
        Assert.Contains("Arslan", response.Text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("7-B", response.Text);
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
