using CourseIntellect.Application.DTOs.Assistant;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Asistanın sohbet katmanı: hedef öğrenciyi bulma, portal içi yardım, konu analizi,
/// role göre öneri ve takip soruları. Bütün metinler <see cref="AssistantVoice"/>'tan gelir.
/// </summary>
public sealed partial class AssistantService
{
    private AssistantVoice Voice(AssistantRequestContext context, Guid seed) => new(
        AssistantIntentCatalog.PortalOf(context.PrimaryRole),
        context.Principal.FindFirst("name")?.Value ?? string.Empty,
        context.Language == "en",
        seed,
        DateTime.UtcNow);

    private sealed record TargetSelection(IReadOnlyList<StudentCandidate> Candidates, bool Denied, string Message, string FailureCode, bool NeedsName);

    // Türkçe ad ekleri: "Ali'nin", "Aliyi", "Ayşe'ye" gibi. Katlanmış (aksansız) hâlleri.
    private static readonly string[] NameSuffixes =
        ["", "nin", "nun", "in", "un", "yi", "yu", "i", "u", "ye", "ya", "e", "a", "de", "da", "te", "ta", "den", "dan", "ten", "tan", "le", "la", "yle", "yla", "ler", "lar"];

    private static string[] Tokens(string folded) =>
        folded.Split([' ', ',', '.', '?', '!', '\'', '’', '"', ':', ';', '(', ')'], StringSplitOptions.RemoveEmptyEntries);

    /// <summary>Ad parçası mesajdaki bir kelimeyle (Türkçe ekiyle birlikte) eşleşiyor mu?</summary>
    private static bool NamePartMatches(string namePart, IReadOnlyList<string> tokens) =>
        namePart.Length >= 2 && tokens.Any(token =>
            token.StartsWith(namePart, StringComparison.Ordinal) && NameSuffixes.Contains(token[namePart.Length..]));

    /// <summary>
    /// Ad parçası mesajdaki bir kelimeyle 1–2 harf farkla (yazım hatası) eşleşiyor mu? Türkçe ek korunur
    /// ("Yılmz'ın", "Ahmt'in"). İlk harf tutmalı; 4 harften kısa ad parçalarında tolerans yok ("Ali", "Can").
    /// </summary>
    private static bool NamePartAlmostMatches(string namePart, IReadOnlyList<string> looseTokens)
    {
        if (namePart.Length < 4) return false;
        var limit = namePart.Length >= 8 ? 2 : 1;
        foreach (var token in looseTokens)
        {
            if (token[0] != namePart[0]) continue;
            for (var length = Math.Max(3, namePart.Length - limit); length <= Math.Min(token.Length, namePart.Length + limit); length++)
            {
                if (NameSuffixes.Contains(token[length..])
                    && AssistantSpelling.Distance(token.AsSpan(0, length), namePart, limit) <= limit)
                    return true;
            }
        }
        return false;
    }

    /// <summary>
    /// Mesajda adı geçen öğrenciler. Ad parçası birebir (ekiyle) geçiyorsa 2, yazım hatasıyla geçiyorsa 1
    /// puan; en yüksek puanlılar döner. Örn. "Ali Yılmaz" iki parçayla, yalnız "Ali" bir parçayla eşleşir;
    /// "Ahmet Yılmz" Ahmet'ler arasından Ahmet Yılmaz'ı öne çıkarır. Birebir eşleşme her zaman öne geçer.
    /// Asistanın anahtar kelimeleri ("sınav", "devamsızlık") ad sanılmaz: Sinan "sınav sonuçları"yla seçilmez.
    /// </summary>
    private static List<StudentCandidate> MatchByName(IReadOnlyList<StudentCandidate> roster, string folded)
    {
        var tokens = Tokens(folded);
        var looseTokens = tokens.Where(token => token.Length >= 3 && !token.Any(char.IsDigit) && !AssistantSpelling.IsVocabularyWord(token)).ToList();
        var scored = roster
            .Select(student => (Student: student, Score: Tokens(RuleBasedAssistantIntentResolver.Fold(student.FullName))
                .Sum(part => NamePartMatches(part, tokens) ? 2 : NamePartAlmostMatches(part, looseTokens) ? 1 : 0)))
            .Where(item => item.Score > 0)
            .ToList();
        if (scored.Count == 0) return [];
        var best = scored.Max(item => item.Score);
        return scored.Where(item => item.Score == best).Select(item => item.Student).Take(11).ToList();
    }

    /// <summary>
    /// Konuşmanın hedef öğrencisi. Kurallar portala göre:
    /// - Öğrenci: her zaman kendisi; mesaj başka bir öğrencinin adını içeriyorsa reddedilir.
    /// - Veli: yalnız kendi çocukları; tek çocuk varsa o, birden çoksa adına göre ya da seçim kartı.
    /// - Personel: yetki kapsamındaki öğrenciler (öğretmen yalnız ders verdiği sınıflar); TC, okul no
    ///   ya da ad ile; ad yoksa sohbetin seçili öğrencisi (takip sorusu: "peki devamsızlığı?").
    /// allowImplicit=false (niyet anlaşılmadıysa) iken yalnız açıkça adı geçen öğrenci döner.
    /// </summary>
    private async Task<TargetSelection> ResolveTargetAsync(AssistantRequestContext context, ParsedAssistantQuery query, string folded,
        Guid? selectedId, bool allowImplicit, AssistantVoice voice, CancellationToken ct, string? focusName = null)
    {
        var focusFolded = string.IsNullOrWhiteSpace(focusName) ? null : RuleBasedAssistantIntentResolver.Fold(focusName);
        bool IsFocus(StudentCandidate candidate) =>
            (selectedId is Guid id && (candidate.Id == id || candidate.UserId == id))
            || (focusFolded is not null && RuleBasedAssistantIntentResolver.Fold(candidate.FullName) == focusFolded);
        var portal = voice.Portal;

        if (portal == "student")
        {
            var own = await db.Students.AsNoTracking().Where(x => x.UserId == context.UserId).Select(ToStudentCandidate()).ToListAsync(ct);
            if (own.Count == 0) return new([], true, voice.StudentNotFound(), "STUDENT_PROFILE_NOT_FOUND", false);
            var others = await db.Students.AsNoTracking().Where(x => x.UserId != context.UserId).Select(ToStudentCandidate()).ToListAsync(ct);
            var mentioned = MatchByName(others, folded)
                .Where(other => Tokens(RuleBasedAssistantIntentResolver.Fold(other.FullName)).All(part => NamePartMatches(part, Tokens(folded))))
                .ToList();
            var mentionsSelf = MatchByName(own, folded).Count > 0;
            if (mentioned.Count > 0 && !mentionsSelf) return new([], true, voice.OtherStudentDenied(), "STUDENT_SELF_SCOPE", false);
            return allowImplicit || mentionsSelf ? new(own, false, string.Empty, string.Empty, false) : new([], false, string.Empty, string.Empty, false);
        }

        if (portal == "parent")
        {
            var children = await ParentChildrenAsync(context, ct);
            if (children.Count == 0) return new([], true, voice.StudentNotFound(), "PARENT_NO_CHILD", false);
            var named = MatchByName(children, folded);
            if (named.Count > 0) return new(named, false, string.Empty, string.Empty, false);
            if (!allowImplicit) return new([], false, string.Empty, string.Empty, false);
            var focused = children.Where(IsFocus).ToList();
            if (focused.Count == 1) return new(focused, false, string.Empty, string.Empty, false);
            return new(children, false, string.Empty, string.Empty, false);
        }

        var roster = await StaffRosterAsync(context, portal, ct);
        if (query.TcNo is not null) return new(roster.Where(x => x.TcNo == query.TcNo).Select(x => x.Candidate).ToList(), false, string.Empty, string.Empty, false);
        if (query.StudentNumber is not null)
        {
            var byNumber = roster.Where(x => x.Candidate.SchoolNumber == query.StudentNumber).Select(x => x.Candidate).ToList();
            if (byNumber.Count > 0) return new(byNumber, false, string.Empty, string.Empty, false);
        }

        var candidates = roster.Select(x => x.Candidate).ToList();
        var byName = MatchByName(candidates, folded);
        if (byName.Count > 0)
        {
            // Sınıf da yazıldıysa ("10-A'daki Ali") aynı adlılar arasında daralt.
            if (byName.Count > 1 && query.GradeLevel is int grade && query.SectionName is not null)
            {
                var className = $"{grade}-{query.SectionName}".ToLowerInvariant();
                var inClass = byName.Where(x => x.ClassName.Trim().ToLowerInvariant().Replace('/', '-') == className).ToList();
                if (inClass.Count > 0) byName = inClass;
            }
            return new(byName, false, string.Empty, string.Empty, false);
        }
        if (allowImplicit)
        {
            var previous = candidates.Where(IsFocus).Take(2).ToList();
            if (previous.Count == 1) return new(previous, false, string.Empty, string.Empty, false);
        }
        return new([], false, string.Empty, string.Empty, allowImplicit);
    }

    private sealed record RosterEntry(StudentCandidate Candidate, string TcNo);

    /// <summary>Personelin görebildiği öğrenciler (şube kapsamı sorgu filtresiyle uygulanır).</summary>
    private async Task<List<RosterEntry>> StaffRosterAsync(AssistantRequestContext context, string portal, CancellationToken ct)
    {
        var students = db.Students.AsNoTracking();
        var serviceDriverId = await db.ServiceDrivers.AsNoTracking().Where(x => x.UserId == context.UserId && x.IsActive).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(ct);
        if (serviceDriverId.HasValue)
        {
            var routeIds = db.ServiceRoutes.AsNoTracking().Where(x => x.DriverId == serviceDriverId && x.IsActive).Select(x => x.Id);
            var studentIds = db.StudentServiceAssignments.AsNoTracking().Where(x => x.IsActive && routeIds.Contains(x.RouteId)).Select(x => x.StudentId);
            students = students.Where(x => studentIds.Contains(x.Id));
        }
        if (portal == "teacher")
        {
            var classes = await TeacherClassesAsync(context, ct);
            students = students.Where(x => classes.Contains(x.ClassName));
        }
        return await students
            .Select(x => new RosterEntry(new StudentCandidate(x.Id, x.UserId, x.FullName, x.ClassName, x.SchoolNumber, x.PhotoUrl), x.TcNo))
            .ToListAsync(ct);
    }

    private Task<List<string>> TeacherClassesAsync(AssistantRequestContext context, CancellationToken ct) =>
        db.TeacherTimetableSlots.AsNoTracking().Where(x => x.TeacherUserId == context.UserId).Select(x => x.ClassName).Distinct().ToListAsync(ct);

    /// <summary>
    /// Velinin çocukları. Öncelik ParentUserId bağında; bağ kurulmamış eski kayıtlarda veli adı
    /// ya da e-postası eşleşir (rapor sayfalarındaki StudentScope ile aynı kural).
    /// </summary>
    // Veli e-postası kullanıcı adıyla birebir ya da "@" öncesiyle eşleşmeli ("içeriyor" değil;
    // kullanıcı adı "ali" olan veli e-postasında "ali" geçen her öğrenciyi görüyordu).
    private static bool ParentEmailMatches(string email, string username)
    {
        if (email.Length == 0) return false;
        if (email == username) return true;
        var at = email.IndexOf('@');
        return at > 0 && email[..at] == username;
    }

    private async Task<List<StudentCandidate>> ParentChildrenAsync(AssistantRequestContext context, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().Where(x => x.Id == context.UserId).Select(x => new { x.FullName, x.Username }).FirstOrDefaultAsync(ct);
        var parentName = RuleBasedAssistantIntentResolver.Fold(user?.FullName ?? string.Empty);
        var username = (user?.Username ?? string.Empty).Trim().ToLowerInvariant();
        var rows = await db.Students.AsNoTracking()
            .Select(x => new { Candidate = new StudentCandidate(x.Id, x.UserId, x.FullName, x.ClassName, x.SchoolNumber, x.PhotoUrl), x.ParentUserId, x.ParentName, x.ParentEmail })
            .ToListAsync(ct);
        return rows
            .Where(x => x.ParentUserId == context.UserId
                || (parentName.Length > 0 && RuleBasedAssistantIntentResolver.Fold(x.ParentName) == parentName)
                || (username.Length > 0 && ParentEmailMatches((x.ParentEmail ?? string.Empty).Trim().ToLowerInvariant(), username)))
            .Select(x => x.Candidate)
            .ToList();
    }

    // ── Yardım ──────────────────────────────────────────────────────────────

    private async Task<AssistantResponseDto> HowToAsync(AssistantRequestContext context, Guid conversationId, string folded, AssistantVoice voice, CancellationToken ct)
    {
        var (article, otherPortal) = AssistantHelpCatalog.Match(folded, voice.Portal);
        if (article is null)
        {
            return Build(conversationId, "text", voice.HowToNotFound(), null, AssistantIntent.HowTo,
                suggestions: await SuggestionLabelsAsync(context, voice, 4, ct));
        }
        if (otherPortal)
        {
            // Veri alanı "rehber var ama başka portalda" ayrımı içindir; cevaplanamayan sorular listesine düşmez.
            return Build(conversationId, "text", voice.HowToOtherPortal(article) + " " + voice.Intro(), new { otherPortal = true, id = article.Id }, AssistantIntent.HowTo,
                suggestions: await SuggestionLabelsAsync(context, voice, 3, ct));
        }
        var route = article.Routes[voice.Portal];
        return Build(conversationId, "how_to", voice.HowTo(article),
            new { id = article.Id, title = voice.English ? article.TitleEn : article.TitleTr, steps = voice.English ? article.StepsEn : article.StepsTr, route },
            AssistantIntent.HowTo,
            [new("navigate", voice.OpenPage(), route, null, null)]);
    }

    // ── Konu analizi ────────────────────────────────────────────────────────

    /// <summary>
    /// Zayıf konular ve sabit öneriler (deterministik analiz). Öğretmen notu (yapay zekâ taslağı)
    /// asistanda hiç gösterilmez; öğrenci/veli yalnız analiz ve teşhis kodunu görür.
    /// </summary>
    private async Task<AssistantResponseDto> TopicInsightAsync(Guid conversationId, StudentCandidate student, bool self, AssistantVoice voice, CancellationToken ct)
    {
        var insight = await insights.GetStudentAsync(student.UserId, ct);
        if (insight is null)
        {
            return Build(conversationId, "text", voice.TopicInsight(student.FullName, self, 0, [], []), null, AssistantIntent.GetTopicInsight);
        }
        var weak = insight.WeakTopics.Take(5).ToList();
        var strong = insight.StrongTopics.Take(5).ToList();
        return Build(conversationId, "topic_insight",
            voice.TopicInsight(student.FullName, self, insight.Solved, weak.Select(item => item.Topic).ToList(), strong.Select(item => item.Topic).ToList(),
                weak.FirstOrDefault()?.SuggestedQuestions) + FollowupSentence(voice, self, insight.Followups),
            new
            {
                studentId = student.Id,
                student.FullName,
                solved = insight.Solved,
                successRate = insight.SuccessRate,
                weakTopics = weak.Select(item => new
                {
                    item.Subject, item.Topic, item.SuccessRate, item.Diagnosis, item.Trend,
                    item.Priority, item.SuggestedQuestions, item.Solved, item.Wrong, item.Blank,
                }),
                strongTopics = strong.Select(item => new { item.Subject, item.Topic, item.SuccessRate }),
            },
            AssistantIntent.GetTopicInsight);
    }

    /// <summary>
    /// Önceki önerinin sonrası: ilerleme varsa söylenir (öneriye bağlanmadan, "o konuda ilerleme var").
    /// Ölçülemeyen ya da değişmeyen sonuçlar sohbette tekrarlanmaz; ayrıntı konu analizinde.
    /// </summary>
    private static string FollowupSentence(AssistantVoice voice, bool self, IReadOnlyList<Application.DTOs.Insights.RecommendationFollowupDto>? followups)
    {
        var best = followups?.Where(item => item.Status == "improved" && item.AfterSuccessRate is not null)
            .OrderByDescending(item => item.AfterSuccessRate - item.BaselineSuccessRate).FirstOrDefault();
        if (best is null) return string.Empty;
        string P(decimal value) => "%" + Math.Round(value).ToString("0", System.Globalization.CultureInfo.InvariantCulture);
        return voice.English
            ? $" Since the last recommendation, {best.Topic} has improved ({P(best.BaselineSuccessRate)} → {P(best.AfterSuccessRate!.Value)})."
            : self
                ? $" Geçen öneriden sonra {best.Topic} konusunda ilerleme var ({P(best.BaselineSuccessRate)} → {P(best.AfterSuccessRate!.Value)}), böyle devam!"
                : $" Geçen öneriden sonra {best.Topic} konusunda ilerleme var ({P(best.BaselineSuccessRate)} → {P(best.AfterSuccessRate!.Value)}).";
    }

    // ── Öneriler ────────────────────────────────────────────────────────────

    private sealed record SuggestionDef(string Tr, string En, string Command, string Category, AssistantIntent Intent);

    /// <summary>Portala göre öneri listesi (yalnız o portalın sorabildiği niyetler).</summary>
    private static IReadOnlyList<SuggestionDef> PortalSuggestions(string portal) => portal switch
    {
        "student" =>
        [
            new("Bugün hangi derslerim var?", "What lessons do I have today?", "schedule", "Akademik", AssistantIntent.GetSchedule),
            new("Bekleyen ödevlerim", "My pending homework", "homework", "Akademik", AssistantIntent.GetHomework),
            new("Sınav sonuçlarım", "My exam results", "exam", "Akademik", AssistantIntent.GetExamResults),
            new("Hangi konulara çalışmalıyım?", "Which topics should I study?", "topics", "Akademik", AssistantIntent.GetTopicInsight),
            new("Devamsızlığım", "My attendance", "attendance", "Akademik", AssistantIntent.GetAttendance),
            new("Üzerimdeki kitaplar", "My library books", "library", "Kütüphane", AssistantIntent.GetLibraryLoans),
            new("Ödevimi nasıl teslim ederim?", "How do I submit homework?", "howto", "Yardım", AssistantIntent.HowTo),
        ],
        "parent" =>
        [
            new("Çocuğumun devamsızlığı", "My child's attendance", "attendance", "Takip", AssistantIntent.GetAttendance),
            new("Son sınav sonuçları", "Latest exam results", "exam", "Takip", AssistantIntent.GetExamResults),
            new("Çalışması gereken konular", "Topics to study", "topics", "Takip", AssistantIntent.GetTopicInsight),
            new("Bekleyen ödevler", "Pending homework", "homework", "Takip", AssistantIntent.GetHomework),
            new("Ödeme durumu", "Payment status", "payment", "Finans", AssistantIntent.GetPaymentSummary),
            new("Servis bilgisi", "School bus info", "transport", "Servis", AssistantIntent.GetTransportStatus),
            new("Mazeret nasıl bildirilir?", "How do I report an absence?", "howto", "Yardım", AssistantIntent.HowTo),
        ],
        "teacher" =>
        [
            new("Bugünkü derslerim", "My lessons today", "schedule", "Ders", AssistantIntent.GetSchedule),
            new("Bugün devamsız olanlar", "Absent today", "absent", "Yoklama", AssistantIntent.ListAbsentStudents),
            new("50 puanın altındakiler", "Students below 50", "low_score", "Sınav", AssistantIntent.ListLowScoreStudents),
            new("Öğrenci ara", "Search a student", "search", "Öğrenci", AssistantIntent.SearchStudent),
            new("Optik deneme nasıl yüklenir?", "How do I upload an optical exam?", "howto", "Yardım", AssistantIntent.HowTo),
        ],
        "administrative" =>
        [
            new("Bugün devamsız olanlar", "Absent today", "absent", "Yoklama", AssistantIntent.ListAbsentStudents),
            new("Öğrenci ara", "Search a student", "search", "Öğrenci", AssistantIntent.SearchStudent),
            new("Duyurular", "Announcements", "announcements", "İletişim", AssistantIntent.GetAnnouncements),
            new("Ziyaretçi nasıl kaydedilir?", "How do I log a visitor?", "howto", "Yardım", AssistantIntent.HowTo),
            new("Kulüp nasıl açılır?", "How do I create a club?", "howto", "Yardım", AssistantIntent.HowTo),
        ],
        "accounting" =>
        [
            new("Borcu olan öğrenciler", "Students with debt", "debt", "Finans", AssistantIntent.ListStudentsWithDebt),
            new("Bu ay tahsilat", "Collections this month", "finance_overview", "Özet", AssistantIntent.GetFinanceOverview),
            new("Öğrenci ara", "Search a student", "search", "Finans", AssistantIntent.SearchStudent),
            new("Gün sonu nasıl kapatılır?", "How do I close the day?", "howto", "Yardım", AssistantIntent.HowTo),
        ],
        _ =>
        [
            new("Kurum özeti", "Institution summary", "institution_summary", "Özet", AssistantIntent.GetInstitutionSummary),
            new("Bu ay tahsilat", "Collections this month", "finance_overview", "Özet", AssistantIntent.GetFinanceOverview),
            new("Bugün devamsız olanlar", "Absent today", "absent", "Yoklama", AssistantIntent.ListAbsentStudents),
            new("Borcu olan öğrenciler", "Students with debt", "debt", "Finans", AssistantIntent.ListStudentsWithDebt),
            new("50 puanın altındakiler", "Students below 50", "low_score", "Sınav", AssistantIntent.ListLowScoreStudents),
            new("Öğrenci ara", "Search a student", "search", "Öğrenci", AssistantIntent.SearchStudent),
            new("Kulüp nasıl açılır?", "How do I create a club?", "howto", "Yardım", AssistantIntent.HowTo),
        ],
    };

    private async Task<IReadOnlyList<SuggestionDef>> AvailableSuggestionsAsync(AssistantRequestContext context, string portal, CancellationToken ct)
    {
        var institutionType = await ResolveInstitutionTypeAsync(context, ct);
        var result = new List<SuggestionDef>();
        foreach (var suggestion in PortalSuggestions(portal))
        {
            if (!AssistantIntentCatalog.IsAvailableFor(suggestion.Intent, institutionType)) continue;
            if (!AssistantIntentCatalog.IsAllowedForRole(suggestion.Intent, context.PrimaryRole)) continue;
            if (AssistantIntentCatalog.RequiredModule(suggestion.Intent) is { } module && !await entitlementService.IsAllowedAsync(context.Principal, module, "view", ct)) continue;
            result.Add(suggestion);
        }
        return result;
    }

    private async Task<IReadOnlyList<string>> SuggestionLabelsAsync(AssistantRequestContext context, AssistantVoice voice, int take, CancellationToken ct) =>
        (await AvailableSuggestionsAsync(context, voice.Portal, ct)).Take(take).Select(item => voice.English ? item.En : item.Tr).ToList();

    /// <summary>
    /// Bir cevaptan sonra sorulabilecek doğal takip soruları. Seçili öğrenci üzerinden çalışır
    /// ("peki sınav sonuçları?"). Yalnız bu portalın sorabildiği niyetler önerilir.
    /// </summary>
    private static IReadOnlyList<string> FollowUps(AssistantVoice voice, AssistantIntent answered, string role)
    {
        var self = voice.Portal == "student";
        var options = new (AssistantIntent Intent, string Tr, string En)[]
        {
            (AssistantIntent.GetAttendance, self ? "Devamsızlığım" : "Devamsızlığı", "Attendance"),
            (AssistantIntent.GetExamResults, self ? "Sınav sonuçlarım" : "Sınav sonuçları", "Exam results"),
            (AssistantIntent.GetTopicInsight, self ? "Hangi konulara çalışmalıyım?" : "Zayıf olduğu konular", self ? "Which topics should I study?" : "Weak topics"),
            (AssistantIntent.GetHomework, self ? "Bekleyen ödevlerim" : "Bekleyen ödevleri", "Pending homework"),
            (AssistantIntent.GetPaymentSummary, "Ödeme durumu", "Payment status"),
        };
        return options
            .Where(option => option.Intent != answered && AssistantIntentCatalog.IsAllowedForRole(option.Intent, role))
            .Take(3)
            .Select(option => voice.English ? option.En : option.Tr)
            .ToList();
    }
}
