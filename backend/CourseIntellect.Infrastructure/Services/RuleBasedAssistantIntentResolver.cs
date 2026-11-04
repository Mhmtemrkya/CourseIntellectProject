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
        var searchable = ExpandEnglish(RemoveDiacritics(normalized));
        var number = NumberRegex().Match(searchable);
        string? tc = null;
        string? studentNumber = null;
        // "50 puanın altında" gibi eşik sayıları öğrenci numarası sayılmaz.
        if (number.Success && ScoreRegex().IsMatch(searchable)) number = Match.Empty;
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

    /// <summary>Küçük harf + Türkçe harf katlama (ı→i, ş→s…); eşleştirme anahtarı.</summary>
    public static string Fold(string value) => RemoveDiacritics(Normalize(value));

    /// <summary>
    /// İngilizce arayüzde yazılan soruları anlamak için İngilizce ifadelerin Türkçe anahtar
    /// karşılıkları metne eklenir (kural motoru Türkçe anahtarlarla çalışır).
    /// </summary>
    private static readonly (string English, string Turkish)[] EnglishKeywords =
    [
        ("who are you", "sen kimsin"), ("what can you do", "neler yapabilir"), ("how are you", "nasilsin"),
        ("how do i", "nasil "), ("how to", "nasil "), ("how can i", "nasil "), ("where is", "nerede bulur"),
        ("thank", "tesekkur"), ("bye", "gorusuruz"), ("hello", "merhaba"), (" hi ", "merhaba"), (" hey ", "merhaba"), ("good evening", "iyi aksamlar"), ("good morning", "gunaydin"),
        ("absent today", "bugun devamsiz olanlar"), ("attendance", "devamsiz"), ("absent", "devamsiz"),
        ("weak", "zayif"), ("topics", "hangi konu"), ("should i study", "calismaliyim"),
        ("exam", "sinav"), ("grade", "not"), ("result", "sonuc"), ("average", "ortalama"),
        ("homework", "odev"), ("assignment", "odev"), ("timetable", "ders program"), ("schedule", "ders program"), ("lessons", "derslerim"),
        ("announcement", "duyuru"), ("message", "mesaj"), ("bus", "servis"), ("payment", "odeme"), ("debt", "borc"),
        ("collection", "tahsilat"), ("revenue", "tahsilat"), ("summary", "kurum ozet"), ("library", "kitap"), ("book", "kitap"),
        ("below", "altinda"), ("class", "sinif"), ("students", "ogrenciler"), ("who", "kimler"), ("list", "listele"), ("today", "bugun"),
    ];

    private static string ExpandEnglish(string text)
    {
        // Kısa kelimeler ("hi") başka kelimenin içinde ("this") eşleşmesin diye kenarlar boşlukla doldurulur.
        var padded = $" {text.TrimEnd('!', '?', '.', ',')} ";
        var extra = EnglishKeywords.Where(pair => padded.Contains(pair.English, StringComparison.Ordinal)).Select(pair => pair.Turkish).ToList();
        // Karşılıklar başa eklenir: sona eklenen "nasil" cümleyi "... nasıl" durum sorusu gibi gösteriyordu.
        return extra.Count == 0 ? text : string.Join(' ', extra) + " " + text;
    }

    public static string Normalize(string value) => MultiSpaceRegex().Replace((value ?? string.Empty).Trim().ToLower(new CultureInfo("tr-TR")), " ");

    private static AssistantIntent ResolveIntent(string text, string? tc, string? studentNumber, int? grade)
    {
        // Sıra önemlidir: "Merhaba, Ali'nin notları" bir veri sorusudur, selam değil.
        // Önce yazma eylemleri, sonra "nasıl yapılır", sonra veri soruları, en son sohbet.

        // Yazma eylemleri EN ÖNDE: "evrak hatırlatması gönder" cümlesi aksi hâlde
        // "evrak" kuralına takılıp sorguya dönerdi. Bu niyetler doğrudan
        // çalıştırılmaz; servis katmanı önce onay kartı üretir.
        if (ContainsAny(text, "hatirlatma gonder", "hatirlat", "uyari gonder") && ContainsAny(text, "evrak", "belge"))
            return AssistantIntent.SendDocumentReminder;
        if (ContainsAny(text, "veliye bildir", "veliyi bilgilendir", "veliye haber", "veliye mesaj")
            || (ContainsAny(text, "velisine", "veliye") && ContainsAny(text, "devamsiz") && ContainsAny(text, "bildir", "gonder", "mesaj", "haber", "bilgilendir")))
            return AssistantIntent.NotifyParentAboutAbsence;

        // "8B sınıfı nasıl gidiyor" sohbet değil, sınıfın durum sorusudur.
        if (grade.HasValue && ContainsAny(text, "nasil gidiyor", "genel durum")) return AssistantIntent.GetClassOverview;

        // Sohbet kalıpları "nasıl" içerdiği için yardım sorusundan önce ayıklanır.
        if (AssistantSmallTalk.Early(text) != SocialKind.None) return AssistantIntent.SmallTalk;

        // "... nasıl yapılır / nerede / ne işe yarar": portal içi yardım makalesi.
        // Cümle "nasıl" ile BİTİYORSA ("kızımın devamsızlığı nasıl") bu bir durum
        // sorusudur, yardım değil; veri kurallarına bırakılır.
        var statusQuestion = text.TrimEnd('?', '.', '!', ' ').EndsWith("nasil", StringComparison.Ordinal);
        // "programım nedir", "notlarım nedir": kişinin kendi verisi sorulur, yardım makalesi değil.
        var personalData = ContainsAny(text, "programim", "derslerim", "notlarim", "odevlerim", "borcum", "devamsizligim", "sinavlarim");
        if (!statusQuestion && !personalData && ContainsAny(text, "nasil ", "ne ise yarar", "nedir", "nereden ", "nerede bulur", "nereye ", "yardim et", "ogret"))
            return AssistantIntent.HowTo;
        if (text.TrimEnd('?', '.', '!', ' ').EndsWith("nerede", StringComparison.Ordinal) && !ContainsAny(text, "servis", "arac"))
            return AssistantIntent.HowTo;

        // Konu analizi: zayıf konular ve çalışma önerisi.
        if (ContainsAny(text, "zayif", "zorland", "hangi konu", "konulara", "konularda", "konularim", "calismaliyim", "calismam gereken", "eksik konu", "eksiklerim", "konu analiz", "neye calis"))
            return AssistantIntent.GetTopicInsight;

        // Analitik özetler: tek öğrenciye değil kuruma bakan sorular. "kaç",
        // "toplam", "özet", "genel" gibi niceleyiciler bunları ayırır. Finans
        // özeti, borç LİSTESİNDEN (ListStudentsWithDebt) önce gelmeli ki
        // "toplam borç ne kadar" liste değil özet dönsün.
        // Kişinin kendi borcu ("borcum ne kadar", "çocuğumun taksiti") kurum özetine değil ödeme durumuna gider.
        if (ContainsAny(text, "borcum", "borcumuz", "odemem", "odemelerim", "taksitim", "taksitlerim", "aidatim"))
            return AssistantIntent.GetPaymentSummary;
        // "gelir" tek başına aranmaz: "servis ne zaman gelir" bir gelir sorusu değildir.
        if (ContainsAny(text, "tahsilat", "ciro", "gelirimiz", "gelirler", "toplam gelir", "gelir gider", "kasa")
            || (ContainsAny(text, "borc", "odeme") && ContainsAny(text, "toplam", "ne kadar", "genel", "ozet")))
            return AssistantIntent.GetFinanceOverview;
        // Sınıf belirtilmişse "genel durum" sınıf özetidir; kurum özetine gitmesin.
        if (grade.HasValue && ContainsAny(text, "genel durum", "durumu", "nasil gidiyor", "ozeti"))
            return AssistantIntent.GetClassOverview;
        if (ContainsAny(text, "kac kursiyer", "kac ogrenci", "kac mezun", "kac kisi", "ogrenci sayisi", "toplam ogrenci", "kurum ozet", "genel durum", "istatistik", "ozet ver"))
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
        if (ContainsAny(text, "devamsiz", "yoklama", "gec kal", "kac gun yok", "gelmedi", "gelmeyen", "okula gitmis", "okula gitti", "okula gelmis", "okula geldi"))
            return ContainsAny(text, "bugun", "gelmeyen") && ContainsAny(text, "olanlar", "kimler", "listele", "gelmeyen", "ogrenciler") && !ContainsAny(text, "devamsizligim", "cocugum")
                ? AssistantIntent.ListAbsentStudents
                : AssistantIntent.GetAttendance;
        if (ContainsAny(text, "odev")) return AssistantIntent.GetHomework;
        if (ContainsAny(text, "ders program", "bugunku ders", "yarinki ders", "haftalik program", "derslerim", "dersim", "programim", "hangi ders", "ders var", "dersleri ne"))
            return AssistantIntent.GetSchedule;
        if (ContainsAny(text, "duyuru")) return AssistantIntent.GetAnnouncements;
        if (ContainsAny(text, "mesaj")) return AssistantIntent.GetUnreadMessages;
        if (ContainsAny(text, "servis", "durak", "arac nerede", "bindi", "binmedi")) return AssistantIntent.GetTransportStatus;
        if (ContainsAny(text, "borc", "odeme", "taksit", "tahsilat", "aidat", "ucret")) return ContainsAny(text, "ogrenciler", "olanlar", "listele", "kimler") ? AssistantIntent.ListStudentsWithDebt : AssistantIntent.GetPaymentSummary;
        // "50 puanın altındakiler": sınav kelimesi geçmese de puan eşiği listesidir (sayı öğrenci no değildir).
        if (ContainsAny(text, "puan") && ContainsAny(text, "altinda")) return AssistantIntent.ListLowScoreStudents;
        // "Düşük not alanlar" listedir; tek öğrencinin notu değil (eşik verilmezse servis 50 kullanır).
        if (ContainsAny(text, "dusuk not", "dusuk puan", "kotu not", "zayif not") && ContainsAny(text, "alan", "olan", "ogrenciler", "kimler", "listele"))
            return AssistantIntent.ListLowScoreStudents;
        if (ContainsAny(text, "ortalama")) return AssistantIntent.GetExamAverage;
        if (ContainsAny(text, "sinav", "not", "sonuc", "karne", "deneme")) return ScoreRegex().IsMatch(text) ? AssistantIntent.ListLowScoreStudents : AssistantIntent.GetExamResults;
        // "40 altındaki öğrenciler": puan kelimesi olmasa da eşik listesidir.
        if (ScoreRegex().IsMatch(text) && ContainsAny(text, "ogrenci", "olanlar", "alanlar", "kimler")) return AssistantIntent.ListLowScoreStudents;
        if (grade.HasValue && ContainsAny(text, "sinif", "ogrenciler", "listele", "kimler")) return AssistantIntent.ListClassStudents;
        if (tc is not null || studentNumber is not null || grade.HasValue || ContainsAny(text, "ogrenci", "kursiyer", "bul", "getir", "ara ", "kimdir")) return AssistantIntent.SearchStudent;

        // Sohbet: selam, teşekkür, veda, iltifat, özür, sitem, onay (veri sorusu yoksa).
        switch (AssistantSmallTalk.Late(text))
        {
            case SocialKind.Thanks or SocialKind.Farewell or SocialKind.WellWish: return AssistantIntent.Thanks;
            case SocialKind.Greeting: return AssistantIntent.Greeting;
            case SocialKind.None: break;
            default: return AssistantIntent.SmallTalk;
        }
        if (ContainsAny(text, "yardim", "komutlar", "ne sorabilirim")) return AssistantIntent.Help;
        // Yalnız bir ad yazılmışsa servis kişinin yetki kapsamındaki öğrencilerde arar.
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
    // "50 altında", "50 puanın altında", "45'in altında", "60 altı".
    [GeneratedRegex(@"(\d{1,3})\s*(?:puan(?:in)?|'?n?[iu]n)?\s*alti(?:nda\w*)?\b", RegexOptions.IgnoreCase)] private static partial Regex ScoreRegex();
}
