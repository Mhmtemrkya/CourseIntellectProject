using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Services;

/// <summary>
/// Bir asistan niyetinin kapsamı: hangi kurum türlerinde anlamlı, hangi modül
/// yetkisini ve hangi PORTALLARIN (rollerin) kullanabileceği.
/// </summary>
/// <param name="InstitutionTypes">
/// Boş küme = her kurumda geçerli (selam, yardım gibi). Aksi hâlde yalnız
/// listelenen kurum türlerinde önerilir ve çalıştırılır.
/// </param>
/// <param name="RequiredModule">
/// <c>IEntitlementService</c> modül anahtarı. Null ise paket kontrolü yapılmaz.
/// </param>
/// <param name="AllowedRoles">
/// Bu niyeti kullanabilen portallar (küçük harf: admin, administrative, teacher,
/// accounting, parent, student). İZİN LİSTESİDİR: listede olmayan rol kullanamaz
/// (eski "yasak listesi" yeni ya da unutulan bir rolü varsayılan olarak serbest bırakıyordu).
/// Şube müdürü admin, rehber öğretmen teacher portalını kullanır.
/// </param>
public sealed record AssistantIntentScope(
    IReadOnlySet<InstitutionType> InstitutionTypes,
    string? RequiredModule,
    IReadOnlySet<string> AllowedRoles);

public static class AssistantIntentCatalog
{
    /// <summary>Okul benzeri kurumlar: akademik takvim, sınıf, ödev, sınav düzeni ortak.</summary>
    public static readonly IReadOnlySet<InstitutionType> AcademicInstitutions =
        new HashSet<InstitutionType> { InstitutionType.PrivateSchool, InstitutionType.CourseCenter, InstitutionType.StudyCenter };

    /// <summary>Yalnız sürücü kursu.</summary>
    public static readonly IReadOnlySet<InstitutionType> Driving =
        new HashSet<InstitutionType> { InstitutionType.DrivingSchool };

    /// <summary>Kurum türünden bağımsız (selam, yardım, öğrenci arama, finans).</summary>
    private static readonly IReadOnlySet<InstitutionType> Any = new HashSet<InstitutionType>();

    // Portal (rol) kümeleri. Her rol yalnız kendi portalındaki bilgileri sorabilir.
    private static IReadOnlySet<string> Roles(params string[] roles) => new HashSet<string>(roles);
    private static readonly IReadOnlySet<string> Everyone = Roles("admin", "administrative", "teacher", "accounting", "parent", "student");
    // Öğrenci dosyasına bakabilenler: öğrenci kendini, veli çocuğunu, personel kapsamındaki öğrencileri.
    private static readonly IReadOnlySet<string> StudentFile = Roles("admin", "administrative", "teacher", "accounting", "parent", "student");
    // Akademik (sınav, ödev, konu): muhasebe ve idari portal kapsamı dışı (KVKK: görev gereği değil).
    private static readonly IReadOnlySet<string> Academic = Roles("admin", "teacher", "parent", "student");
    private static readonly IReadOnlySet<string> AttendanceView = Roles("admin", "administrative", "teacher", "parent", "student");
    private static readonly IReadOnlySet<string> StaffLists = Roles("admin", "administrative", "teacher");
    private static readonly IReadOnlySet<string> AcademicLists = Roles("admin", "teacher");
    // Tek öğrencinin ödemesi: öğretmen ve idari portalda finans yok.
    private static readonly IReadOnlySet<string> PaymentView = Roles("admin", "accounting", "parent", "student");
    private static readonly IReadOnlySet<string> FinanceStaff = Roles("admin", "accounting");
    private static readonly IReadOnlySet<string> Management = Roles("admin");
    private static readonly IReadOnlySet<string> Operations = Roles("admin", "administrative", "parent", "student");
    private static readonly IReadOnlySet<string> LibraryView = Roles("admin", "administrative", "teacher", "parent", "student");
    private static readonly IReadOnlySet<string> ScheduleView = Roles("admin", "administrative", "teacher", "parent", "student");
    private static readonly IReadOnlySet<string> ParentNotify = Roles("admin", "administrative", "teacher");
    private static readonly IReadOnlySet<string> DrivingView = Roles("admin", "administrative", "teacher", "parent", "student");

    private static readonly IReadOnlyDictionary<AssistantIntent, AssistantIntentScope> Scopes =
        new Dictionary<AssistantIntent, AssistantIntentScope>
        {
            // ─── Kurum türünden bağımsız ──────────────────────────────────────
            [AssistantIntent.Unknown] = new(Any, null, Everyone),
            [AssistantIntent.Help] = new(Any, null, Everyone),
            [AssistantIntent.Greeting] = new(Any, null, Everyone),
            [AssistantIntent.Thanks] = new(Any, null, Everyone),
            [AssistantIntent.SmallTalk] = new(Any, null, Everyone),
            [AssistantIntent.HowTo] = new(Any, null, Everyone),

            // Öğrenci/kursiyer arama her kurumda var; muhasebe de tahsilat için arar.
            [AssistantIntent.SearchStudent] = new(Any, "students", StudentFile),
            [AssistantIntent.GetStudentSummary] = new(Any, "students", StudentFile),
            [AssistantIntent.OpenStudentDetail] = new(Any, "students", StudentFile),
            [AssistantIntent.GetAnnouncements] = new(Any, "notifications", Everyone),
            [AssistantIntent.GetUnreadMessages] = new(Any, "chat", Everyone),

            // Finans her kurumda; öğretmen göremez.
            [AssistantIntent.GetPaymentSummary] = new(Any, "finance", PaymentView),
            [AssistantIntent.ListStudentsWithDebt] = new(Any, "finance", FinanceStaff),

            // ─── Yalnız okul/dershane ─────────────────────────────────────────
            // Muhasebe rolü akademik veriye erişemez (KVKK: görev gereği değil).
            [AssistantIntent.GetAttendance] = new(AcademicInstitutions, "attendance", AttendanceView),
            [AssistantIntent.ListAbsentStudents] = new(AcademicInstitutions, "attendance", StaffLists),
            [AssistantIntent.GetExamResults] = new(AcademicInstitutions, "exams", Academic),
            [AssistantIntent.GetExamAverage] = new(AcademicInstitutions, "exams", Academic),
            [AssistantIntent.GetUpcomingExams] = new(AcademicInstitutions, "exams", Academic),
            [AssistantIntent.ListLowScoreStudents] = new(AcademicInstitutions, "exams", AcademicLists),
            [AssistantIntent.GetHomework] = new(AcademicInstitutions, "assignments", Academic),
            [AssistantIntent.GetSchedule] = new(AcademicInstitutions, "schedule", ScheduleView),
            [AssistantIntent.ListClassStudents] = new(AcademicInstitutions, "students", StaffLists),
            // Servis (okul taşıtı) sürücü kursunda yok — kursun aracı öğrenci taşımaz.
            [AssistantIntent.GetTransportStatus] = new(AcademicInstitutions, "service", Operations),

            // ─── Yalnız sürücü kursu ──────────────────────────────────────────
            [AssistantIntent.GetDrivingLessons] = new(Driving, "schedule", DrivingView),
            [AssistantIntent.GetDrivingExamStatus] = new(Driving, "exams", DrivingView),
            [AssistantIntent.GetDrivingProgress] = new(Driving, "students", DrivingView),
            [AssistantIntent.GetDrivingDocuments] = new(Driving, "students", DrivingView),
            [AssistantIntent.GetDrivingAppointments] = new(Driving, "schedule", DrivingView),
            [AssistantIntent.GetDrivingGraduation] = new(Driving, "students", DrivingView),

            // ─── Yalnız okul/dershane ─────────────────────────────────────────
            [AssistantIntent.GetLibraryLoans] = new(AcademicInstitutions, "library", LibraryView),

            // ─── Analitik özetler (yönetici seviyesi, öğrenci hedefi yok) ─────
            // Finans özeti her kurumda, muhasebe de görebilir.
            [AssistantIntent.GetFinanceOverview] = new(Any, "finance", FinanceStaff),
            // Kurum panosu akademik/kursiyer sayımı içerir; muhasebe kapsam dışı.
            [AssistantIntent.GetInstitutionSummary] = new(Any, "students", Management),

            // ─── Yazma eylemleri ──────────────────────────────────────────────
            // Bildirim gönderme kursiyer/öğrenci dosyasına dokunduğu için
            // "students" modülüne ve öğretmen üstü rollere bağlı.
            [AssistantIntent.SendDocumentReminder] = new(Driving, "students", ParentNotify),
            [AssistantIntent.NotifyParentAboutAbsence] = new(AcademicInstitutions, "attendance", ParentNotify),
            // Konu analizi: personelden öğretmen/yönetici, öğrenci kendini, veli çocuğunu görür.
            [AssistantIntent.GetTopicInsight] = new(AcademicInstitutions, "student-insights", Academic),
            [AssistantIntent.OutOfScope] = new(Any, null, Everyone),

            // ─── Analiz ve rapor (yerel model ajanı) ──────────────────────────
            // Öğretmen yalnız ders verdiği sınıfları görür; kapsam araç yürütülürken uygulanır.
            [AssistantIntent.GetAttendanceRanking] = new(AcademicInstitutions, "attendance", StaffLists),
            // Eğilim: öğrenci kendininkini, veli çocuğununkini, personel kapsamındaki sınıf/öğrenciyi görür.
            [AssistantIntent.GetExamTrend] = new(AcademicInstitutions, "exams", Academic),
            [AssistantIntent.CompareClasses] = new(AcademicInstitutions, "exams", AcademicLists),
            [AssistantIntent.GetAtRiskStudents] = new(AcademicInstitutions, "exams", AcademicLists),
            [AssistantIntent.GetClassOverview] = new(AcademicInstitutions, "students", AcademicLists),
            [AssistantIntent.GetFinanceReport] = new(Any, "finance", FinanceStaff),
            // Öğrenci raporunun her bölümü kendi niyetinin kapısından ayrıca geçer (ödeme, sınav…).
            [AssistantIntent.GetStudentReport] = new(AcademicInstitutions, "students", Academic),
        };

    /// <summary>
    /// Veri değiştiren niyetler. Bunlar ASLA doğrudan çalıştırılmaz: asistan
    /// önce onay kartı üretir, kullanıcı onaylarsa yürütülür.
    ///
    /// Buraya eklenmeyen bir yazma niyeti onay kapısını atlar ve tek mesajla
    /// veri değiştirir — yeni eylem eklerken burası güncellenmeli.
    /// </summary>
    private static readonly IReadOnlySet<AssistantIntent> WriteActions = new HashSet<AssistantIntent>
    {
        AssistantIntent.SendDocumentReminder,
        AssistantIntent.NotifyParentAboutAbsence,
    };

    public static bool IsWriteAction(AssistantIntent intent) => WriteActions.Contains(intent);

    /// <summary>
    /// LLM'in seçebileceği niyetler ve kısa açıklamaları. Yerel modele yalnız bu
    /// liste ve kullanıcının cümlesi verilir; model bir etiket seçer.
    ///
    /// YAZMA EYLEMLERİ BİLEREK YOK: veri değiştiren bir işlemin bulanık çıkarımla
    /// değil, açık ifadeyle (kural anahtar kelimesi) tetiklenmesi gerekir. Ayrıca
    /// Greeting/Help/Unknown de yok — onları kural motoru zaten yakalar ve LLM'in
    /// "selam" için model çalıştırması gereksiz.
    /// </summary>
    public static readonly IReadOnlyDictionary<AssistantIntent, string> ClassifiableIntents =
        new Dictionary<AssistantIntent, string>
        {
            [AssistantIntent.SearchStudent] = "Bir öğrenciyi/kursiyeri adı, numarası veya TC'siyle bulmak",
            [AssistantIntent.GetAttendance] = "Bir öğrencinin devamsızlık/yoklama durumu",
            [AssistantIntent.GetExamResults] = "Bir öğrencinin sınav sonuçları veya notları",
            [AssistantIntent.GetExamAverage] = "Bir öğrencinin sınav ortalaması",
            [AssistantIntent.GetHomework] = "Bir öğrencinin ödevleri",
            [AssistantIntent.GetSchedule] = "Ders programı",
            [AssistantIntent.GetAnnouncements] = "Duyurular",
            [AssistantIntent.GetUnreadMessages] = "Okunmamış mesajlar",
            [AssistantIntent.GetPaymentSummary] = "Bir öğrencinin ödeme/borç durumu",
            [AssistantIntent.GetTransportStatus] = "Servis/taşıma durumu",
            [AssistantIntent.ListClassStudents] = "Bir sınıftaki öğrencilerin listesi",
            [AssistantIntent.ListAbsentStudents] = "Bugün devamsız olanların listesi",
            [AssistantIntent.ListLowScoreStudents] = "Belirli puanın altındakilerin listesi",
            [AssistantIntent.ListStudentsWithDebt] = "Borcu olan öğrencilerin listesi",
            [AssistantIntent.GetDrivingLessons] = "Direksiyon dersleri geçmişi",
            [AssistantIntent.GetDrivingExamStatus] = "Direksiyon/e-sınav durumu",
            [AssistantIntent.GetDrivingProgress] = "Kurs ilerlemesi, kalan ders hakkı",
            [AssistantIntent.GetDrivingDocuments] = "Kursiyerin evrak/belge durumu",
            [AssistantIntent.GetDrivingAppointments] = "Yaklaşan direksiyon randevuları",
            [AssistantIntent.GetDrivingGraduation] = "Mezuniyet ve sertifika durumu",
            [AssistantIntent.GetLibraryLoans] = "Öğrencinin üzerindeki kütüphane kitapları",
            [AssistantIntent.GetFinanceOverview] = "Kurum geneli tahsilat/borç özeti (tek öğrenci değil)",
            [AssistantIntent.GetInstitutionSummary] = "Kurum geneli sayım özeti (kaç öğrenci, kaç mezun)",
        };

    /// <summary>LLM'in döndürdüğü ham etiket geçerli bir sınıflanabilir niyet mi?</summary>
    public static bool TryParseClassifiable(string? raw, out AssistantIntent intent)
    {
        intent = AssistantIntent.Unknown;
        if (string.IsNullOrWhiteSpace(raw)) return false;
        return Enum.TryParse(raw.Trim(), ignoreCase: true, out intent)
               && ClassifiableIntents.ContainsKey(intent);
    }

    /// <summary>Onay kartında gösterilecek, ne olacağını açıkça anlatan metin.</summary>
    public static string WriteActionDescription(AssistantIntent intent, string subjectName) => intent switch
    {
        AssistantIntent.SendDocumentReminder =>
            $"{subjectName} adlı kursiyere eksik evrakları için hatırlatma bildirimi gönderilecek.",
        AssistantIntent.NotifyParentAboutAbsence =>
            $"{subjectName} adlı öğrencinin velisine devamsızlık bilgilendirmesi gönderilecek.",
        _ => "Bu işlem veri değiştirecek.",
    };

    /// <summary>Kataloğa girmemiş bir niyet hiçbir rol için açık değildir (fail-closed).</summary>
    private static readonly AssistantIntentScope Fallback = new(Any, null, new HashSet<string>());

    public static AssistantIntentScope ScopeOf(AssistantIntent intent) =>
        Scopes.TryGetValue(intent, out var scope) ? scope : Fallback;

    /// <summary>Bu niyet ilgili kurum türünde anlamlı mı? (Modül/rol kontrolü ayrıca yapılır.)</summary>
    public static bool IsAvailableFor(AssistantIntent intent, InstitutionType institutionType)
    {
        var scope = ScopeOf(intent);
        return scope.InstitutionTypes.Count == 0 || scope.InstitutionTypes.Contains(institutionType);
    }

    /// <summary>Bu portal (rol) bu niyeti kullanabilir mi? Şube müdürü yönetici portalını kullanır.</summary>
    public static bool IsAllowedForRole(AssistantIntent intent, string primaryRole) =>
        ScopeOf(intent).AllowedRoles.Contains(PortalOf(primaryRole));

    /// <summary>Rol adını portal anahtarına çevirir (branchmanager → admin, bilinmeyen → boş).</summary>
    public static string PortalOf(string? role) => (role ?? string.Empty).Trim().ToLowerInvariant() switch
    {
        "admin" or "branchmanager" or "developer" => "admin",
        "administrative" => "administrative",
        "teacher" or "counselor" => "teacher",
        "accounting" => "accounting",
        "parent" => "parent",
        "student" => "student",
        _ => string.Empty,
    };

    public static string? RequiredModule(AssistantIntent intent) => ScopeOf(intent).RequiredModule;

    /// <summary>
    /// Kurum türünün insan okunur adı — kapsam dışı mesajlarında kullanılır.
    /// </summary>
    public static string DisplayName(InstitutionType institutionType) => institutionType switch
    {
        InstitutionType.PrivateSchool => "okul",
        InstitutionType.CourseCenter => "dershane",
        InstitutionType.StudyCenter => "etüt merkezi",
        InstitutionType.DrivingSchool => "sürücü kursu",
        _ => "kurum",
    };
}
