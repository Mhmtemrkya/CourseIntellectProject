using System.Text.RegularExpressions;
using CourseIntellect.Application.DTOs.OpticalExams;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

/// <summary>Optik deneme soru konusu listesi: hazır katalog, kurumun eklediği konular ve deneme seviyesi.</summary>
public sealed class OpticalTopicCatalogTests : IDisposable
{
    private readonly SqliteConnection connection = new("DataSource=:memory:");
    private readonly CourseIntellectDbContext db;
    private static readonly Guid Tenant = Guid.NewGuid();
    private static readonly Guid OtherTenant = Guid.NewGuid();

    public OpticalTopicCatalogTests()
    {
        connection.Open();
        db = NewContext();
        db.Database.EnsureCreated();
        foreach (var id in new[] { Tenant, OtherTenant })
            db.TenantWorkspaces.Add(new TenantWorkspace { Id = id, Name = "Okul", Slug = $"t-{Guid.NewGuid():N}"[..20], ContactEmail = "a@b.co", Plan = "free", Status = "active" });
        db.SaveChanges();
        db.SetTenantOverride(Tenant);
    }

    public void Dispose()
    {
        db.Dispose();
        connection.Dispose();
    }

    private CourseIntellectDbContext NewContext() =>
        new(new DbContextOptionsBuilder<CourseIntellectDbContext>().UseSqlite(connection).Options, null);

    private OpticalExamService Service(CourseIntellectDbContext? context = null) => new(context ?? db);

    private async Task<Guid> TemplateAsync() => (await Service().SaveTemplateAsync(null, new SaveOpticalTemplateRequest(
        "LGS formu", "windows-1254", 1, 6, 7, 20, 27, 4, 31, 1, [new("Matematik", 32, 3)]))).Id;

    private static SaveOpticalExamRequest Exam(Guid templateId, string? level, params string[] topics) => new(
        "1. LGS Denemesi", new DateTime(2026, 11, 2), templateId, 3, true, "exclude",
        [new("A", [new("Matematik", "ABC", topics)])], level);

    // ── Katalog ──────────────────────────────────────────────────────────────

    [Fact]
    public void Fold_IgnoresTurkishLettersCaseAndSpacing()
    {
        Assert.Equal(OpticalTopicCatalog.Fold("Üslü İfadeler"), OpticalTopicCatalog.Fold("  uslu   ifadeler "));
        Assert.Equal(OpticalTopicCatalog.Fold("IŞIK"), OpticalTopicCatalog.Fold("isik"));
        Assert.Equal(OpticalTopicCatalog.Fold("Kâr-Zarar"), OpticalTopicCatalog.Fold("kar-zarar"));
    }

    [Fact]
    public void Catalog_CoversExamSubjects_WithCleanTopics()
    {
        string[] required =
        [
            "5|Türkçe", "5|Matematik", "5|Fen Bilimleri", "5|Sosyal Bilgiler",
            "6|Türkçe", "6|Matematik", "6|Fen Bilimleri", "6|Sosyal Bilgiler",
            "7|Türkçe", "7|Matematik", "7|Fen Bilimleri", "7|Sosyal Bilgiler",
            "LGS|Türkçe", "LGS|Matematik", "LGS|Fen Bilimleri", "LGS|T.C. İnkılap Tarihi ve Atatürkçülük", "LGS|Din Kültürü ve Ahlak Bilgisi", "LGS|Yabancı Dil (İngilizce)",
            "TYT|Türkçe", "TYT|Temel Matematik", "TYT|Fen Bilimleri", "TYT|Sosyal Bilimler",
            "AYT|Matematik", "AYT|Fizik", "AYT|Kimya", "AYT|Biyoloji", "AYT|Türk Dili ve Edebiyatı",
            "AYT|Tarih-1", "AYT|Coğrafya-1", "AYT|Tarih-2", "AYT|Coğrafya-2", "AYT|Felsefe Grubu",
            "YDT|Yabancı Dil (YDT)",
        ];
        foreach (var item in required)
        {
            var parts = item.Split('|');
            var topics = OpticalTopicCatalog.For(parts[0], parts[1]).SelectMany(unit => unit.Topics).ToList();
            Assert.True(topics.Count >= 6, $"{item}: yalnız {topics.Count} konu");
        }

        foreach (var (level, subject) in OpticalTopicCatalog.Keys)
        {
            var units = OpticalTopicCatalog.For(level, subject);
            Assert.All(units, unit => Assert.False(string.IsNullOrWhiteSpace(unit.Label)));
            var topics = units.SelectMany(unit => unit.Topics).ToList();
            Assert.All(topics, topic => Assert.InRange(topic.Length, 2, 150));
            Assert.All(topics, topic => Assert.Equal(topic.Trim(), topic));
            Assert.Equal(topics.Count, topics.Select(OpticalTopicCatalog.Fold).Distinct().Count());
        }

        // Birleşik alt testler ders başlıklarıyla gelir.
        Assert.Equal(["Fizik", "Kimya", "Biyoloji"], OpticalTopicCatalog.For("TYT", "Fen Bilimleri").Select(unit => unit.Label));
        Assert.Contains("Psikoloji", OpticalTopicCatalog.For("AYT", "Felsefe Grubu").Select(unit => unit.Label));
        // TYT Temel Matematik geometri sorularını da kapsar.
        Assert.Contains("Üçgende Açıortay", OpticalTopicCatalog.For("TYT", "Temel Matematik").SelectMany(unit => unit.Topics));
    }

    [Fact]
    public void Catalog_SubjectsMatchOpticalSubjectList()
    {
        // Katalog anahtarı, şablonda listeden seçilen ders adıyla birebir aynı olmalı; aksi hâlde liste boş görünür.
        var path = FindRepoFile("desktop/src/lib/subjectCatalog.ts");
        if (path is null) return;
        var listed = Regex.Matches(File.ReadAllText(path), "'([^']+)'").Select(match => match.Groups[1].Value).ToHashSet();
        foreach (var (_, subject) in OpticalTopicCatalog.Keys)
            Assert.True(listed.Contains(subject), $"Katalogdaki ders şablon ders listesinde yok: {subject}");
    }

    [Fact]
    public void Catalog_WithoutLevel_ListsEveryLevelOnce()
    {
        var units = OpticalTopicCatalog.For(null, "Matematik");
        Assert.Contains(units, unit => unit.Label.StartsWith("5. sınıf · ", StringComparison.Ordinal));
        Assert.Contains(units, unit => unit.Label.StartsWith("8. sınıf (LGS) · ", StringComparison.Ordinal));
        Assert.Contains(units, unit => unit.Label.StartsWith("AYT · ", StringComparison.Ordinal));
        var topics = units.SelectMany(unit => unit.Topics).ToList();
        Assert.Equal(topics.Count, topics.Select(OpticalTopicCatalog.Fold).Distinct().Count());
        Assert.Empty(OpticalTopicCatalog.For("LGS", "Müzik"));
    }

    // ── Kurum konuları ───────────────────────────────────────────────────────

    [Fact]
    public async Task AddTopic_CreatesOnce_AndReturnsExistingSpelling()
    {
        var created = await Service().AddTopicAsync(new AddOpticalTopicRequest("Matematik", "LGS", "  Sayı\tÖrüntüleri  "), null);
        Assert.Equal("created", created.Status);
        Assert.Equal("Sayı Örüntüleri", created.Name);

        var again = await Service().AddTopicAsync(new AddOpticalTopicRequest("Matematik", "LGS", "SAYI ORUNTULERI"), null);
        Assert.Equal("exists-custom", again.Status);
        Assert.Equal("Sayı Örüntüleri", again.Name);

        var builtin = await Service().AddTopicAsync(new AddOpticalTopicRequest("Matematik", "LGS", "uslu ifadeler"), null);
        Assert.Equal("exists-builtin", builtin.Status);
        Assert.Equal("Üslü İfadeler", builtin.Name);
        Assert.Equal(1, await db.OpticalCustomTopics.CountAsync());
    }

    [Fact]
    public async Task AddTopic_ValidatesInput()
    {
        await Assert.ThrowsAsync<ArgumentException>(() => Service().AddTopicAsync(new AddOpticalTopicRequest("Matematik", "LGS", "   "), null));
        await Assert.ThrowsAsync<ArgumentException>(() => Service().AddTopicAsync(new AddOpticalTopicRequest("Matematik", "LGS", new string('a', 151)), null));
        await Assert.ThrowsAsync<ArgumentException>(() => Service().AddTopicAsync(new AddOpticalTopicRequest("Matematik", "KPSS", "Konu"), null));
        await Assert.ThrowsAsync<ArgumentException>(() => Service().AddTopicAsync(new AddOpticalTopicRequest("", "LGS", "Konu"), null));
    }

    [Fact]
    public async Task Topics_IncludeCustomAndLegacy_AndStayInTenant()
    {
        var templateId = await TemplateAsync();
        // Eski deneme: serbest yazılmış konu ("Sayı Bulmacaları") ve listedeki bir konu farklı yazımla.
        await Service().SaveExamAsync(null, Exam(templateId, null, "Sayı Bulmacaları", "uslu ifadeler", ""));
        await Service().AddTopicAsync(new AddOpticalTopicRequest("Matematik", "LGS", "Sayı Örüntüleri"), null);
        await Service().AddTopicAsync(new AddOpticalTopicRequest("Matematik", "TYT", "Sayısal Mantık"), null);
        await Service().AddTopicAsync(new AddOpticalTopicRequest("Matematik", "", "Genel Tekrar"), null);

        var catalog = await Service().GetTopicsAsync("LGS", ["Matematik", "Müzik"]);
        var math = catalog.Subjects.Single(item => item.Subject == "Matematik");
        Assert.Equal("LGS", catalog.Level);
        Assert.Contains(math.Groups, group => group.Topics.Contains("Üslü İfadeler"));
        Assert.Equal(["Genel Tekrar", "Sayı Örüntüleri"], math.Custom.Select(item => item.Name).OrderBy(item => item));
        Assert.Equal(["Sayı Bulmacaları"], math.Used);
        var music = catalog.Subjects.Single(item => item.Subject == "Müzik");
        Assert.Empty(music.Groups);

        using var other = NewContext();
        other.SetTenantOverride(OtherTenant);
        var foreign = (await Service(other).GetTopicsAsync("LGS", ["Matematik"])).Subjects.Single();
        Assert.Empty(foreign.Custom);
        Assert.Empty(foreign.Used);
        Assert.Equal("created", (await Service(other).AddTopicAsync(new AddOpticalTopicRequest("Matematik", "LGS", "Sayı Örüntüleri"), null)).Status);
    }

    [Fact]
    public async Task SharedService_IncludesQuestionBankTopics()
    {
        // Soru stüdyosu ortak servisi kullanır; soru bankasında yazılmış konular da "daha önce yazılmış" olarak gelir.
        db.QuestionBankItems.Add(new QuestionBankItem { Subject = "Matematik", Topic = "Sayı Bulmacaları", QuestionText = "x", Teacher = "t" });
        db.QuestionBankItems.Add(new QuestionBankItem { Subject = "Matematik", Topic = "üslü ifadeler", QuestionText = "y", Teacher = "t" });
        await db.SaveChangesAsync();

        var math = (await new TopicCatalogService(db).GetTopicsAsync("LGS", ["Matematik"])).Subjects.Single();
        Assert.Equal(["Sayı Bulmacaları"], math.Used);
    }

    [Fact]
    public async Task DeleteTopic_LeavesExamsUntouched()
    {
        var templateId = await TemplateAsync();
        var added = await Service().AddTopicAsync(new AddOpticalTopicRequest("Matematik", "LGS", "Sayı Örüntüleri"), null);
        var exam = await Service().SaveExamAsync(null, Exam(templateId, "LGS", "Sayı Örüntüleri", "", ""));

        await Service().DeleteTopicAsync(added.Topic!.Id);

        Assert.Equal(0, await db.OpticalCustomTopics.CountAsync());
        Assert.Equal("Sayı Örüntüleri", (await Service().GetExamAsync(exam.Id))!.Keys[0].Subjects[0].Topics[0]);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => Service().DeleteTopicAsync(added.Topic.Id));
    }

    // ── Deneme seviyesi ──────────────────────────────────────────────────────

    [Fact]
    public async Task ExamLevel_RoundTrips_OldClientKeepsIt_InvalidRejected()
    {
        var templateId = await TemplateAsync();
        var exam = await Service().SaveExamAsync(null, Exam(templateId, "LGS"));
        Assert.Equal("LGS", exam.Level);
        Assert.Equal("LGS", (await Service().ListExamsAsync()).Single().Level);

        // Seviye göndermeyen (eski) istemci mevcut seviyeyi silmez.
        Assert.Equal("LGS", (await Service().SaveExamAsync(exam.Id, Exam(templateId, null))).Level);
        Assert.Equal("", (await Service().SaveExamAsync(exam.Id, Exam(templateId, ""))).Level);
        await Assert.ThrowsAsync<ArgumentException>(() => Service().SaveExamAsync(exam.Id, Exam(templateId, "KPSS")));

        var legacy = await Service().SaveExamAsync(null, Exam(templateId, null));
        Assert.Equal("", (await Service().GetExamAsync(legacy.Id))!.Level);
    }

    private static string? FindRepoFile(string relative)
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, relative);
            if (File.Exists(candidate)) return candidate;
        }
        return null;
    }
}
