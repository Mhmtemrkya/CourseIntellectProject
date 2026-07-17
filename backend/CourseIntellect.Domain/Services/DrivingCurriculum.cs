namespace CourseIntellect.Domain.Services;

/// <summary>
/// MTSK resmî teorik müfredatı (MEB Özel Motorlu Taşıt Sürücüleri Kursu Yönetmeliği).
/// Ders saatleri sınıf farkı gözetmeksizin ilk kez sertifika alan aday içindir;
/// kurum bunu aşağı çekemez, üstüne ders ekleyebilir.
/// </summary>
public static class DrivingCurriculum
{
    /// <summary>Bir teorik "ders saati"nin dakika karşılığı.</summary>
    public const int TheoryLessonMinutes = 45;

    /// <summary>Resmî teorik ders konusu ve zorunlu ders saati.</summary>
    public sealed record CurriculumSubject(string Key, string Label, int RequiredHours);

    /// <summary>
    /// Zorunlu teorik konular. <c>Key</c> oturum kaydındaki <c>Subject</c> alanıyla
    /// esnek eşleşir (<see cref="MatchSubject"/>): sekreter "İlk Yardım" da yazsa
    /// "ilkyardim" da yazsa aynı konuya sayılır.
    /// </summary>
    public static readonly IReadOnlyList<CurriculumSubject> TheorySubjects =
    [
        new("trafik", "Trafik ve Çevre Bilgisi", 16),
        new("ilkyardim", "İlk Yardım", 8),
        new("motor", "Araç Tekniği (Motor ve Araç Bilgisi)", 6),
        new("adab", "Trafik Adabı", 4),
    ];

    public static int TotalRequiredHours => TheorySubjects.Sum(x => x.RequiredHours);

    /// <summary>Bir direksiyon "ders saati"nin dakika karşılığı (MTSK: 50 dk).</summary>
    public const int PracticeLessonMinutes = 50;

    /// <summary>
    /// Sınıf bazlı asgari direksiyon eğitimi (ders saati). Yalnızca yönetmelikte
    /// net bilinen sınıflar sabitlenir; listede olmayan sınıfta kural uygulanmaz
    /// (0 döner) — yanlış asgari dayatmak, hiç dayatmamaktan kötüdür.
    /// </summary>
    public static int MinimumPracticeLessonHoursFor(string? licenseClass) =>
        (licenseClass ?? string.Empty).Trim().ToUpperInvariant() switch
        {
            "B" => 14,
            "A" or "A1" or "A2" => 12,
            _ => 0,
        };

    /// <summary>Sınıfın asgari direksiyon süresi dakika cinsinden (0 = kural yok).</summary>
    public static int MinimumPracticeMinutesFor(string? licenseClass)
        => MinimumPracticeLessonHoursFor(licenseClass) * PracticeLessonMinutes;

    /// <summary>
    /// Serbest metin konu adını resmî konuya eşler; eşleşmezse null (kurum dışı ek ders).
    /// Türkçe karakter ve büyük/küçük duyarsız arama yapılır.
    /// </summary>
    public static CurriculumSubject? MatchSubject(string? subject)
    {
        if (string.IsNullOrWhiteSpace(subject)) return null;
        var normalized = Normalize(subject);

        if (normalized.Contains("adab") || normalized.Contains("adap")) return TheorySubjects[3];
        if (normalized.Contains("trafik") || normalized.Contains("cevre")) return TheorySubjects[0];
        if (normalized.Contains("ilkyardim") || normalized.Contains("yardim")) return TheorySubjects[1];
        if (normalized.Contains("motor") || normalized.Contains("arac") || normalized.Contains("teknik")) return TheorySubjects[2];
        return null;
    }

    /// <summary>Dakikayı ders saatine çevirir (45 dk = 1 saat; artık dakika tam saate SAYILMAZ).</summary>
    public static int MinutesToLessonHours(int minutes) => Math.Max(0, minutes) / TheoryLessonMinutes;

    private static string Normalize(string value)
        // 'İ' invariant küçültmede ya değişmez ya birleşik işaret üretir; Türkçe
        // büyük harfleri ASCII karşılığına ÖNCE indirip sonra küçültüyoruz.
        => new(value
            .Trim()
            .Replace('İ', 'i').Replace('I', 'i').Replace('Ç', 'c').Replace('Ş', 's')
            .Replace('Ğ', 'g').Replace('Ü', 'u').Replace('Ö', 'o')
            .ToLowerInvariant()
            .Replace('ı', 'i').Replace('ç', 'c').Replace('ş', 's')
            .Replace('ğ', 'g').Replace('ü', 'u').Replace('ö', 'o')
            .Where(char.IsLetter)
            .ToArray());
}
