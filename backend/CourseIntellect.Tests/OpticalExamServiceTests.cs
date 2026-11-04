using System.Security.Claims;
using System.Text;
using CourseIntellect.Application.DTOs.OpticalExams;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace CourseIntellect.Tests;

/// <summary>
/// Sentetik optik dosyası (Türkçe Windows 1254 kodlu, ğ/ş/İ içerir). Satır düzeni:
/// 1-6 öğrenci no, 7-26 ad soyad (20), 27-30 sınıf, 31 kitapçık, 32-36 Türkçe (5), 37-41 Matematik (5).
/// </summary>
public sealed class OpticalExamServiceTests : IDisposable
{
    private readonly SqliteConnection connection = new("DataSource=:memory:");
    private readonly CourseIntellectDbContext db;
    private static readonly Guid Tenant = Guid.NewGuid();

    public OpticalExamServiceTests()
    {
        connection.Open();
        db = NewContext(null);
        db.Database.EnsureCreated();
        db.TenantWorkspaces.Add(new TenantWorkspace { Id = Tenant, Name = "Test Okulu", Slug = $"t-{Guid.NewGuid():N}"[..20], ContactEmail = "a@b.co", Plan = "free", Status = "active" });
        db.SaveChanges();
        db.SetTenantOverride(Tenant);
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
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

    private OpticalExamService Service(CourseIntellectDbContext? context = null) => new(context ?? db);

    private static SaveOpticalTemplateRequest Template(int nameLength = 20) => new(
        "Okul optik formu", "windows-1254",
        StudentNoStart: 1, StudentNoLength: 6,
        NameStart: 7, NameLength: nameLength,
        ClassStart: 27, ClassLength: 4,
        BookletStart: 31, BookletLength: 1,
        Subjects: [new("Türkçe", 32, 5), new("Matematik", 37, 5)]);

    private static SaveOpticalExamRequest Exam(Guid templateId, int penalty = 4, string cancelled = "exclude", bool multiWrong = true) => new(
        "1. TYT Denemesi", new DateTime(2026, 10, 20), templateId, penalty, multiWrong, cancelled,
        [
            new("A",
            [
                new("Türkçe", "ABCDE", ["Paragraf", "Paragraf", "Sözcükte Anlam", "Yazım Kuralları", "Yazım Kuralları"]),
                new("Matematik", "ABCDX", ["Üslü Sayılar", "Üslü Sayılar", "Köklü Sayılar", "Köklü Sayılar", "Olasılık"]),
            ]),
            new("B",
            [
                new("Türkçe", "EDCBA", ["Yazım Kuralları", "Yazım Kuralları", "Sözcükte Anlam", "Paragraf", "Paragraf"]),
                new("Matematik", "XDCBA", ["Olasılık", "Köklü Sayılar", "Köklü Sayılar", "Üslü Sayılar", "Üslü Sayılar"]),
            ]),
        ]);

    private async Task<AppUser> StudentAsync(string name, string className, string schoolNo, Guid? branchId = null)
    {
        var user = new AppUser { FullName = name, Username = $"s-{Guid.NewGuid():N}"[..18], PasswordHash = "x", PrimaryRole = UserRole.Student, BranchId = branchId };
        db.Users.Add(user);
        db.Students.Add(new StudentProfile { UserId = user.Id, FullName = user.FullName, ClassName = className, SchoolNumber = schoolNo, BranchId = branchId });
        await db.SaveChangesAsync();
        return user;
    }

    private static string Line(string no, string name, string cls, string booklet, string turkish, string math) =>
        no.PadRight(6) + name.PadRight(20)[..20] + cls.PadRight(4) + booklet + turkish.PadRight(5) + math.PadRight(5);

    private static byte[] File1254(params string[] lines) => Encoding.GetEncoding(1254).GetBytes(string.Join("\r\n", lines) + "\r\n");

    private async Task<(Guid ExamId, AppUser Ayse, AppUser Ismail, AppUser Gul)> SetupAsync(int penalty = 4, string cancelled = "exclude")
    {
        var ayse = await StudentAsync("Ayşe Doğan", "10-A", "000123");
        var ismail = await StudentAsync("İsmail Şahin", "10-A", "456");
        var gul = await StudentAsync("Gülşen Karaağaçlıoğlu", "10-B", "");
        var template = await Service().SaveTemplateAsync(null, Template());
        var exam = await Service().SaveExamAsync(null, Exam(template.Id, penalty, cancelled));
        return (exam.Id, ayse, ismail, gul);
    }

    [Fact]
    public void Decode_Detects1254_AndKeepsColumns()
    {
        var bytes = File1254(Line("123", "AYŞE DOĞAN", "10-A", "A", "ABCDE", "ABCDA"));
        var (text, encoding) = OpticalParser.Decode(bytes, "auto");

        Assert.Equal(OpticalParser.Windows1254, encoding);
        Assert.Equal("AYŞE DOĞAN", OpticalParser.Slice(OpticalParser.Lines(text)[0].Text, 7, 20).Trim());
        // UTF-8 dosyası da otomatik tanınır.
        Assert.Equal(OpticalParser.Utf8, OpticalParser.Decode(Encoding.UTF8.GetBytes("İSMAİL ŞAHİN"), "auto").Encoding);
    }

    [Fact]
    public async Task Preview_ScoresBooklets_BlankMultiMarkAndCancelled_AndMatchesStudents()
    {
        var (examId, ayse, ismail, _) = await SetupAsync();
        var file = File1254(
            Line("123", "AYŞE DOĞAN", "10-A", "A", "ABCDE", "AB DA"),      // okul no (baştaki sıfırsız) ile eşleşir
            Line("", "İSMAİL ŞAHİN", "10-A", "B", "EDC*A", "XDCBB"),        // ad ile; çoklu işaret yanlış
            Line("999", "KİMSE YOK", "10-A", "A", "AAAAA", "AAAAA"));       // eşleşmez

        var preview = await Service().PreviewAsync(examId, file, null);

        Assert.Equal(OpticalParser.Windows1254, preview.Encoding);
        Assert.Equal(2, preview.MatchedCount);
        Assert.Equal(1, preview.UnmatchedCount);

        var first = preview.Rows[0];
        Assert.Equal(ayse.Id, first.StudentUserId);
        Assert.Equal("Okul no", first.MatchedBy);
        Assert.Equal(new OpticalSubjectScoreDto("Türkçe", 5, 0, 0, 5m), first.Scores[0]);
        // Matematik: 5. soru iptal (dışarıda), 3. boş → 3 doğru, 0 yanlış, 1 boş.
        Assert.Equal(new OpticalSubjectScoreDto("Matematik", 3, 0, 1, 3m), first.Scores[1]);

        var second = preview.Rows[1];
        Assert.Equal(ismail.Id, second.StudentUserId);
        Assert.Equal("B", second.Booklet);
        // Türkçe B: EDC*A → 4 doğru, 1 çoklu işaret = yanlış; 4 yanlış 1 doğru götürür.
        Assert.Equal(new OpticalSubjectScoreDto("Türkçe", 4, 1, 0, 3.75m), second.Scores[0]);
        // Matematik B: 1. soru iptal; DCB doğru, son B yanlış (anahtar A).
        Assert.Equal(new OpticalSubjectScoreDto("Matematik", 3, 1, 0, 2.75m), second.Scores[1]);

        // Önizleme hiçbir şey yazmaz.
        Assert.Equal(0, await db.OpticalExamAnswers.CountAsync());
        Assert.Equal(0, await db.ExamResults.CountAsync());
    }

    [Fact]
    public async Task Preview_TruncatedName_IsAmbiguous_NotAutoMatched()
    {
        var (examId, _, _, gul) = await SetupAsync();
        // 20 karakterlik alana sığmayan ad optikte kesilir.
        var preview = await Service().PreviewAsync(examId, File1254(Line("", "GÜLŞEN KARAAĞAÇLIOĞL", "10-B", "A", "ABCDE", "ABCDA")), null);

        var row = Assert.Single(preview.Rows);
        Assert.Equal("ambiguous", row.MatchStatus);
        Assert.Null(row.StudentUserId);
        Assert.Equal(gul.Id, Assert.Single(row.Candidates).StudentUserId);
    }

    [Fact]
    public async Task Import_WritesAnswersAndExamResults_ReimportReplaces_AndOverridesApply()
    {
        var (examId, ayse, _, gul) = await SetupAsync();
        var file = File1254(
            Line("123", "AYŞE DOĞAN", "10-A", "A", "ABCDE", "AB DA"),
            Line("", "GÜLŞEN KARAAĞAÇLIOĞL", "10-B", "A", "AAAAA", "ABCDA"),
            Line("999", "KİMSE YOK", "10-A", "A", "AAAAA", "AAAAA"));

        var result = await Service().ImportAsync(examId, file, null, "deneme1.txt", [new OpticalMatchOverrideDto(2, gul.Id)], null);

        Assert.Equal(2, result.ImportedStudents);
        Assert.Equal(1, result.SkippedRows);
        Assert.Equal(4, await db.ExamResults.CountAsync(item => item.Type == ExamType.MockExam));
        Assert.Equal(18, await db.OpticalExamAnswers.CountAsync()); // 2 öğrenci × (5 + 4 iptal hariç)
        var ayseMath = await db.ExamResults.SingleAsync(item => item.StudentName == ayse.FullName && item.Subject == "Matematik");
        Assert.Equal(3m, ayseMath.Net);

        // Aynı denemeyi yeniden aktarmak çoğaltmaz, yerine geçer.
        await Service().ImportAsync(examId, file, null, "deneme1.txt", [], null);
        Assert.Equal(2, await db.ExamResults.CountAsync(item => item.Type == ExamType.MockExam));
        Assert.Equal(1, (await db.OpticalExams.SingleAsync()).ImportedStudentCount);

        var results = (await Service().GetResultsAsync(examId))!;
        Assert.Equal(ayse.Id, Assert.Single(results.Rows).StudentUserId);
        Assert.Equal(8m, results.Rows[0].TotalNet);

        // Silinince ExamResult kayıtları da gider.
        await Service().DeleteExamAsync(examId);
        Assert.Equal(0, await db.ExamResults.CountAsync());
        Assert.Equal(0, await db.OpticalExamAnswers.CountAsync());
    }

    [Fact]
    public async Task Import_RejectsSameStudentOnTwoLines()
    {
        var (examId, ayse, _, _) = await SetupAsync();
        var file = File1254(
            Line("123", "AYŞE DOĞAN", "10-A", "A", "ABCDE", "ABCDA"),
            Line("", "BAŞKASI", "10-A", "A", "ABCDE", "ABCDA"));

        var error = await Assert.ThrowsAsync<ArgumentException>(() =>
            Service().ImportAsync(examId, file, null, "x.txt", [new OpticalMatchOverrideDto(2, ayse.Id)], null));
        Assert.Contains("birden fazla satıra", error.Message);
    }

    [Fact]
    public async Task Insights_UseOpticalAnswersWithTopics()
    {
        var (examId, ayse, _, _) = await SetupAsync();
        await Service().ImportAsync(examId, File1254(Line("123", "AYŞE DOĞAN", "10-A", "A", "ABCDE", "BAAAA")), null, "x.txt", [], null);

        var insight = (await new StudentInsightService(db, new NoopGenerator(),
            new NoOpBackgroundJobClient(NullLogger<NoOpBackgroundJobClient>.Instance),
            NullLogger<StudentInsightService>.Instance).GetStudentAsync(ayse.Id))!;

        var uslu = insight.Topics.Single(item => item.Topic == "Üslü Sayılar");
        Assert.Equal(2, uslu.Solved);
        Assert.Equal(0, uslu.Correct);
        Assert.DoesNotContain(insight.Topics, item => item.Topic == "Olasılık"); // iptal edilen soru
        Assert.Equal(9, insight.Solved); // 5 Türkçe + 4 Matematik (iptal hariç)
    }

    private sealed class NoopGenerator : CourseIntellect.Application.Interfaces.IInsightTextGenerator
    {
        public bool IsEnabled => false;
        public string Model => string.Empty;
        public Task<string?> GenerateJsonAsync(string systemPrompt, IReadOnlyList<(string Role, string Content)> messages, object jsonSchema, CancellationToken cancellationToken)
            => Task.FromResult<string?>(null);
    }

    [Theory]
    [InlineData(30, "çakışıyor")]
    public async Task Template_RejectsOverlappingColumns(int nameLength, string message)
    {
        var error = await Assert.ThrowsAsync<ArgumentException>(() => Service().SaveTemplateAsync(null, Template(nameLength)));
        Assert.Contains(message, error.Message);
        // Hangi iki alanın ve hangi karakterlerin çakıştığı yazılır.
        Assert.Contains("iki alana birden ayrılmış", error.Message);
        Assert.Matches(@"\(\d+–\d+\. karakterler\) ile .+ \(\d+", error.Message);
    }

    [Fact]
    public async Task Exam_ValidatesKeyLengthAndTopics()
    {
        var template = await Service().SaveTemplateAsync(null, Template());
        var badLength = Exam(template.Id) with { Keys = [new("A", [new("Türkçe", "ABC", []), new("Matematik", "ABCDE", [])])] };
        Assert.Contains("3 soru", (await Assert.ThrowsAsync<ArgumentException>(() => Service().SaveExamAsync(null, badLength))).Message);

        var badTopics = Exam(template.Id) with { Keys = [new("A", [new("Türkçe", "ABCDE", ["Paragraf"]), new("Matematik", "ABCDE", [])])] };
        Assert.Contains("konu listesi", (await Assert.ThrowsAsync<ArgumentException>(() => Service().SaveExamAsync(null, badTopics))).Message);
    }

    [Fact]
    public async Task BranchManager_CannotMatchOtherBranchStudents()
    {
        var branchA = Guid.NewGuid();
        var branchB = Guid.NewGuid();
        await StudentAsync("Ayşe Doğan", "10-A", "123", branchA);
        await StudentAsync("Veli Can", "10-A", "777", branchB);
        var template = await Service().SaveTemplateAsync(null, Template());

        using var manager = NewContext(new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(ClaimTypes.Role, "Admin"),
            new Claim(ClaimTypes.Role, "BranchManager"),
            new Claim("branch_id", branchA.ToString()),
        ], "test")));
        manager.SetTenantOverride(Tenant);
        var exam = await Service(manager).SaveExamAsync(null, Exam(template.Id));
        var preview = await Service(manager).PreviewAsync(exam.Id, File1254(
            Line("123", "AYŞE DOĞAN", "10-A", "A", "ABCDE", "ABCDA"),
            Line("777", "VELİ CAN", "10-A", "A", "ABCDE", "ABCDA")), null);

        Assert.Equal(1, preview.MatchedCount);
        Assert.Equal("unmatched", preview.Rows[1].MatchStatus);
    }
}
