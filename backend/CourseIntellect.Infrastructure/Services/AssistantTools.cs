using System.Text.Json;
using System.Text.RegularExpressions;
using CourseIntellect.Application.DTOs.Assistant;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Ajanın araç kataloğu. Her araç bir niyete bağlıdır ve o niyetin kapısından (kurum türü, rol,
/// paket) geçen kullanıcıya gösterilir. Tek öğrenci ya da liste veren araçlar mevcut kartları
/// kullanır ve döngüyü bitirir (ikinci model çağrısı yok); analiz araçları rapor kartı üretir
/// ve model kısa bir yorum ekler.
/// </summary>
public sealed partial class AssistantService
{
    private const string NoArgs = """{"type":"object","properties":{}}""";
    private const string StudentArg = """{"type":"object","properties":{"student":{"type":"string","description":"Öğrencinin adı soyadı. Soruda ad yoksa boş bırak (seçili öğrenci ya da öğrencinin kendisi kullanılır)."}}}""";
    private const string ClassArg = """{"type":"object","properties":{"class_name":{"type":"string","description":"Sınıf adı, örn. 10-A. Belirtilmediyse boş bırak."}}}""";

    private IReadOnlyList<AgentTool> AgentTools() =>
    [
        new("student_summary", AssistantIntent.GetStudentSummary, "Bir öğrenciyi bulur ve kimlik kartını gösterir (ad, sınıf, numara). Öğrenci aramak için.", StudentArg,
            (s, a, ct) => StudentToolAsync(s, a, AssistantIntent.GetStudentSummary, ct)),
        new("student_attendance", AssistantIntent.GetAttendance, "TEK bir öğrencinin devamsızlık / yoklama durumu.", StudentArg,
            (s, a, ct) => StudentToolAsync(s, a, AssistantIntent.GetAttendance, ct)),
        new("student_exams", AssistantIntent.GetExamResults, "TEK bir öğrencinin son sınav sonuçları, notları ve ortalaması.", StudentArg,
            (s, a, ct) => StudentToolAsync(s, a, AssistantIntent.GetExamResults, ct)),
        new("student_homework", AssistantIntent.GetHomework, "Bir öğrencinin teslim etmediği (bekleyen) ödevleri, teslim tarihine göre sıralı. \"Ödevim ne\", \"bugün ödevim var mı\" soruları.", StudentArg,
            (s, a, ct) => StudentToolAsync(s, a, AssistantIntent.GetHomework, ct)),
        new("student_topics", AssistantIntent.GetTopicInsight, "Bir öğrencinin zayıf ve güçlü konuları, hangi konulara çalışması gerektiği.", StudentArg,
            (s, a, ct) => StudentToolAsync(s, a, AssistantIntent.GetTopicInsight, ct)),
        new("student_payment", AssistantIntent.GetPaymentSummary, "Bir öğrencinin taksit, ödeme ve kalan borç durumu.", StudentArg,
            (s, a, ct) => StudentToolAsync(s, a, AssistantIntent.GetPaymentSummary, ct)),
        new("student_library", AssistantIntent.GetLibraryLoans, "Öğrencinin üzerindeki kütüphane kitapları ve iade tarihleri.", StudentArg,
            (s, a, ct) => StudentToolAsync(s, a, AssistantIntent.GetLibraryLoans, ct)),
        new("student_transport", AssistantIntent.GetTransportStatus, "Öğrencinin servis güzergâhı, durağı ve aracı.", StudentArg,
            (s, a, ct) => StudentToolAsync(s, a, AssistantIntent.GetTransportStatus, ct)),
        new("student_report", AssistantIntent.GetStudentReport, "Bir öğrencinin bütün bilgilerini (devam, sınav, zayıf konular, ödev, ödeme) tek raporda toplar: öğrenci dosyası, veli görüşmesi notu, genel durum, PDF.", StudentArg,
            StudentReportAsync),
        new("schedule", AssistantIntent.GetSchedule, "Ders programı: bugünkü ve haftalık dersler.", StudentArg,
            ScheduleToolAsync),
        new("announcements", AssistantIntent.GetAnnouncements, "Kurumun duyuruları.", NoArgs,
            AnnouncementsToolAsync),
        new("class_students", AssistantIntent.ListClassStudents, "Bir sınıftaki öğrencilerin listesi.", ClassArg,
            (s, a, ct) => ListToolAsync(s, a, AssistantIntent.ListClassStudents, ct)),
        new("absent_today", AssistantIntent.ListAbsentStudents, "BUGÜN devamsız olan öğrencilerin listesi.", NoArgs,
            (s, a, ct) => ListToolAsync(s, a, AssistantIntent.ListAbsentStudents, ct)),
        new("low_score_students", AssistantIntent.ListLowScoreStudents, "Belirli bir puanın altında sınav sonucu olan öğrencilerin listesi.",
            """{"type":"object","properties":{"threshold":{"type":"integer","description":"Puan sınırı, varsayılan 50"}}}""",
            (s, a, ct) => ListToolAsync(s, a, AssistantIntent.ListLowScoreStudents, ct)),
        new("debt_list", AssistantIntent.ListStudentsWithDebt, "Borcu olan öğrencilerin listesi.", NoArgs,
            (s, a, ct) => ListToolAsync(s, a, AssistantIntent.ListStudentsWithDebt, ct)),
        new("attendance_ranking", AssistantIntent.GetAttendanceRanking, "Belirli bir dönemde (son N gün) EN ÇOK devamsızlık yapan öğrencilerin sıralaması.",
            """{"type":"object","properties":{"days":{"type":"integer","description":"Kaç günlük dönem; bu ay için 30, bu hafta için 7"},"top":{"type":"integer","description":"Kaç öğrenci, varsayılan 10"},"class_name":{"type":"string","description":"Sınıf adı, örn. 10-A; tüm sınıflar için boş"}}}""",
            AttendanceRankingAsync),
        new("exam_trend", AssistantIntent.GetExamTrend, "Son denemelerde / sınavlarda ders bazlı net ya da puan EĞİLİMİ (artış, düşüş) — bir sınıf ya da bir öğrenci için.",
            """{"type":"object","properties":{"class_name":{"type":"string","description":"Sınıf adı, örn. 10-A"},"student":{"type":"string","description":"Öğrenci adı (sınıf yerine tek öğrenci için)"},"subject":{"type":"string","description":"Ders adı, örn. Matematik; tüm dersler için boş"},"last_n":{"type":"integer","description":"Son kaç sınav, varsayılan 5"}}}""",
            ExamTrendAsync),
        new("compare_classes", AssistantIntent.CompareClasses, "Sınıfları birbiriyle KIYASLAR: sınav ortalaması, devamsızlık oranı ya da ödev teslim oranı.",
            """{"type":"object","properties":{"metric":{"type":"string","enum":["exam","attendance","homework"],"description":"exam=sınav ortalaması, attendance=devamsızlık, homework=ödev teslimi"},"grade":{"type":"integer","description":"Yalnız bu sınıf seviyesi, örn. 9; hepsi için boş"}},"required":["metric"]}""",
            CompareClassesAsync),
        new("at_risk_students", AssistantIntent.GetAtRiskStudents, "Erken uyarı: devamsızlığı artan, notu düşen ya da ödevleri geciken, risk altındaki öğrenciler.", ClassArg,
            AtRiskAsync),
        new("class_overview", AssistantIntent.GetClassOverview, "TEK bir sınıfın genel durumu: mevcut, devam oranı, sınav ortalaması, ödevler ve risk altındakiler.",
            """{"type":"object","properties":{"class_name":{"type":"string","description":"Sınıf adı, örn. 10-A"}},"required":["class_name"]}""",
            ClassOverviewAsync),
        new("finance_overview", AssistantIntent.GetFinanceOverview, "Bu ayın kısa tahsilat ve açık borç özeti.", NoArgs,
            FinanceOverviewToolAsync),
        new("finance_report", AssistantIntent.GetFinanceReport, "Ayrıntılı finans raporu: bir ayın tahsilat dökümü (ödeme yöntemine göre), iadeler, gecikmiş taksitlerin yaşlandırması ve en yüksek borçlar.",
            """{"type":"object","properties":{"month":{"type":"string","description":"Ay, YYYY-MM biçiminde (örn. 2026-10); bu ay için boş"}}}""",
            FinanceReportAsync),
        new("institution_summary", AssistantIntent.GetInstitutionSummary, "Kurum geneli kısa sayım özeti (toplam öğrenci, bugün devamsız).", NoArgs,
            InstitutionSummaryToolAsync),
        new("search_guide", AssistantIntent.HowTo, "Uygulamada bir işlemin NASIL yapılacağını ya da bir sayfanın NEREDE olduğunu anlatan rehber.",
            """{"type":"object","properties":{"query":{"type":"string","description":"Aranan işlem, örn. yoklama alma"}},"required":["query"]}""",
            GuideToolAsync),
        new("out_of_scope", AssistantIntent.OutOfScope, "Soru bu okul uygulamasıyla ilgili DEĞİLSE: genel kültür, ders sorusu çözme, kod yazma, hava durumu, gündem, kişisel sohbet.", NoArgs,
            OutOfScopeToolAsync),
    ];

    /// <summary>Kullanıcının rolüne, kurum türüne ve paketine açık araçlar. Model yalnız bunları görür.</summary>
    private async Task<IReadOnlyList<AgentTool>> AvailableToolsAsync(AssistantRequestContext context, CancellationToken ct)
    {
        var result = new List<AgentTool>();
        foreach (var tool in AgentTools())
            if (await CanAsync(context, tool.Intent, ct)) result.Add(tool);
        return result;
    }

    // ── Hedef çözümü ────────────────────────────────────────────────────────

    /// <summary>
    /// Araç argümanındaki öğrenci, kullanıcının erişebildiği öğrenciler içinde çözülür
    /// (<see cref="ResolveTargetAsync"/>). Öğrenci portalında argüman yok sayılır: kullanıcının
    /// kendi cümlesi denetlenir, başka öğrenci adı geçiyorsa reddedilir. Birden çok eşleşme,
    /// eşleşmeme ve ret döngüyü bitiren kartlardır.
    /// </summary>
    private async Task<(StudentCandidate? Student, ToolOutcome? Stop)> AgentStudentAsync(AgentState state, JsonElement args, AssistantIntent intent, CancellationToken ct)
    {
        var voice = state.Voice;
        var named = voice.Portal == "student" ? string.Empty : Str(args, "student");
        var folded = named.Length > 0 ? RuleBasedAssistantIntentResolver.Fold(named) : state.Folded;
        var query = state.Parsed with { Intent = intent };
        var selection = await ResolveTargetAsync(state.Context, query, folded, state.TargetId, true, voice, ct, state.FocusName);
        var conversationId = state.Conversation.Id;

        if (selection.Denied)
            return (null, new(string.Empty, Build(conversationId, "permission_denied", selection.Message, null, intent), true));
        if (selection.Candidates.Count > 1)
        {
            var cards = selection.Candidates.Select(StudentCard).ToList();
            return (null, new(string.Empty, Build(conversationId, "student_selection", voice.Portal == "parent" ? voice.ChooseChild() : voice.MultipleStudents(selection.Candidates.Count), new { items = cards }, intent), true));
        }
        if (selection.Candidates.Count == 0)
            return (null, new(string.Empty, Build(conversationId, "error", selection.NeedsName ? voice.AskWhichStudent() : voice.StudentNotFound(), null, intent), true));

        var student = selection.Candidates[0];
        state.Conversation.SelectedStudentId = student.Id;
        return (student, null);
    }

    /// <summary>
    /// Sınıf argümanı kullanıcının erişebildiği sınıflar içinde eşlenir: öğretmen yalnız derse
    /// girdiği sınıfları, yönetici ve idari kurumdaki bütün sınıfları görür. Boş argüman =
    /// erişilebilen bütün sınıflar. "10" gibi yalnız seviye yazılırsa o seviyedeki şubeler.
    /// </summary>
    private async Task<(IReadOnlyList<string> Classes, ToolOutcome? Stop)> AgentClassesAsync(AgentState state, string requested, CancellationToken ct)
    {
        var allowed = state.Voice.Portal == "teacher"
            ? await TeacherClassesAsync(state.Context, ct)
            : await db.Students.AsNoTracking().Where(x => x.ClassName != "").Select(x => x.ClassName).Distinct().ToListAsync(ct);
        allowed = allowed.Where(name => !string.IsNullOrWhiteSpace(name)).OrderBy(name => name).ToList();
        if (requested.Length == 0) return (allowed, null);

        var wanted = NormalizeClass(requested);
        var matched = allowed.Where(name => NormalizeClass(name) == wanted).ToList();
        if (matched.Count == 0 && Regex.IsMatch(wanted, @"^\d+$"))
            matched = allowed.Where(name => NormalizeClass(name).StartsWith(wanted + "-", StringComparison.Ordinal)).ToList();
        if (matched.Count > 0) return (matched, null);

        var text = state.Voice.ClassNotFound(requested, allowed);
        return (allowed, new(string.Empty, Build(state.Conversation.Id, "error", text, null, AssistantIntent.Unknown), true));
    }

    /// <summary>"10/A", "10 a", "10a", "10-A sınıfı" → "10-a".</summary>
    internal static string NormalizeClass(string value)
    {
        var folded = RuleBasedAssistantIntentResolver.Fold(value);
        folded = Regex.Replace(folded, @"\b(sinifi|sinifinin|sinif|subesi|sube)\b", " ");
        folded = Regex.Replace(folded, @"[\s/._]+", "-").Trim('-');
        folded = Regex.Replace(folded, @"^(\d+)-?([a-z]+)$", "$1-$2");
        return folded;
    }

    // ── Mevcut kartları kullanan araçlar ────────────────────────────────────

    private async Task<ToolOutcome> StudentToolAsync(AgentState state, JsonElement args, AssistantIntent intent, CancellationToken ct)
    {
        var (student, stop) = await AgentStudentAsync(state, args, intent, ct);
        if (stop is not null) return stop;
        var card = await ExecuteStudentIntentAsync(state.Context, state.Conversation.Id, intent, student!, state.Voice, ct);
        return new(ForModel(card), card, true);
    }

    private async Task<ToolOutcome> ScheduleToolAsync(AgentState state, JsonElement args, CancellationToken ct)
    {
        if (state.Voice.Portal == "teacher" && Str(args, "student").Length == 0)
        {
            var me = new StudentCandidate(Guid.Empty, Guid.Empty, state.Context.Principal.FindFirst("name")?.Value ?? "Öğretmen", string.Empty, string.Empty, string.Empty);
            var own = await ScheduleAsync(state.Context, state.Conversation.Id, me, state.Voice, ct);
            return new(ForModel(own), own, true);
        }
        return await StudentToolAsync(state, args, AssistantIntent.GetSchedule, ct);
    }

    private async Task<ToolOutcome> AnnouncementsToolAsync(AgentState state, JsonElement args, CancellationToken ct)
    {
        if (state.Voice.Portal is "student" or "parent")
            return await StudentToolAsync(state, args, AssistantIntent.GetAnnouncements, ct);
        var card = await AnnouncementsAsync(state.Context, state.Conversation.Id, null, state.Voice, ct);
        return new(ForModel(card), card, true);
    }

    private async Task<ToolOutcome> ListToolAsync(AgentState state, JsonElement args, AssistantIntent intent, CancellationToken ct)
    {
        var parsed = state.Parsed with { Intent = intent };
        var requested = Str(args, "class_name");
        if (requested.Length > 0)
        {
            var (classes, stop) = await AgentClassesAsync(state, requested, ct);
            if (stop is not null) return stop;
            var match = Regex.Match(classes[0], @"^(\d+)\s*[-/ ]?\s*([A-Za-zÇĞİÖŞÜçğıöşü]+)$");
            if (match.Success) parsed = parsed with { GradeLevel = int.Parse(match.Groups[1].Value), SectionName = match.Groups[2].Value.ToUpperInvariant() };
        }
        if (Int(args, "threshold") is int threshold) parsed = parsed with { ScoreThreshold = Math.Clamp(threshold, 1, 100) };
        var card = await ExecuteListAsync(state.Context, state.Conversation.Id, parsed, state.Voice, ct);
        return new(ForModel(card), card, true);
    }

    private async Task<ToolOutcome> FinanceOverviewToolAsync(AgentState state, JsonElement args, CancellationToken ct)
    {
        var card = await FinanceOverviewAsync(state.Conversation.Id, state.Voice, ct);
        return new(ForModel(card), card, true);
    }

    private async Task<ToolOutcome> InstitutionSummaryToolAsync(AgentState state, JsonElement args, CancellationToken ct)
    {
        var card = await InstitutionSummaryAsync(state.Conversation.Id, state.Voice, ct);
        return new(ForModel(card), card, true);
    }

    /// <summary>
    /// Model "kapsam dışı" dese de soru bu portalın bir ekranına karşılık geliyorsa ("bugün yemekte
    /// ne var" → Yemekhane) rehber cevabı verilir; gerçekten ilgisizse kapsam dışı.
    /// </summary>
    private async Task<ToolOutcome> OutOfScopeToolAsync(AgentState state, JsonElement args, CancellationToken ct)
    {
        var (article, otherPortal) = AssistantHelpCatalog.Match(state.Folded, state.Voice.Portal);
        if (article is not null && !otherPortal)
            return new(string.Empty, await HowToAsync(state.Context, state.Conversation.Id, state.Folded, state.Voice, ct), true);
        return new(string.Empty, OutOfScopeCard(state), true);
    }

    /// <summary>Rehber cevabı adımları olduğu gibi verir; model yorum yazmaz (adım uydurmasın).</summary>
    private async Task<ToolOutcome> GuideToolAsync(AgentState state, JsonElement args, CancellationToken ct)
    {
        var query = Str(args, "query");
        var folded = RuleBasedAssistantIntentResolver.Fold(query.Length > 0 ? $"{query} {state.Message}" : state.Message);
        var card = await HowToAsync(state.Context, state.Conversation.Id, folded, state.Voice, ct);
        return new(ForModel(card), card, true);
    }
}
