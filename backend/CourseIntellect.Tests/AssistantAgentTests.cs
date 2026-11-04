using System.Security.Claims;
using System.Text.Json;
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
/// Yerel model ajanı: model rolün araçlarını seçer, araç kapsamı sunucuda uygular. Model yerine
/// senaryolu sahte istemci kullanılır; testler modelin ne dediğinden bağımsız olarak yetki ve
/// veri sınırlarının korunduğunu doğrular.
/// </summary>
public sealed class AssistantAgentTests : IDisposable
{
    private readonly SqliteConnection connection = new("DataSource=:memory:");
    private readonly CourseIntellectDbContext db;
    private static readonly Guid Tenant = Guid.NewGuid();

    public AssistantAgentTests()
    {
        connection.Open();
        db = new CourseIntellectDbContext(new DbContextOptionsBuilder<CourseIntellectDbContext>().UseSqlite(connection).Options);
        db.Database.EnsureCreated();
        db.TenantWorkspaces.Add(new TenantWorkspace { Id = Tenant, Name = "Test Okulu", Slug = $"t-{Guid.NewGuid():N}"[..20], ContactEmail = "a@b.co", Plan = "free", Status = "active", InstitutionType = InstitutionType.PrivateSchool });
        db.SaveChanges();
        db.SetTenantOverride(Tenant);
    }

    public void Dispose()
    {
        db.Dispose();
        connection.Dispose();
    }

    /// <summary>Sırayla verilen turları döndüren sahte model; her turda kendisine gösterilen araçları kaydeder.</summary>
    private sealed class ScriptedModel(params AssistantChatTurn[] turns) : IAssistantChatModel
    {
        private readonly Queue<AssistantChatTurn> queue = new(turns);
        public List<IReadOnlyList<string>> OfferedTools { get; } = [];
        public List<IReadOnlyList<AssistantChatMessage>> Conversations { get; } = [];
        public bool IsEnabled => true;
        public bool NarrateResults => true;
        public TimeSpan Budget => TimeSpan.FromSeconds(30);

        public Task<AssistantChatTurn?> ChatAsync(IReadOnlyList<AssistantChatMessage> messages, IReadOnlyList<AssistantToolSpec> tools, CancellationToken cancellationToken)
        {
            OfferedTools.Add(tools.Select(tool => tool.Name).ToList());
            Conversations.Add(messages.ToList());
            return Task.FromResult<AssistantChatTurn?>(queue.Count > 0 ? queue.Dequeue() : new AssistantChatTurn(string.Empty, []));
        }
    }

    private static AssistantChatTurn Call(string name, object? args = null) =>
        new(string.Empty, [new AssistantToolCall(name, JsonSerializer.SerializeToElement(args ?? new { }))]);

    private static AssistantChatTurn Say(string text) => new(text, []);

    private static readonly JsonSerializerOptions Readable = new() { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
    private static string Json(object? value) => JsonSerializer.Serialize(value, Readable);

    private sealed class AllowAll : IEntitlementService
    {
        public Task<bool> IsAllowedAsync(ClaimsPrincipal user, string module, string? action, CancellationToken cancellationToken = default) => Task.FromResult(true);
    }

    private sealed class SilentNotifier : IParentNotifier
    {
        public Task NotifyStudentParentAsync(string studentName, string title, string message, string category, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task NotifyStudentParentAsync(Guid? studentUserId, string studentName, string title, string message, string category, string? dedupeKey, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class DisabledGenerator : IInsightTextGenerator
    {
        public bool IsEnabled => false;
        public string Model => "off";
        public Task<string?> GenerateJsonAsync(string systemPrompt, IReadOnlyList<(string Role, string Content)> messages, object jsonSchema, CancellationToken cancellationToken) => Task.FromResult<string?>(null);
    }

    private AssistantService Service(IAssistantChatModel? model) => new(
        db,
        new RuleBasedAssistantIntentResolver(),
        new AllowAll(),
        new SilentNotifier(),
        NullLogger<AssistantService>.Instance,
        new StudentInsightService(db, new DisabledGenerator(), new NoOpBackgroundJobClient(NullLogger<NoOpBackgroundJobClient>.Instance), NullLogger<StudentInsightService>.Instance),
        model);

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

    private async Task AbsentAsync(StudentProfile student, int lessons)
    {
        for (var i = 0; i < lessons; i++)
            db.AttendanceEntries.Add(new AttendanceEntry { TenantId = Tenant, StudentName = student.FullName, ClassName = student.ClassName, LessonDate = DateTime.UtcNow.Date.AddDays(-(i % 20)), Status = "Gelmedi", Lesson = "Matematik" });
        await db.SaveChangesAsync();
    }

    private static SendAssistantMessageRequest Ask(string text, Guid? conversationId = null) =>
        new(conversationId, text, Guid.NewGuid(), new AssistantClientContext("/dashboard", null, null, "tr", null));

    [Fact]
    public async Task Student_CannotReachAnotherStudent_EvenIfTheModelAsksForThem()
    {
        var (aliUser, _) = await StudentAsync("Ali Yılmaz", "10-A");
        await StudentAsync("Ayşe Demir", "10-A");
        db.ExamResults.Add(new ExamResult { TenantId = Tenant, ExamTitle = "Yazılı", Subject = "Matematik", DateLabel = "01.10.2026", StudentName = "Ayşe DEMİR", ClassName = "10-A", Score = 97 });
        await db.SaveChangesAsync();

        var model = new ScriptedModel(Call("student_exams", new { student = "Ayşe Demir" }));
        var response = await Service(model).SendAsync(Context(aliUser.Id, "Student", "Ali Yılmaz"), Ask("Ayşe Demir'in sınav notlarını analiz et"), CancellationToken.None);

        Assert.Equal("permission_denied", response.Type);
        Assert.Null(response.Data);
        Assert.DoesNotContain("97", response.Text);
        // Öğrenciye yönetici araçları hiç gösterilmez.
        Assert.DoesNotContain("attendance_ranking", model.OfferedTools[0]);
        Assert.DoesNotContain("finance_report", model.OfferedTools[0]);
    }

    [Fact]
    public async Task Teacher_ClassArgumentOutsideTheirTimetable_IsRejected()
    {
        var teacher = Guid.NewGuid();
        db.TeacherTimetableSlots.Add(new TeacherTimetableSlot { TenantId = Tenant, TeacherUserId = teacher, ClassName = "10-A", DayOfWeek = 1, StartTime = "09:00", Lesson = "Matematik" });
        await db.SaveChangesAsync();
        var (_, own) = await StudentAsync("Ali Yılmaz", "10-A");
        var (_, other) = await StudentAsync("Zeynep Çelik", "11-B");
        await AbsentAsync(own, 2);
        await AbsentAsync(other, 9);

        var denied = await Service(new ScriptedModel(Call("attendance_ranking", new { class_name = "11-B" })))
            .SendAsync(Context(teacher, "Teacher", "Hasan Hoca"), Ask("11-B en çok devamsızlık yapanlar"), CancellationToken.None);
        Assert.Equal("error", denied.Type);
        Assert.DoesNotContain("Zeynep", Json(denied));

        // Sınıf belirtilmezse yalnız öğretmenin sınıfları sayılır.
        var own10A = await Service(new ScriptedModel(Call("attendance_ranking", new { days = 30 }), Say("Ali öne çıkıyor.")))
            .SendAsync(Context(teacher, "Teacher", "Hasan Hoca"), Ask("en çok devamsızlık yapanlar"), CancellationToken.None);
        Assert.Equal("report", own10A.Type);
        var json = Json(own10A.Data);
        Assert.Contains("Ali", json);
        Assert.DoesNotContain("Zeynep", json);
    }

    [Fact]
    public async Task Accounting_IsNotOfferedAcademicTools_AndCannotCallThem()
    {
        var accountant = Guid.NewGuid();
        var (_, ali) = await StudentAsync("Ali Yılmaz", "10-A");
        await AbsentAsync(ali, 5);

        var model = new ScriptedModel(Call("attendance_ranking"));
        var response = await Service(model).SendAsync(Context(accountant, "Accounting", "Selim"), Ask("en çok devamsızlık yapanlar kim"), CancellationToken.None);

        Assert.DoesNotContain("attendance_ranking", model.OfferedTools[0]);
        Assert.DoesNotContain("student_exams", model.OfferedTools[0]);
        Assert.Contains("finance_report", model.OfferedTools[0]);
        Assert.NotEqual("report", response.Type);
        Assert.DoesNotContain("Ali", response.Text);
    }

    [Fact]
    public async Task ModelTextWithoutATool_IsNeverShown()
    {
        var admin = Guid.NewGuid();
        var response = await Service(new ScriptedModel(Say("Türkiye'nin başkenti Ankara'dır.")))
            .SendAsync(Context(admin, "Admin", "Yönetici"), Ask("Türkiye'nin başkenti neresi"), CancellationToken.None);
        Assert.DoesNotContain("Ankara", response.Text);

        var outOfScope = await Service(new ScriptedModel(Call("out_of_scope")))
            .SendAsync(Context(admin, "Admin", "Yönetici"), Ask("bana şiir yaz"), CancellationToken.None);
        Assert.Equal(AssistantIntent.OutOfScope, outOfScope.Intent);
    }

    [Fact]
    public async Task Narrative_WithANumberNotInTheData_FallsBackToTheComputedSummary()
    {
        var admin = Guid.NewGuid();
        var (_, ali) = await StudentAsync("Ali Yılmaz", "10-A");
        await AbsentAsync(ali, 3);

        var invented = await Service(new ScriptedModel(Call("attendance_ranking"), Say("Ali 42 derse gelmedi, durum ciddi.")))
            .SendAsync(Context(admin, "Admin", "Yönetici"), Ask("en çok devamsızlık yapanlar"), CancellationToken.None);
        Assert.DoesNotContain("42", invented.Text);
        Assert.Contains("(3)", invented.Text);

        var grounded = await Service(new ScriptedModel(Call("attendance_ranking"), Say("Ali 3 ders devamsız; veliyle görüşmenizi öneririm.")))
            .SendAsync(Context(admin, "Admin", "Yönetici"), Ask("en çok devamsızlık yapanlar"), CancellationToken.None);
        Assert.Equal("Ali 3 ders devamsız; veliyle görüşmenizi öneririm.", grounded.Text);
    }

    [Fact]
    public async Task ToolWrittenAsText_IsStillExecuted()
    {
        var accountant = Guid.NewGuid();
        var (aliUser, _) = await StudentAsync("Ali Yılmaz", "10-A");
        db.FinanceInstallments.Add(new FinanceInstallment { TenantId = Tenant, StudentUserId = aliUser.Id, StudentName = "Ali Yılmaz", Amount = 5000, PaidAmount = 0, DueDateUtc = DateTime.UtcNow.AddDays(-100) });
        await db.SaveChangesAsync();

        var response = await Service(new ScriptedModel(Say("finance_report {\"month\": \"\"}")))
            .SendAsync(Context(accountant, "Accounting", "Selim"), Ask("gecikmiş taksitler kaç gündür bekliyor"), CancellationToken.None);
        Assert.Equal("report", response.Type);
        Assert.Contains("90 günden eski", Json(response.Data));
    }

    [Fact]
    public async Task FinanceReport_SeparatesGrossRefundAndNet()
    {
        var admin = Guid.NewGuid();
        var (aliUser, _) = await StudentAsync("Ali Yılmaz", "10-A");
        db.FinancePayments.Add(new FinancePayment { TenantId = Tenant, StudentUserId = aliUser.Id, StudentName = "Ali Yılmaz", Amount = 5000, Method = "Cash", PaidAtUtc = DateTime.UtcNow });
        db.FinancePayments.Add(new FinancePayment { TenantId = Tenant, StudentUserId = aliUser.Id, StudentName = "Ali Yılmaz", Amount = -1500, Method = "Cash", EntryType = "Refund", PaidAtUtc = DateTime.UtcNow });
        await db.SaveChangesAsync();

        var response = await Service(new ScriptedModel(Call("finance_report"), Say("")))
            .SendAsync(Context(admin, "Admin", "Yönetici"), Ask("bu ayın finans raporu"), CancellationToken.None);
        var metrics = Json(response.Data);
        Assert.Contains("5.000 ₺", metrics);
        Assert.Contains("1.500 ₺", metrics);
        Assert.Contains("3.500 ₺", metrics);
    }

    [Fact]
    public async Task WithoutTheModel_AnalyticQuestionsStillReachTheirReport()
    {
        var admin = Guid.NewGuid();
        var (_, ali) = await StudentAsync("Ali Yılmaz", "10-A");
        await AbsentAsync(ali, 9);

        var response = await Service(null).SendAsync(Context(admin, "Admin", "Yönetici"), Ask("risk altındaki öğrenciler"), CancellationToken.None);
        Assert.Equal("report", response.Type);
        Assert.Contains("Ali", Json(response.Data));

        var briefing = await Service(null).GetBriefingAsync(Context(admin, "Admin", "Yönetici"), CancellationToken.None);
        Assert.Contains(briefing.Items, item => item.Ask == "Risk altındaki öğrenciler");
    }

    [Theory]
    [InlineData("rapor nasıl alınır", "Admin", "how_to")]
    [InlineData("gecikmiş taksitler nasıl takip edilir", "Accounting", "how_to")]
    [InlineData("borcu olan öğrencilerin raporu", "Admin", "student_list")]
    public async Task WithoutTheModel_RuleAnswersAreNotHijackedByReportWords(string question, string role, string expectedType)
    {
        var user = Guid.NewGuid();
        var (aliUser, _) = await StudentAsync("Ali Yılmaz", "10-A");
        db.FinanceInstallments.Add(new FinanceInstallment { TenantId = Tenant, StudentUserId = aliUser.Id, StudentName = "Ali Yılmaz", Amount = 5000, PaidAmount = 0, DueDateUtc = DateTime.UtcNow.AddDays(-10) });
        await db.SaveChangesAsync();

        var response = await Service(null).SendAsync(Context(user, role, "Kullanıcı"), Ask(question), CancellationToken.None);
        Assert.Equal(expectedType, response.Type);
    }

    [Fact]
    public async Task StudentSuccessReport_HasSixPages_AndRespectsScope()
    {
        var teacher = Guid.NewGuid();
        db.TeacherTimetableSlots.Add(new TeacherTimetableSlot { TenantId = Tenant, TeacherUserId = teacher, ClassName = "10-A", DayOfWeek = 1, StartTime = "09:00", Lesson = "Matematik" });
        var (aliUser, ali) = await StudentAsync("Ali Yılmaz", "10-A");
        var (_, other) = await StudentAsync("Zeynep Çelik", "11-B");
        await StudentAsync("Ayşe Demir", "10-A");
        await AbsentAsync(ali, 3);
        var day = 0;
        foreach (var (subject, score) in new[] { ("Matematik", 62), ("Matematik", 70), ("Türkçe", 81), ("Fizik", 48), ("Matematik", 75) })
        {
            db.ExamResults.Add(new ExamResult { TenantId = Tenant, ExamTitle = $"Yazılı {++day}", Subject = subject, DateLabel = DateTime.UtcNow.AddDays(-40 + day * 7).ToString("dd.MM.yyyy"), StudentName = "Ali YILMAZ", ClassName = "10-A", Score = score });
            db.ExamResults.Add(new ExamResult { TenantId = Tenant, ExamTitle = $"Yazılı {day}", Subject = subject, DateLabel = DateTime.UtcNow.AddDays(-40 + day * 7).ToString("dd.MM.yyyy"), StudentName = "Ayşe Demir", ClassName = "10-A", Score = score - 5 });
        }
        await db.SaveChangesAsync();

        var pdf = await Service(null).GetStudentSuccessPdfAsync(Context(teacher, "Teacher", "Hasan"), ali.Id, CancellationToken.None);
        Assert.NotNull(pdf);
        var text = System.Text.Encoding.Latin1.GetString(pdf.Value.Content);
        Assert.Equal(6, System.Text.RegularExpressions.Regex.Matches(text, @"/Type\s*/Page\b").Count);
        if (Environment.GetEnvironmentVariable("SUCCESS_REPORT_OUT") is { Length: > 0 } output) await File.WriteAllBytesAsync(output, pdf.Value.Content);

        // Öğretmen ders vermediği sınıftaki öğrencinin raporunu alamaz; öğrenci başkasınınkini alamaz; muhasebe hiç alamaz.
        Assert.Null(await Service(null).GetStudentSuccessPdfAsync(Context(teacher, "Teacher", "Hasan"), other.Id, CancellationToken.None));
        Assert.Null(await Service(null).GetStudentSuccessPdfAsync(Context(aliUser.Id, "Student", "Ali"), other.Id, CancellationToken.None));
        Assert.NotNull(await Service(null).GetStudentSuccessPdfAsync(Context(aliUser.Id, "Student", "Ali"), aliUser.Id, CancellationToken.None));
        Assert.Null(await Service(null).GetStudentSuccessPdfAsync(Context(Guid.NewGuid(), "Accounting", "Selim"), ali.Id, CancellationToken.None));
    }

    [Fact]
    public async Task ReportPdf_IsOnlyAvailableToItsOwner()
    {
        var admin = Guid.NewGuid();
        var (_, ali) = await StudentAsync("Ali Yılmaz", "10-A");
        await AbsentAsync(ali, 4);
        var response = await Service(new ScriptedModel(Call("attendance_ranking"), Say("")))
            .SendAsync(Context(admin, "Admin", "Yönetici"), Ask("en çok devamsızlık yapanlar"), CancellationToken.None);

        var pdf = await Service(null).GetReportPdfAsync(Context(admin, "Admin", "Yönetici"), response.MessageId, CancellationToken.None);
        Assert.NotNull(pdf);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(pdf.Value.Content, 0, 4));
        Assert.Null(await Service(null).GetReportPdfAsync(Context(Guid.NewGuid(), "Admin", "Başka"), response.MessageId, CancellationToken.None));
    }

    [Fact]
    public async Task ReportExcel_HasNumericTable_AndIsOnlyAvailableToItsOwner()
    {
        var admin = Guid.NewGuid();
        var (_, ali) = await StudentAsync("Ali Yılmaz", "10-A");
        await AbsentAsync(ali, 4);
        var response = await Service(new ScriptedModel(Call("attendance_ranking"), Say("")))
            .SendAsync(Context(admin, "Admin", "Yönetici"), Ask("en çok devamsızlık yapanlar"), CancellationToken.None);

        var xlsx = await Service(null).GetReportExcelAsync(Context(admin, "Admin", "Yönetici"), response.MessageId, CancellationToken.None);
        Assert.NotNull(xlsx);
        Assert.EndsWith(".xlsx", xlsx.Value.FileName);
        using var workbook = new ClosedXML.Excel.XLWorkbook(new MemoryStream(xlsx.Value.Content));
        var sheet = workbook.Worksheet("Rapor");
        Assert.False(string.IsNullOrWhiteSpace(sheet.Cell(4, 1).GetString()));
        Assert.Contains(sheet.Row(5).CellsUsed(), cell => cell.DataType == ClosedXML.Excel.XLDataType.Number);
        Assert.NotNull(workbook.Worksheet("Özet"));
        Assert.Null(await Service(null).GetReportExcelAsync(Context(Guid.NewGuid(), "Admin", "Başka"), response.MessageId, CancellationToken.None));
    }

    [Fact]
    public async Task Homework_IsOrderedByRealDeadline_NotByText()
    {
        var (aliUser, _) = await StudentAsync("Ali Yılmaz", "10-A");
        var today = DateTime.UtcNow.AddHours(3).Date;
        db.HomeworkAssignments.Add(new HomeworkAssignment { TenantId = Tenant, Title = "Uzak", ClassName = "10-A", Subject = "Fizik", DeadlineLabel = today.AddDays(20).ToString("yyyy-MM-dd") });
        db.HomeworkAssignments.Add(new HomeworkAssignment { TenantId = Tenant, Title = "Yakın", ClassName = "10-A", Subject = "Matematik", DeadlineLabel = today.AddDays(2).ToString("dd.MM.yyyy") });
        await db.SaveChangesAsync();

        var response = await Service(null).SendAsync(Context(aliUser.Id, "Student", "Ali Yılmaz"), Ask("bekleyen ödevlerim"), CancellationToken.None);
        Assert.Contains("Yakın", response.Text);
    }

    [Fact]
    public async Task Parent_AskingForClassComparison_GetsTheOtherPanelAnswer()
    {
        var parent = new AppUser { FullName = "Veli Ayşe", Username = "veli.agent", PasswordHash = "x", PrimaryRole = UserRole.Parent };
        db.Users.Add(parent);
        await db.SaveChangesAsync();
        await StudentAsync("Can Arslan", "9-B", parent.Id);

        var model = new ScriptedModel(Call("out_of_scope"));
        var response = await Service(model).SendAsync(Context(parent.Id, "Parent", "Veli Ayşe"), Ask("sınıfların ortalamasını kıyasla"), CancellationToken.None);
        Assert.DoesNotContain("compare_classes", model.OfferedTools[0]);
        Assert.Equal("permission_denied", response.Type);
        // Sistem istemi velinin yalnız kendi çocuklarını tanıtır.
        Assert.Contains("Velinin çocukları: Can", model.Conversations[0][0].Content);
    }
}
