namespace CourseIntellect.Application.DTOs.Preference;

/// <summary>Yüklü bir veri setinin künyesi: hangi sınav, hangi yıl, kaç kayıt, kaynak.</summary>
public sealed record PreferenceDatasetDto(string Exam, int Year, int Count, string Source, string SourceUrl);

public sealed record PreferenceMetaDto(
    IReadOnlyList<PreferenceDatasetDto> Datasets,
    IReadOnlyList<string> Cities,
    IReadOnlyList<string> InstitutionTypes,
    /// <summary>LGS verisi yüklü değilse istemci bunu açıkça gösterir.</summary>
    bool LgsAvailable);

/// <summary>
/// Net girişi. YKS: TYT dört test + AYT testleri + diploma notu; LGS: altı test.
/// Boş bırakılan testler 0 sayılır.
/// </summary>
public sealed record PreferenceNetInput(
    string Exam,
    decimal? Turkish,
    decimal? Social,
    decimal? Math,
    decimal? Science,
    decimal? AytMath,
    decimal? Physics,
    decimal? Chemistry,
    decimal? Biology,
    decimal? Literature,
    decimal? History1,
    decimal? Geography1,
    decimal? History2,
    decimal? Geography2,
    decimal? Philosophy,
    decimal? Religion,
    decimal? ForeignLanguage,
    decimal? Revolution,
    decimal? DiplomaGrade);

public sealed record PreferenceScoreEstimateDto(string ScoreType, decimal Score, decimal MaxScore);

public sealed record PreferenceEstimateDto(
    IReadOnlyList<PreferenceScoreEstimateDto> Scores,
    IReadOnlyList<string> Warnings,
    string Method);

public sealed record PreferenceSearchRequest(
    string Exam,
    string ScoreType,
    decimal Score,
    int? Year,
    string? City,
    string? InstitutionType,
    string? Level,
    string? Query,
    int? Limit,
    /// <summary>Seçilen üniversite/okul (tam ad). Seçiliyse puan penceresi uygulanmaz, tüm programlar gelir.</summary>
    string? University = null,
    /// <summary>Seçilen bölüm (eksiz program adı). Seçiliyse puan penceresi uygulanmaz.</summary>
    string? Department = null);

/// <summary>Kademeli filtre seçenekleri: il → üniversite → bölüm, en güncel yılın verisinden.</summary>
public sealed record PreferenceOptionsRequest(
    string Exam,
    string? ScoreType,
    string? Level,
    string? InstitutionType,
    string? City,
    string? University);

public sealed record PreferenceCityOptionDto(string Name, int UniversityCount, int ProgramCount);

public sealed record PreferenceUniversityOptionDto(string Name, string City, string InstitutionType, int ProgramCount);

public sealed record PreferenceDepartmentOptionDto(string Name, int ProgramCount, int UniversityCount);

public sealed record PreferenceOptionsDto(
    int Year,
    IReadOnlyList<PreferenceCityOptionDto> Cities,
    IReadOnlyList<PreferenceUniversityOptionDto> Universities,
    IReadOnlyList<PreferenceDepartmentOptionDto> Departments);

/// <summary>
/// Band: Safe (rahat), Target (hedef), Reach (zorlayıcı); yalnız üniversite/bölüm seçiliyken
/// Far (puanın taban puanın çok altında).
/// </summary>
public sealed record PreferenceMatchDto(
    string Code,
    string Level,
    string InstitutionType,
    string InstitutionName,
    string City,
    string Unit,
    string ProgramName,
    string ScoreType,
    int? Quota,
    int? Placed,
    decimal? MinScore,
    decimal? MaxScore,
    decimal? Percentile,
    decimal? PreviousMinScore,
    decimal Gap,
    string Band,
    int Year,
    string Source,
    string SourceUrl);

public sealed record PreferenceSearchResultDto(
    int Year,
    int? PreviousYear,
    decimal Score,
    string ScoreType,
    int SafeCount,
    int TargetCount,
    int ReachCount,
    IReadOnlyList<PreferenceMatchDto> Items,
    string Disclaimer,
    /// <summary>Üniversite ya da bölüm seçiliyse true: tüm programlar listelenir, Far bandı dolabilir.</summary>
    bool Focused = false,
    int FarCount = 0);

public sealed record PreferenceChoiceDto(Guid Id, int Order, string Exam, string Note, PreferenceMatchDto? Program);

public sealed record SavePreferenceChoicesRequest(string Exam, IReadOnlyList<PreferenceChoiceItem> Items);

public sealed record PreferenceChoiceItem(string ProgramCode, string? Note);

public sealed record PreferenceImportResultDto(string Exam, int Year, int Imported, int Skipped, IReadOnlyList<string> Errors);
