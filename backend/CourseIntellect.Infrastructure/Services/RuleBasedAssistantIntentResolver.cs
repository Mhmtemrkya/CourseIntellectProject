using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using CourseIntellect.Application.DTOs.Assistant;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Infrastructure.Services;

public sealed partial class RuleBasedAssistantIntentResolver : IAssistantIntentResolver
{
    // Kural motoru tamamen bellekte çalışır; async imza yalnız arayüz uyumu için.
    public Task<ParsedAssistantQuery> ResolveAsync(string message, CancellationToken cancellationToken = default)
        => Task.FromResult(Resolve(message));

    /// <summary>Senkron kural ayrıştırması. Hibrit resolver ve testler doğrudan kullanır.</summary>
    public ParsedAssistantQuery Resolve(string message)
    {
        var normalized = Normalize(message);
        var searchable = RemoveDiacritics(normalized);
        var number = NumberRegex().Match(searchable);
        string? tc = null;
        string? studentNumber = null;
        if (number.Success)
        {
            if (number.Value.Length == 11) tc = number.Value;
            else studentNumber = number.Value;
        }

        var classMatch = ClassRegex().Match(searchable);
        int? grade = classMatch.Success && int.TryParse(classMatch.Groups[1].Value, out var parsedGrade) ? parsedGrade : null;
        var section = classMatch.Success ? classMatch.Groups[2].Value.ToUpperInvariant() : null;
        var thresholdMatch = ScoreRegex().Match(searchable);
        decimal? threshold = thresholdMatch.Success && decimal.TryParse(thresholdMatch.Groups[1].Value, out var score) ? score : null;

        var intent = ResolveIntent(searchable, tc, studentNumber, grade);
        var searchText = ExtractSearchText(searchable);
        return new ParsedAssistantQuery(intent, normalized, searchText, tc, studentNumber, grade, section, threshold);
    }

    public static bool IsValidTurkishIdentityNumber(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length != 11 || value[0] == '0' || !value.All(char.IsDigit)) return false;
        var digits = value.Select(c => c - '0').ToArray();
        var odd = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
        var even = digits[1] + digits[3] + digits[5] + digits[7];
        return ((odd * 7 - even) % 10 + 10) % 10 == digits[9]
            && digits.Take(10).Sum() % 10 == digits[10];
    }

    public static string Normalize(string value) => MultiSpaceRegex().Replace((value ?? string.Empty).Trim().ToLower(new CultureInfo("tr-TR")), " ");

    private static AssistantIntent ResolveIntent(string text, string? tc, string? studentNumber, int? grade)
    {
        if (ContainsAny(text, "merhaba", "selam", "gunaydin", "iyi aksamlar")) return AssistantIntent.Greeting;
        if (ContainsAny(text, "yardim", "neler yapabilirsin", "komutlar")) return AssistantIntent.Help;
        // Yazma eylemleri EN ÖNDE: "evrak hatırlatması gönder" cümlesi aksi hâlde
        // "evrak" kuralına takılıp sorguya dönerdi. Bu niyetler doğrudan
        // çalıştırılmaz; servis katmanı önce onay kartı üretir.
        if (ContainsAny(text, "hatirlatma gonder", "hatirlat", "uyari gonder") && ContainsAny(text, "evrak", "belge"))
            return AssistantIntent.SendDocumentReminder;
        if (ContainsAny(text, "veliye bildir", "veliyi bilgilendir", "veliye haber", "veliye mesaj"))
            return AssistantIntent.NotifyParentAboutAbsence;

        // Analitik özetler: tek öğrenciye değil kuruma bakan sorular. "kaç",
        // "toplam", "özet", "genel" gibi niceleyiciler bunları ayırır. Finans
        // özeti, borç LİSTESİNDEN (ListStudentsWithDebt) önce gelmeli ki
        // "toplam borç ne kadar" liste değil özet dönsün.
        if (ContainsAny(text, "tahsilat", "ciro", "gelir", "kasa")
            || (ContainsAny(text, "borc", "odeme") && ContainsAny(text, "toplam", "ne kadar", "genel", "ozet")))
            return AssistantIntent.GetFinanceOverview;
        if (ContainsAny(text, "kac kursiyer", "kac ogrenci", "kac mezun", "kac kisi", "kurum ozet", "genel durum", "istatistik", "ozet ver"))
            return AssistantIntent.GetInstitutionSummary;

        // Faz 2 niyetleri, daha genel sürücü kuralları TARAFINDAN YUTULMAMASI için
        // onlardan önce gelir: "randevu" kelimesi GetDrivingLessons'a düşüyordu,
        // "evrak"/"belge" ise hiçbir kurala uymayıp Unknown oluyordu.
        if (ContainsAny(text, "evrak", "belge", "dosya durum", "eksik belge", "saglik raporu", "adli sicil"))
            return AssistantIntent.GetDrivingDocuments;
        if (ContainsAny(text, "mezun", "sertifika", "belge almaya hak"))
            return AssistantIntent.GetDrivingGraduation;
        if (ContainsAny(text, "kitap", "kutuphane", "odunc", "iade tarihi"))
            return AssistantIntent.GetLibraryLoans;
        if (ContainsAny(text, "randevu", "yaklasan ders", "ne zaman dersim"))
            return AssistantIntent.GetDrivingAppointments;

        if (ContainsAny(text, "kurs ilerleme", "ders hakk", "kalan dakika", "surus ilerleme")) return AssistantIntent.GetDrivingProgress;
        if (ContainsAny(text, "direksiyon sinav", "e-sinav", "sinav durum")) return AssistantIntent.GetDrivingExamStatus;
        if (ContainsAny(text, "direksiyon ders", "surus ders")) return AssistantIntent.GetDrivingLessons;
        if (ContainsAny(text, "devamsiz", "yoklama", "gec kal")) return text.Contains("bugun") && !ContainsAny(text, "devamsizligim", "cocugum") ? AssistantIntent.ListAbsentStudents : AssistantIntent.GetAttendance;
        if (ContainsAny(text, "odev")) return AssistantIntent.GetHomework;
        if (ContainsAny(text, "ders program", "bugunku ders", "yarinki ders", "haftalik program")) return AssistantIntent.GetSchedule;
        if (ContainsAny(text, "duyuru")) return AssistantIntent.GetAnnouncements;
        if (ContainsAny(text, "mesaj")) return AssistantIntent.GetUnreadMessages;
        if (ContainsAny(text, "servis", "durak", "arac nerede", "bindi", "binmedi")) return AssistantIntent.GetTransportStatus;
        if (ContainsAny(text, "borc", "odeme", "taksit", "tahsilat")) return ContainsAny(text, "ogrenciler", "olanlar", "listele") ? AssistantIntent.ListStudentsWithDebt : AssistantIntent.GetPaymentSummary;
        if (ContainsAny(text, "ortalama")) return AssistantIntent.GetExamAverage;
        if (ContainsAny(text, "sinav", "not", "sonuc")) return text.Contains("altinda") ? AssistantIntent.ListLowScoreStudents : AssistantIntent.GetExamResults;
        if (grade.HasValue && ContainsAny(text, "sinif", "ogrenciler", "listele")) return AssistantIntent.ListClassStudents;
        if (tc is not null || studentNumber is not null || grade.HasValue || ContainsAny(text, "ogrenci", "kursiyer", "bul", "getir", "ara")) return AssistantIntent.SearchStudent;
        return AssistantIntent.Unknown;
    }

    private static string ExtractSearchText(string text)
    {
        var cleaned = NumberRegex().Replace(text, " ");
        cleaned = ClassRegex().Replace(cleaned, " ");
        foreach (var token in StopWords)
            cleaned = Regex.Replace(cleaned, $@"\b{Regex.Escape(token)}\w*\b", " ", RegexOptions.CultureInvariant);
        return MultiSpaceRegex().Replace(cleaned, " ").Trim();
    }

    private static bool ContainsAny(string text, params string[] terms) => terms.Any(text.Contains);
    private static string RemoveDiacritics(string value)
    {
        var map = new Dictionary<char, char> { ['ç']='c', ['ğ']='g', ['ı']='i', ['ö']='o', ['ş']='s', ['ü']='u' };
        var builder = new StringBuilder(value.Length);
        foreach (var c in value) builder.Append(map.TryGetValue(c, out var mapped) ? mapped : c);
        return builder.ToString();
    }

    private static readonly string[] StopWords = ["isimli", "adli", "ogrenci", "kursiyer", "bul", "getir", "ara", "goster", "listele", "devamsizlik", "sinav", "sonuc", "odev", "odeme", "durum", "ozet", "bilgi", "tc", "numarali", "sinif", "sube", "ders", "program", "cocugumun", "benim", "kendi", "son", "bugun", "yarin"];

    [GeneratedRegex(@"\s+")] private static partial Regex MultiSpaceRegex();
    [GeneratedRegex(@"(?<!\d)(\d{2,11})(?!\d)")] private static partial Regex NumberRegex();
    [GeneratedRegex(@"\b(\d{1,2})\s*(?:[.\-/ ]\s*)?(?:sinif\s*)?([a-z])(?:\s*subesi)?\b", RegexOptions.IgnoreCase)] private static partial Regex ClassRegex();
    [GeneratedRegex(@"(\d{1,3})\s*(?:puan(?:in)?|nin)?\s*altinda", RegexOptions.IgnoreCase)] private static partial Regex ScoreRegex();
}
