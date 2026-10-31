using System.Text;
using CourseIntellect.Application.DTOs.Preference;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

/// <summary>Gömülü ÖSYM verisi gerçek dosyalardan yüklenir; testler bu resmî veriyle çalışır.</summary>
public sealed class PreferenceRobotServiceTests : IDisposable
{
    private readonly TestDb db = new();

    public void Dispose() => db.Dispose();

    private PreferenceRobotService Service => new(db.Context);

    private static PreferenceNetInput Nets(string exam = "YKS", decimal? turkish = null, decimal? social = null, decimal? math = null,
        decimal? science = null, decimal? aytMath = null, decimal? physics = null, decimal? chemistry = null, decimal? biology = null,
        decimal? literature = null, decimal? history1 = null, decimal? geography1 = null, decimal? religion = null,
        decimal? foreignLanguage = null, decimal? revolution = null, decimal? diploma = null)
        => new(exam, turkish, social, math, science, aytMath, physics, chemistry, biology, literature, history1, geography1,
            null, null, null, religion, foreignLanguage, revolution, diploma);

    [Fact]
    public async Task BuiltInData_LoadsOfficialOsymTables_ForBothYears()
    {
        var meta = await Service.GetMetaAsync();

        var yks2025 = Assert.Single(meta.Datasets, item => item.Exam == "YKS" && item.Year == 2025);
        Assert.Equal(21602, yks2025.Count);
        Assert.StartsWith("https://www.osym.gov.tr/", yks2025.SourceUrl);
        Assert.Contains(meta.Datasets, item => item.Exam == "YKS" && item.Year == 2024);
        Assert.False(meta.LgsAvailable);
        // Gerçek ÖSYM satırı: Abdullah Gül Üniversitesi Bilgisayar Mühendisliği (İngilizce), 2025 taban 442,53227.
        var program = await db.Context.PreferencePrograms.SingleAsync(item => item.Year == 2025 && item.Code == "106510077");
        Assert.Equal(442.53227m, program.MinScore);
        Assert.Equal("SAY", program.ScoreType);
        // İkinci çağrı veriyi çoğaltmaz.
        await Service.EnsureBuiltInDataAsync();
        Assert.Equal(21602, await db.Context.PreferencePrograms.CountAsync(item => item.Year == 2025));
    }

    [Fact]
    public async Task Search_BandsResultsAroundScore_WithPreviousYearTrend()
    {
        var result = await Service.SearchAsync(new PreferenceSearchRequest("YKS", "SAY", 445m, null, null, null, null, "bilgisayar mühendisliği", 1000));

        Assert.Equal(2025, result.Year);
        Assert.Equal(2024, result.PreviousYear);
        Assert.NotEmpty(result.Items);
        Assert.All(result.Items, item => Assert.Equal("SAY", item.ScoreType));
        var tr = System.Globalization.CultureInfo.GetCultureInfo("tr-TR");
        // Arama terimleri program, üniversite ve fakülte adında birlikte aranır.
        Assert.All(result.Items, item =>
        {
            var haystack = $"{item.ProgramName} {item.InstitutionName} {item.Unit}".ToLower(tr);
            Assert.Contains("bilgisayar", haystack);
            Assert.Contains("mühendisliği", haystack);
        });
        var agu = Assert.Single(result.Items, item => item.Code == "106510077");
        Assert.Equal("Target", agu.Band);
        Assert.Equal(2.47m, agu.Gap);
        Assert.NotNull(agu.PreviousMinScore);
        Assert.All(result.Items.Where(item => item.Band == "Reach"), item => Assert.True(item.Gap < -10 && item.Gap >= -25));
        Assert.All(result.Items.Where(item => item.Band == "Safe"), item => Assert.True(item.Gap >= 15));
    }

    [Fact]
    public async Task BuiltInData_EveryYksProgramHasCityAndDepartment()
    {
        await Service.EnsureBuiltInDataAsync();

        Assert.False(await db.Context.PreferencePrograms.AnyAsync(item => item.Exam == "YKS" && (item.City == "" || item.Department == "")));
        // Adında il geçmeyen istisna ve parantezle yazılan il.
        Assert.Equal("KOCAELİ", (await db.Context.PreferencePrograms.FirstAsync(item => item.InstitutionName == "GEBZE TEKNİK ÜNİVERSİTESİ")).City);
        Assert.Equal("ADIYAMAN", (await db.Context.PreferencePrograms.FirstAsync(item => item.InstitutionName == "ADIYAMAN ÜNİVERSİTESİ")).City);
        var agu = await db.Context.PreferencePrograms.SingleAsync(item => item.Year == 2025 && item.Code == "106510077");
        Assert.Equal("Bilgisayar Mühendisliği", agu.Department);
    }

    [Fact]
    public async Task BuiltInData_OlderVersion_IsReplaced_ChoicesSurvive()
    {
        var student = Guid.NewGuid();
        await Service.EnsureBuiltInDataAsync();
        await Service.SaveChoicesAsync(student, new SavePreferenceChoicesRequest("YKS", [new("106510077", null)]));
        // Eski sürüm verisini taklit et: il ve bölüm boş, sürüm 1.
        await db.Context.PreferencePrograms.Where(item => item.Exam == "YKS" && item.Year == 2025)
            .ExecuteUpdateAsync(set => set.SetProperty(item => item.DataVersion, 1).SetProperty(item => item.City, "").SetProperty(item => item.Department, ""));
        db.Context.ChangeTracker.Clear();

        await Service.EnsureBuiltInDataAsync();

        Assert.Equal(21602, await db.Context.PreferencePrograms.CountAsync(item => item.Exam == "YKS" && item.Year == 2025));
        Assert.False(await db.Context.PreferencePrograms.AnyAsync(item => item.Year == 2025 && (item.DataVersion != PreferenceRobotService.BuiltInDataVersion || item.City == "")));
        var choice = Assert.Single(await Service.GetChoicesAsync(student, "YKS"));
        Assert.Equal(442.53227m, choice.Program!.MinScore);
    }

    [Fact]
    public async Task Options_CascadeCityUniversityDepartment()
    {
        var all = await Service.GetOptionsAsync(new PreferenceOptionsRequest("YKS", "SAY", null, null, null, null));
        Assert.Equal(2025, all.Year);
        Assert.Contains(all.Cities, item => item.Name == "KAYSERİ");

        var kayseri = await Service.GetOptionsAsync(new PreferenceOptionsRequest("YKS", "SAY", null, null, "KAYSERİ", null));
        Assert.All(kayseri.Universities, item => Assert.Equal("KAYSERİ", item.City));
        Assert.Contains(kayseri.Universities, item => item.Name == "ABDULLAH GÜL ÜNİVERSİTESİ (KAYSERİ)");
        Assert.DoesNotContain(kayseri.Universities, item => item.Name.StartsWith("ANKARA", StringComparison.Ordinal));

        var agu = await Service.GetOptionsAsync(new PreferenceOptionsRequest("YKS", "SAY", null, null, "KAYSERİ", "ABDULLAH GÜL ÜNİVERSİTESİ (KAYSERİ)"));
        Assert.Contains(agu.Departments, item => item.Name == "Bilgisayar Mühendisliği");
        // Yalnız o üniversitede ve o puan türünde gerçekten var olan bölümler.
        var aguPrograms = await db.Context.PreferencePrograms
            .Where(item => item.Year == 2025 && item.InstitutionName == "ABDULLAH GÜL ÜNİVERSİTESİ (KAYSERİ)" && item.ScoreType == "SAY")
            .Select(item => item.Department).Distinct().ToListAsync();
        Assert.Equal(aguPrograms.Count, agu.Departments.Count);
        Assert.All(agu.Departments, item => Assert.Contains(item.Name, aguPrograms));
    }

    [Fact]
    public async Task Search_FocusedOnUniversity_ListsAllPrograms_IncludingFar()
    {
        var result = await Service.SearchAsync(new PreferenceSearchRequest("YKS", "SAY", 300m, null, null, null, null, null, 1000,
            University: "ABDULLAH GÜL ÜNİVERSİTESİ (KAYSERİ)"));

        Assert.True(result.Focused);
        Assert.All(result.Items, item => Assert.Equal("ABDULLAH GÜL ÜNİVERSİTESİ (KAYSERİ)", item.InstitutionName));
        var agu = Assert.Single(result.Items, item => item.Code == "106510077");
        Assert.Equal("Far", agu.Band);
        Assert.True(result.FarCount > 0);

        var department = await Service.SearchAsync(new PreferenceSearchRequest("YKS", "SAY", 445m, null, null, null, null, null, 1000,
            Department: "Bilgisayar Mühendisliği"));
        Assert.All(department.Items, item => Assert.StartsWith("Bilgisayar Mühendisliği", item.ProgramName));
        Assert.Contains(department.Items, item => item.ProgramName.Contains("(İngilizce)"));
    }

    [Fact]
    public async Task Search_Lgs_WithoutData_SaysSoInsteadOfInventing()
    {
        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            Service.SearchAsync(new PreferenceSearchRequest("LGS", "LGS", 450m, null, null, null, null, null, null)));
        Assert.Contains("yüklenmedi", error.Message);
    }

    [Fact]
    public async Task LgsImport_RequiresSource_AndReplacesYear()
    {
        var csv = "Kurum Kodu;Okul;İl;İlçe;Okul Türü;Kontenjan;Taban Puan;Yüzdelik Dilim\n" +
                  "123456;Örnek Fen Lisesi;Ankara;Çankaya;Fen Lisesi;150;480,5;0,5\n" +
                  "654321;Örnek Anadolu Lisesi;Ankara;Keçiören;Anadolu Lisesi;300;410,25;6,1\n" +
                  "999;Hatalı;Ankara;Merkez;Anadolu Lisesi;10;90;50\n";
        Stream Csv() => new MemoryStream(Encoding.UTF8.GetBytes(csv));

        await Assert.ThrowsAsync<ArgumentException>(() => Service.ImportLgsCsvAsync(2025, "", "http://x", Csv()));
        var first = await Service.ImportLgsCsvAsync(2025, "MEB e-Okul", "https://e-okul.meb.gov.tr", Csv());
        var second = await Service.ImportLgsCsvAsync(2025, "MEB e-Okul", "https://e-okul.meb.gov.tr", Csv());

        Assert.Equal(2, first.Imported);
        Assert.Equal(1, first.Skipped);
        Assert.Equal(2, second.Imported);
        Assert.Equal(2, await db.Context.PreferencePrograms.CountAsync(item => item.Exam == "LGS"));
        var result = await Service.SearchAsync(new PreferenceSearchRequest("LGS", "LGS", 482m, null, "ANKARA", null, null, null, null));
        Assert.Equal("Target", Assert.Single(result.Items).Band);

        // Filtre seçenekleri sınava göre ayrılır: LGS okul türü YKS listesine karışmaz.
        Assert.Contains("Fen Lisesi", (await Service.GetMetaAsync("LGS")).InstitutionTypes);
        Assert.DoesNotContain("Fen Lisesi", (await Service.GetMetaAsync("YKS")).InstitutionTypes);
        Assert.DoesNotContain("DEVLET", (await Service.GetMetaAsync("LGS")).InstitutionTypes);
    }

    [Fact]
    public void Lgs_Estimate_FullAndEmpty()
    {
        var full = Service.Estimate(Nets("LGS", turkish: 20, math: 20, science: 20, revolution: 10, religion: 10, foreignLanguage: 10));
        var empty = Service.Estimate(Nets("LGS"));
        var half = Service.Estimate(Nets("LGS", turkish: 10, math: 10, science: 10, revolution: 5, religion: 5, foreignLanguage: 5));

        Assert.Equal(500m, full.Scores.Single().Score);
        Assert.Equal(100m, empty.Scores.Single().Score);
        Assert.Equal(300m, half.Scores.Single().Score);
    }

    [Fact]
    public void Yks_Estimate_UsesTyt40Ayt60_AndObp()
    {
        var estimate = Service.Estimate(Nets(turkish: 40, social: 20, math: 40, science: 20, aytMath: 40, physics: 14, chemistry: 13, biology: 13, diploma: 100));

        Assert.Equal(560m, estimate.Scores.Single(item => item.ScoreType == "TYT").Score);
        Assert.Equal(560m, estimate.Scores.Single(item => item.ScoreType == "SAY").Score);
        Assert.Empty(estimate.Warnings);

        var tytOnly = Service.Estimate(Nets(turkish: 20, math: 20));
        Assert.Equal(TytOnlyExpected, tytOnly.Scores.Single().Score);
        Assert.Equal(2, tytOnly.Warnings.Count);
    }

    // 40 doğru net / 120 soru → 100 + 400 × 1/3
    private const decimal TytOnlyExpected = 233.333m;

    [Theory]
    [InlineData(41)]
    [InlineData(-1)]
    public void Estimate_RejectsImpossibleNets(int turkish)
        => Assert.Throws<ArgumentException>(() => Service.Estimate(Nets(turkish: turkish)));

    [Fact]
    public async Task Choices_EnforceLimit_UniqueAndKnownCodes()
    {
        var student = Guid.NewGuid();
        await Service.EnsureBuiltInDataAsync();

        var saved = await Service.SaveChoicesAsync(student, new SavePreferenceChoicesRequest("YKS", [new("106510077", "1. hedef"), new("106510068", null)]));
        Assert.Equal(2, saved.Count);
        Assert.Equal(442.53227m, saved[0].Program!.MinScore);
        Assert.NotNull(saved[0].Program!.PreviousMinScore);

        await Assert.ThrowsAsync<ArgumentException>(() => Service.SaveChoicesAsync(student, new SavePreferenceChoicesRequest("YKS", [new("106510077", null), new("106510077", null)])));
        await Assert.ThrowsAsync<ArgumentException>(() => Service.SaveChoicesAsync(student, new SavePreferenceChoicesRequest("YKS", [new("000000000", null)])));
        var tooMany = Enumerable.Range(0, 25).Select(_ => new PreferenceChoiceItem("106510077", null)).ToList();
        await Assert.ThrowsAsync<ArgumentException>(() => Service.SaveChoicesAsync(student, new SavePreferenceChoicesRequest("YKS", tooMany)));
        Assert.Equal(2, (await Service.GetChoicesAsync(student, "YKS")).Count);
    }
}
