using System.Globalization;
using System.IO.Compression;
using System.Text;
using CourseIntellect.Application.DTOs.Preference;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Tercih robotu. Veri kaynağı: ÖSYM "En Küçük ve En Büyük Puanlar" (TABLO-3/4)
/// resmî tabloları — derlemede gömülür, ilk kullanımda veritabanına yüklenir.
/// LGS okul verisi MEB toplu dosya yayımlamadığı için platform yöneticisi CSV'si
/// ile yüklenir; yüklü değilse robot bunu açıkça söyler, veri UYDURMAZ.
/// </summary>
public sealed class PreferenceRobotService(CourseIntellectDbContext dbContext) : IPreferenceRobotService
{
    public const string Yks = "YKS";
    public const string Lgs = "LGS";
    public const int MaxYksChoices = 24;
    public const int MaxLgsChoices = 5;

    private static readonly SemaphoreSlim LoadLock = new(1, 1);
    /// <summary>
    /// Gömülü YKS verisinin sürümü. Veri dosyaları değiştiğinde artırılır; eski sürümle
    /// yüklenmiş yıllar silinip yeniden yüklenir (tercih listeleri program koduyla tutulduğu için etkilenmez).
    /// 2: tüm üniversitelere il bilgisi + bölüm (eksiz program adı).
    /// </summary>
    public const int BuiltInDataVersion = 2;

    /// <summary>"Bilgisayar Mühendisliği (İngilizce) (Burslu)" → "Bilgisayar Mühendisliği".</summary>
    public static string DepartmentOf(string programName)
    {
        var index = programName.IndexOf('(');
        var head = index > 0 ? programName[..index].Trim() : programName.Trim();
        return head.Length > 0 ? head : programName.Trim();
    }
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");

    public const string Disclaimer =
        "Sonuçlar geçen yılların resmî yerleştirme verisine dayanır; bu yılın taban puanları kontenjan ve aday dağılımına göre değişir. " +
        "Kontenjanı dolmayan programlar, başarı sırası şartı (ör. Tıp, Hukuk, Öğretmenlik) ve özel koşullar ayrıca kontrol edilmelidir. " +
        "Kesin bilgi için ÖSYM Tercih Kılavuzu ve YÖK Atlas / MEB e-Okul esas alınır.";

    // ─── Net → puan tahmini ─────────────────────────────────────────────────

    private sealed record Test(string Name, Func<PreferenceNetInput, decimal?> Read, int Questions);

    private static readonly Test[] TytTests =
    [
        new("Türkçe", input => input.Turkish, 40),
        new("Sosyal Bilimler", input => input.Social, 20),
        new("Temel Matematik", input => input.Math, 40),
        new("Fen Bilimleri", input => input.Science, 20),
    ];

    private static readonly Dictionary<string, Test[]> AytTests = new()
    {
        ["SAY"] =
        [
            new("AYT Matematik", input => input.AytMath, 40), new("Fizik", input => input.Physics, 14),
            new("Kimya", input => input.Chemistry, 13), new("Biyoloji", input => input.Biology, 13),
        ],
        ["EA"] =
        [
            new("AYT Matematik", input => input.AytMath, 40), new("Edebiyat", input => input.Literature, 24),
            new("Tarih-1", input => input.History1, 10), new("Coğrafya-1", input => input.Geography1, 6),
        ],
        ["SÖZ"] =
        [
            new("Edebiyat", input => input.Literature, 24), new("Tarih-1", input => input.History1, 10),
            new("Coğrafya-1", input => input.Geography1, 6), new("Tarih-2", input => input.History2, 11),
            new("Coğrafya-2", input => input.Geography2, 11), new("Felsefe Grubu", input => input.Philosophy, 12),
            new("Din Kültürü", input => input.Religion, 6),
        ],
        ["DİL"] = [new("Yabancı Dil (YDT)", input => input.ForeignLanguage, 80)],
    };

    /// <summary>LGS ağırlıkları (MEB): Türkçe, Matematik, Fen ×4; İnkılap, Din, Yabancı Dil ×1.</summary>
    private static readonly (Test Test, int Weight)[] LgsTests =
    [
        (new("Türkçe", input => input.Turkish, 20), 4),
        (new("Matematik", input => input.Math, 20), 4),
        (new("Fen Bilimleri", input => input.Science, 20), 4),
        (new("T.C. İnkılap Tarihi", input => input.Revolution, 10), 1),
        (new("Din Kültürü", input => input.Religion, 10), 1),
        (new("Yabancı Dil", input => input.ForeignLanguage, 10), 1),
    ];

    public PreferenceEstimateDto Estimate(PreferenceNetInput input)
    {
        var warnings = new List<string>();
        decimal Net(Test test)
        {
            var value = test.Read(input) ?? 0;
            if (value < 0) throw new ArgumentException($"{test.Name} neti eksi olamaz.");
            if (value > test.Questions) throw new ArgumentException($"{test.Name} neti {test.Questions} soruyu aşamaz.");
            return value;
        }

        if (string.Equals(input.Exam, Lgs, StringComparison.OrdinalIgnoreCase))
        {
            var weighted = LgsTests.Sum(item => Net(item.Test) * item.Weight);
            var max = LgsTests.Sum(item => item.Test.Questions * item.Weight);
            var score = Math.Round(100 + 400 * weighted / max, 3);
            return new PreferenceEstimateDto(
                [new PreferenceScoreEstimateDto("LGS", score, 500)],
                warnings,
                "LGS ağırlıkları (Türkçe, Matematik, Fen ×4; İnkılap, Din, Yabancı Dil ×1) ile 100–500 aralığına doğrusal yaklaşım. " +
                "MEB gerçek puanı o yılın standart puanlarıyla hesaplar; fark ±10 puan olabilir.");
        }

        var tytRatio = TytTests.Sum(Net) / TytTests.Sum(test => test.Questions);
        // Diploma notu (50-100) → OBP (×5) → yerleştirme puanına katkı ×0,12 (ÖSYM).
        decimal obpBonus = 0;
        if (input.DiplomaGrade is decimal diploma)
        {
            if (diploma is < 50 or > 100) throw new ArgumentException("Diploma notu 50-100 arasında olmalı.");
            obpBonus = Math.Round(diploma * 5 * 0.12m, 3);
        }
        else
        {
            warnings.Add("Diploma notu girilmedi; OBP katkısı (en fazla +60) hesaba katılmadı.");
        }

        var scores = new List<PreferenceScoreEstimateDto>
        {
            new("TYT", Math.Round(100 + 400 * tytRatio + obpBonus, 3), 560),
        };
        foreach (var (scoreType, tests) in AytTests)
        {
            var aytNet = tests.Sum(Net);
            if (aytNet <= 0) continue;
            var aytRatio = aytNet / tests.Sum(test => test.Questions);
            // ÖSYM: alan puanında TYT %40, AYT %60 ağırlıklıdır.
            scores.Add(new PreferenceScoreEstimateDto(scoreType, Math.Round(100 + 400 * (0.4m * tytRatio + 0.6m * aytRatio) + obpBonus, 3), 560));
        }
        if (scores.Count == 1) warnings.Add("AYT neti girilmedi; yalnız TYT (önlisans) puanı tahmin edildi.");
        return new PreferenceEstimateDto(
            scores,
            warnings,
            "TYT ve AYT netleri soru sayısına göre oranlanır; alan puanı TYT %40 + AYT %60 ağırlıkla, OBP katkısı diploma notu × 5 × 0,12 ile eklenir. " +
            "ÖSYM gerçek puanı o yılın ortalama ve standart sapmalarıyla hesaplar; bu tahmin yön göstermek içindir.");
    }

    // ─── Arama ──────────────────────────────────────────────────────────────

    private static (decimal Safe, decimal Target, decimal Reach) Bands(string exam) =>
        exam == Lgs ? (10m, -5m, -15m) : (15m, -10m, -25m);

    public async Task<PreferenceMetaDto> GetMetaAsync(string? exam = null, CancellationToken cancellationToken = default)
    {
        await EnsureBuiltInDataAsync(cancellationToken);
        // İl ve kurum türü seçenekleri sınava göre: LGS okul türleri YKS filtresine karışmaz.
        var scoped = NormalizeExam(exam ?? Yks);
        var datasets = await dbContext.PreferencePrograms.AsNoTracking()
            .GroupBy(item => new { item.Exam, item.Year, item.Source, item.SourceUrl })
            .Select(group => new PreferenceDatasetDto(group.Key.Exam, group.Key.Year, group.Count(), group.Key.Source, group.Key.SourceUrl))
            .ToListAsync(cancellationToken);
        var cities = await dbContext.PreferencePrograms.AsNoTracking()
            .Where(item => item.Exam == scoped && item.City != string.Empty)
            .Select(item => item.City)
            .Distinct()
            .ToListAsync(cancellationToken);
        var types = await dbContext.PreferencePrograms.AsNoTracking()
            .Where(item => item.Exam == scoped)
            .Select(item => item.InstitutionType)
            .Distinct()
            .ToListAsync(cancellationToken);
        return new PreferenceMetaDto(
            datasets.OrderBy(item => item.Exam).ThenByDescending(item => item.Year).ToList(),
            cities.OrderBy(item => item, StringComparer.Create(Tr, true)).ToList(),
            types.Where(item => item.Length > 0).OrderBy(item => item, StringComparer.Create(Tr, true)).ToList(),
            datasets.Any(item => item.Exam == Lgs));
    }

    public async Task<PreferenceOptionsDto> GetOptionsAsync(PreferenceOptionsRequest request, CancellationToken cancellationToken = default)
    {
        await EnsureBuiltInDataAsync(cancellationToken);
        var exam = NormalizeExam(request.Exam);
        var year = await dbContext.PreferencePrograms.AsNoTracking()
            .Where(item => item.Exam == exam)
            .Select(item => (int?)item.Year)
            .MaxAsync(cancellationToken);
        if (year is null) return new PreferenceOptionsDto(0, [], [], []);

        // Puan türü / düzey / kurum türü tüm listeleri daraltır; il üniversiteleri,
        // üniversite (yoksa il) bölümleri daraltır. Böylece yalnız gerçekten var olan
        // il-üniversite-bölüm üçlüleri seçilebilir.
        var scoped = dbContext.PreferencePrograms.AsNoTracking().Where(item => item.Exam == exam && item.Year == year);
        var scoreType = (request.ScoreType ?? string.Empty).Trim().ToUpper(Tr);
        if (exam == Yks && scoreType.Length > 0) scoped = scoped.Where(item => item.ScoreType == scoreType);
        if (!string.IsNullOrWhiteSpace(request.Level)) scoped = scoped.Where(item => item.Level == request.Level.Trim());
        if (!string.IsNullOrWhiteSpace(request.InstitutionType)) scoped = scoped.Where(item => item.InstitutionType == request.InstitutionType.Trim());

        var rows = await scoped
            .Select(item => new { item.City, item.InstitutionName, item.InstitutionType, item.Department })
            .ToListAsync(cancellationToken);
        var comparer = StringComparer.Create(Tr, true);
        var city = (request.City ?? string.Empty).Trim();
        var university = (request.University ?? string.Empty).Trim();

        var cities = rows
            .Where(item => item.City.Length > 0)
            .GroupBy(item => item.City)
            .Select(group => new PreferenceCityOptionDto(group.Key, group.Select(item => item.InstitutionName).Distinct().Count(), group.Count()))
            .OrderBy(item => item.Name, comparer)
            .ToList();
        var inCity = city.Length > 0 ? rows.Where(item => item.City == city).ToList() : rows;
        var universities = inCity
            .GroupBy(item => item.InstitutionName)
            .Select(group => new PreferenceUniversityOptionDto(group.Key, group.First().City, group.First().InstitutionType, group.Count()))
            .OrderBy(item => item.Name, comparer)
            .ToList();
        var inUniversity = university.Length > 0 ? inCity.Where(item => item.InstitutionName == university).ToList() : inCity;
        var departments = inUniversity
            .GroupBy(item => item.Department)
            .Select(group => new PreferenceDepartmentOptionDto(group.Key, group.Count(), group.Select(item => item.InstitutionName).Distinct().Count()))
            .OrderBy(item => item.Name, comparer)
            .ToList();
        return new PreferenceOptionsDto(year.Value, cities, universities, departments);
    }

    public async Task<PreferenceSearchResultDto> SearchAsync(PreferenceSearchRequest request, CancellationToken cancellationToken = default)
    {
        await EnsureBuiltInDataAsync(cancellationToken);
        var exam = NormalizeExam(request.Exam);
        var scoreType = (request.ScoreType ?? string.Empty).Trim().ToUpper(Tr);
        if (request.Score is < 0 or > 600) throw new ArgumentException("Puan 0-600 arasında olmalı.");

        var years = await dbContext.PreferencePrograms.AsNoTracking()
            .Where(item => item.Exam == exam)
            .Select(item => item.Year)
            .Distinct()
            .OrderByDescending(item => item)
            .ToListAsync(cancellationToken);
        if (years.Count == 0)
        {
            throw new InvalidOperationException(exam == Lgs
                ? "LGS okul verisi henüz yüklenmedi. MEB'in resmî taban puanları yüklendiğinde robot LGS için de çalışır."
                : "YKS verisi bulunamadı.");
        }
        var year = request.Year is int requested && years.Contains(requested) ? requested : years[0];
        int? previousYear = years.Where(item => item < year).Cast<int?>().FirstOrDefault();

        var (safe, target, reach) = Bands(exam);
        var university = (request.University ?? string.Empty).Trim();
        var department = (request.Department ?? string.Empty).Trim();
        // Üniversite ya da bölüm seçildiyse kullanıcı belirli programlara bakıyor: puan
        // penceresi uygulanmaz, ulaşılamayanlar da "Far" bandında gösterilir.
        var focused = university.Length > 0 || department.Length > 0;
        var low = request.Score - safe - 40;
        var high = request.Score - reach;
        var query = dbContext.PreferencePrograms.AsNoTracking()
            .Where(item => item.Exam == exam && item.Year == year && item.MinScore != null);
        if (!focused) query = query.Where(item => item.MinScore >= low && item.MinScore <= high);
        if (university.Length > 0) query = query.Where(item => item.InstitutionName == university);
        if (department.Length > 0) query = query.Where(item => item.Department == department);
        if (exam == Yks)
        {
            if (scoreType.Length == 0) throw new ArgumentException("Puan türü seçin (SAY, EA, SÖZ, DİL, TYT).");
            query = query.Where(item => item.ScoreType == scoreType);
        }
        if (!string.IsNullOrWhiteSpace(request.InstitutionType)) query = query.Where(item => item.InstitutionType == request.InstitutionType.Trim());
        if (!string.IsNullOrWhiteSpace(request.Level)) query = query.Where(item => item.Level == request.Level.Trim());
        var rows = await query.ToListAsync(cancellationToken);

        var city = (request.City ?? string.Empty).Trim().ToUpper(Tr);
        if (city.Length > 0) rows = rows.Where(item => item.City.ToUpper(Tr) == city).ToList();
        var text = (request.Query ?? string.Empty).Trim().ToLower(Tr);
        if (text.Length > 0)
        {
            var terms = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            rows = rows.Where(item =>
            {
                var haystack = $"{item.ProgramName} {item.InstitutionName} {item.Unit}".ToLower(Tr);
                return terms.All(haystack.Contains);
            }).ToList();
        }

        var codes = rows.Select(item => item.Code).ToList();
        var previous = previousYear is int prev
            ? await dbContext.PreferencePrograms.AsNoTracking()
                .Where(item => item.Exam == exam && item.Year == prev && codes.Contains(item.Code))
                .ToDictionaryAsync(item => item.Code, item => item.MinScore, cancellationToken)
            : [];

        var matches = rows
            .Select(item =>
            {
                var gap = Math.Round(request.Score - item.MinScore!.Value, 2);
                var band = gap >= safe ? "Safe" : gap >= target ? "Target" : gap >= reach ? "Reach" : focused ? "Far" : null;
                return band is null ? null : ToMatch(item, gap, band, previous.GetValueOrDefault(item.Code));
            })
            .Where(item => item is not null && (focused || item.Band != "Safe" || item.Gap <= safe + 40))
            .Select(item => item!)
            .ToList();

        var limit = Math.Clamp(request.Limit ?? 300, 10, 1000);
        // Önce hedef (en uygun), sonra zorlayıcı, sonra rahat; her bant içinde taban puanı yüksekten düşüğe.
        var ordered = matches
            .OrderBy(item => item.Band switch { "Target" => 0, "Reach" => 1, "Safe" => 2, _ => 3 })
            .ThenByDescending(item => item.MinScore)
            .Take(limit)
            .ToList();
        return new PreferenceSearchResultDto(
            year,
            previousYear,
            request.Score,
            exam == Lgs ? "LGS" : scoreType,
            matches.Count(item => item.Band == "Safe"),
            matches.Count(item => item.Band == "Target"),
            matches.Count(item => item.Band == "Reach"),
            ordered,
            Disclaimer,
            focused,
            matches.Count(item => item.Band == "Far"));
    }

    // ─── Tercih listesi ─────────────────────────────────────────────────────

    public async Task<IReadOnlyList<PreferenceChoiceDto>> GetChoicesAsync(Guid studentUserId, string exam, CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeExam(exam);
        var choices = await dbContext.StudentPreferenceChoices.AsNoTracking()
            .Where(item => item.StudentUserId == studentUserId && item.Exam == normalized)
            .OrderBy(item => item.Order)
            .ToListAsync(cancellationToken);
        return await MapChoicesAsync(normalized, choices, cancellationToken);
    }

    public async Task<IReadOnlyList<PreferenceChoiceDto>> SaveChoicesAsync(Guid studentUserId, SavePreferenceChoicesRequest request, CancellationToken cancellationToken = default)
    {
        await EnsureBuiltInDataAsync(cancellationToken);
        var exam = NormalizeExam(request.Exam);
        var items = request.Items ?? [];
        var max = exam == Lgs ? MaxLgsChoices : MaxYksChoices;
        if (items.Count > max) throw new ArgumentException($"{exam} için en fazla {max} tercih yapılabilir.");
        var codes = items.Select(item => (item.ProgramCode ?? string.Empty).Trim()).ToList();
        if (codes.Distinct().Count() != codes.Count) throw new ArgumentException("Aynı program listede iki kez yer alamaz.");
        var known = await dbContext.PreferencePrograms.AsNoTracking()
            .Where(item => item.Exam == exam && codes.Contains(item.Code))
            .Select(item => item.Code)
            .Distinct()
            .ToListAsync(cancellationToken);
        var unknown = codes.Except(known).ToList();
        if (unknown.Count > 0) throw new ArgumentException($"Tanınmayan program kodu: {string.Join(", ", unknown.Take(3))}.");

        var existing = await dbContext.StudentPreferenceChoices
            .Where(item => item.StudentUserId == studentUserId && item.Exam == exam)
            .ToListAsync(cancellationToken);
        dbContext.StudentPreferenceChoices.RemoveRange(existing);
        await dbContext.SaveChangesAsync(cancellationToken);
        var created = items.Select((item, index) => new StudentPreferenceChoice
        {
            StudentUserId = studentUserId,
            Exam = exam,
            ProgramCode = item.ProgramCode.Trim(),
            Order = index + 1,
            Note = Clip(item.Note, 300),
        }).ToList();
        await dbContext.StudentPreferenceChoices.AddRangeAsync(created, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return await MapChoicesAsync(exam, created, cancellationToken);
    }

    private async Task<IReadOnlyList<PreferenceChoiceDto>> MapChoicesAsync(string exam, IReadOnlyList<StudentPreferenceChoice> choices, CancellationToken cancellationToken)
    {
        var codes = choices.Select(item => item.ProgramCode).ToList();
        var programs = await dbContext.PreferencePrograms.AsNoTracking()
            .Where(item => item.Exam == exam && codes.Contains(item.Code))
            .ToListAsync(cancellationToken);
        var latest = programs.GroupBy(item => item.Code).ToDictionary(group => group.Key, group => group.OrderByDescending(item => item.Year).ToList());
        return choices.Select(choice =>
        {
            var versions = latest.GetValueOrDefault(choice.ProgramCode);
            var current = versions?.FirstOrDefault();
            var previous = versions?.Skip(1).FirstOrDefault();
            return new PreferenceChoiceDto(choice.Id, choice.Order, choice.Exam, choice.Note,
                current is null ? null : ToMatch(current, 0, string.Empty, previous?.MinScore));
        }).ToList();
    }

    // ─── Veri yükleme ───────────────────────────────────────────────────────

    public async Task EnsureBuiltInDataAsync(CancellationToken cancellationToken = default)
    {
        var assembly = typeof(PreferenceRobotService).Assembly;
        var resources = assembly.GetManifestResourceNames()
            .Where(name => name.StartsWith("Preference.yks_", StringComparison.Ordinal))
            .Select(name => (Name: name, Year: int.Parse(name["Preference.yks_".Length..name.IndexOf(".csv", StringComparison.Ordinal)], CultureInfo.InvariantCulture)))
            .ToList();
        var years = resources.Select(item => item.Year).ToList();
        // Güncel sürümle yüklü yıllar veritabanından okunur (süreç içi önbellek tutulmaz: veritabanı değişebilir).
        var loaded = await dbContext.PreferencePrograms.AsNoTracking()
            .Where(item => item.Exam == Yks && years.Contains(item.Year) && item.DataVersion == BuiltInDataVersion)
            .Select(item => item.Year).Distinct().ToListAsync(cancellationToken);
        if (resources.All(item => loaded.Contains(item.Year))) return;
        await LoadLock.WaitAsync(cancellationToken);
        try
        {
            foreach (var (name, year) in resources)
            {
                // Kilit beklerken başka bir istek yüklemiş olabilir.
                if (await dbContext.PreferencePrograms.AnyAsync(item => item.Exam == Yks && item.Year == year && item.DataVersion == BuiltInDataVersion, cancellationToken)) continue;
                await using var transaction = dbContext.Database.IsRelational()
                    ? await dbContext.Database.BeginTransactionAsync(cancellationToken)
                    : null;
                // Eski sürümle yüklenmiş yıl varsa yenisiyle değiştirilir.
                await dbContext.PreferencePrograms
                    .Where(item => item.Exam == Yks && item.Year == year)
                    .ExecuteDeleteAsync(cancellationToken);
                await using var stream = assembly.GetManifestResourceStream(name)!;
                await ImportYksAsync(year, stream, cancellationToken);
                if (transaction is not null) await transaction.CommitAsync(cancellationToken);
            }
        }
        finally
        {
            LoadLock.Release();
        }
    }

    private async Task ImportYksAsync(int year, Stream gzip, CancellationToken cancellationToken)
    {
        await using var decompressed = new GZipStream(gzip, CompressionMode.Decompress);
        using var reader = new StreamReader(decompressed, Encoding.UTF8);
        await reader.ReadLineAsync(cancellationToken);
        var batch = new List<PreferenceProgram>(2000);
        var tracking = dbContext.ChangeTracker.AutoDetectChangesEnabled;
        dbContext.ChangeTracker.AutoDetectChangesEnabled = false;
        try
        {
            while (await reader.ReadLineAsync(cancellationToken) is { } line)
            {
                var cells = line.Split(';');
                if (cells.Length < 13) continue;
                batch.Add(new PreferenceProgram
                {
                    Exam = Yks,
                    Year = year,
                    Code = cells[0],
                    Level = cells[1],
                    InstitutionType = cells[2],
                    InstitutionName = cells[3],
                    City = cells[4],
                    Unit = cells[5],
                    ProgramName = cells[6],
                    Department = DepartmentOf(cells[6]),
                    DataVersion = BuiltInDataVersion,
                    ScoreType = cells[7],
                    Quota = ParseInt(cells[8]),
                    Placed = ParseInt(cells[9]),
                    MinScore = ParseDecimal(cells[10]),
                    MaxScore = ParseDecimal(cells[11]),
                    Source = $"ÖSYM {year}-YKS Yerleştirme, En Küçük ve En Büyük Puanlar (Tablo 3/4)",
                    SourceUrl = cells[12],
                });
                if (batch.Count == 2000) await FlushAsync(batch, cancellationToken);
            }
            await FlushAsync(batch, cancellationToken);
        }
        finally
        {
            dbContext.ChangeTracker.AutoDetectChangesEnabled = tracking;
        }
    }

    public async Task<PreferenceImportResultDto> ImportLgsCsvAsync(int year, string source, string sourceUrl, Stream csv, CancellationToken cancellationToken = default)
    {
        if (year is < 2018 or > 2100) throw new ArgumentException("Geçersiz yıl.");
        if (string.IsNullOrWhiteSpace(source) || !Uri.TryCreate(sourceUrl, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
        {
            throw new ArgumentException("Kaynak adı ve https kaynak adresi zorunludur (verinin nereden alındığı kaydedilir).");
        }
        using var reader = new StreamReader(csv, Encoding.UTF8);
        var errors = new List<string>();
        var programs = new List<PreferenceProgram>();
        var lineNo = 0;
        while (await reader.ReadLineAsync(cancellationToken) is { } line)
        {
            lineNo++;
            if (lineNo == 1 && !char.IsDigit(line.TrimStart('﻿').FirstOrDefault())) continue;
            if (string.IsNullOrWhiteSpace(line)) continue;
            var cells = line.Split(';').Select(cell => cell.Trim()).ToArray();
            if (cells.Length < 8)
            {
                errors.Add($"{lineNo}. satır: 8 sütun bekleniyor.");
                continue;
            }
            var score = ParseDecimal(cells[6]);
            if (cells[0].Length == 0 || cells[1].Length == 0 || score is null or < 100 or > 500)
            {
                errors.Add($"{lineNo}. satır: kurum kodu, okul adı ve 100-500 arası taban puan zorunlu.");
                continue;
            }
            programs.Add(new PreferenceProgram
            {
                Exam = Lgs,
                Year = year,
                Code = cells[0],
                Level = "Lise",
                InstitutionName = cells[1],
                City = cells[2].ToUpper(Tr),
                Unit = cells[3],
                InstitutionType = cells[4],
                ProgramName = cells[1],
                Department = cells[1].Trim(),
                ScoreType = "LGS",
                Quota = ParseInt(cells[5]),
                MinScore = score,
                Percentile = ParseDecimal(cells[7]),
                Source = Clip(source, 120),
                SourceUrl = Clip(sourceUrl, 300),
            });
        }
        if (programs.Count == 0) return new PreferenceImportResultDto(Lgs, year, 0, errors.Count, errors.Take(20).ToList());
        if (programs.Select(item => item.Code).Distinct().Count() != programs.Count) throw new ArgumentException("Dosyada aynı kurum kodu birden fazla kez geçiyor.");

        // Aynı yılın verisi yeniden yüklenirse eskisi tamamen değiştirilir.
        var imported = programs.Count;
        await dbContext.PreferencePrograms.Where(item => item.Exam == Lgs && item.Year == year).ExecuteDeleteAsync(cancellationToken);
        await FlushAsync(programs, cancellationToken);
        return new PreferenceImportResultDto(Lgs, year, imported, errors.Count, errors.Take(20).ToList());
    }

    private async Task FlushAsync(List<PreferenceProgram> batch, CancellationToken cancellationToken)
    {
        if (batch.Count == 0) return;
        await dbContext.PreferencePrograms.AddRangeAsync(batch, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        dbContext.ChangeTracker.Clear();
        batch.Clear();
    }

    // ─── Yardımcılar ────────────────────────────────────────────────────────

    private static PreferenceMatchDto ToMatch(PreferenceProgram item, decimal gap, string band, decimal? previousMin) => new(
        item.Code, item.Level, item.InstitutionType, item.InstitutionName, item.City, item.Unit, item.ProgramName, item.ScoreType,
        item.Quota, item.Placed, item.MinScore, item.MaxScore, item.Percentile, previousMin, gap, band, item.Year, item.Source, item.SourceUrl);

    private static string NormalizeExam(string? exam)
    {
        var value = (exam ?? string.Empty).Trim().ToUpperInvariant();
        return value switch
        {
            Yks or "TYT" or "AYT" => Yks,
            Lgs => Lgs,
            _ => throw new ArgumentException("Sınav YKS ya da LGS olmalı."),
        };
    }

    private static int? ParseInt(string value) =>
        int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) ? parsed : null;

    private static decimal? ParseDecimal(string value)
    {
        var text = (value ?? string.Empty).Trim().Replace(',', '.');
        return decimal.TryParse(text, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed) ? parsed : null;
    }

    private static string Clip(string? value, int max)
    {
        var text = (value ?? string.Empty).Trim();
        return text.Length > max ? text[..max] : text;
    }
}
