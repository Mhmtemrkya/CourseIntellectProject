using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Services;

/// <summary>
/// Bir asistan niyetinin kapsamı: hangi kurum türlerinde anlamlı, hangi modül
/// yetkisini ve hangi rolleri gerektirir.
/// </summary>
/// <param name="InstitutionTypes">
/// Boş küme = her kurumda geçerli (selam, yardım gibi). Aksi hâlde yalnız
/// listelenen kurum türlerinde önerilir ve çalıştırılır.
/// </param>
/// <param name="RequiredModule">
/// <c>IEntitlementService</c> modül anahtarı. Null ise paket kontrolü yapılmaz.
/// </param>
/// <param name="DeniedRoles">
/// Bu niyeti kullanamayacak roller (küçük harf). Örn. öğretmen borç göremez.
/// </param>
public sealed record AssistantIntentScope(
    IReadOnlySet<InstitutionType> InstitutionTypes,
    string? RequiredModule,
    IReadOnlySet<string> DeniedRoles);

/// <summary>
/// Asistan niyetlerinin tek doğruluk kaynağı. Kurum türü, modül ve rol kapsamı
/// burada bildirilir; servis katmanı bu katalogdan okur.
///
/// NEDEN: Kapsam bilgisi önceden üç ayrı yere dağılmıştı — <c>RequiredModule</c>
/// switch'i, rol bazlı öneri switch'i ve servis içindeki tekil rol kontrolleri.
/// Kurum türü ise hiçbirinde yoktu; bu yüzden bir okul yöneticisine "Kursiyer
/// ilerlemesi" önerisi çıkıyordu. Tek katalog bunu yapısal olarak imkânsız kılar.
///
/// Aynı desen <see cref="CourseIntellect.Domain.Permissions.DrivingPermissionCatalog"/>
/// ile tutarlıdır.
/// </summary>
public static class AssistantIntentCatalog
{
    /// <summary>Okul benzeri kurumlar: akademik takvim, sınıf, ödev, sınav düzeni ortak.</summary>
    public static readonly IReadOnlySet<InstitutionType> Academic =
        new HashSet<InstitutionType> { InstitutionType.PrivateSchool, InstitutionType.CourseCenter, InstitutionType.StudyCenter };

    /// <summary>Yalnız sürücü kursu.</summary>
    public static readonly IReadOnlySet<InstitutionType> Driving =
        new HashSet<InstitutionType> { InstitutionType.DrivingSchool };

    /// <summary>Kurum türünden bağımsız (selam, yardım, öğrenci arama, finans).</summary>
    private static readonly IReadOnlySet<InstitutionType> Any = new HashSet<InstitutionType>();

    private static readonly IReadOnlySet<string> NoDeniedRoles = new HashSet<string>();
    private static readonly IReadOnlySet<string> DenyAccounting = new HashSet<string> { "accounting" };
    private static readonly IReadOnlySet<string> DenyTeacher = new HashSet<string> { "teacher" };
    // Analitik özetler tek öğrenciye değil tüm kuruma bakar; öğrenci/veli/öğretmen
    // görmemeli. Muhasebe finans özetini görebilir ama akademik panoyu görmez.
    private static readonly IReadOnlySet<string> DenyBelowFinance = new HashSet<string> { "student", "parent", "teacher" };
    private static readonly IReadOnlySet<string> DenyBelowManagement = new HashSet<string> { "student", "parent", "teacher", "accounting" };

    private static readonly IReadOnlyDictionary<AssistantIntent, AssistantIntentScope> Scopes =
        new Dictionary<AssistantIntent, AssistantIntentScope>
        {
            // ─── Kurum türünden bağımsız ──────────────────────────────────────
            [AssistantIntent.Unknown] = new(Any, null, NoDeniedRoles),
            [AssistantIntent.Help] = new(Any, null, NoDeniedRoles),
            [AssistantIntent.Greeting] = new(Any, null, NoDeniedRoles),

            // Öğrenci/kursiyer arama her kurumda var; muhasebe de tahsilat için arar.
            [AssistantIntent.SearchStudent] = new(Any, "students", NoDeniedRoles),
            [AssistantIntent.GetStudentSummary] = new(Any, "students", NoDeniedRoles),
            [AssistantIntent.OpenStudentDetail] = new(Any, "students", NoDeniedRoles),
            [AssistantIntent.GetAnnouncements] = new(Any, "notifications", NoDeniedRoles),
            [AssistantIntent.GetUnreadMessages] = new(Any, "chat", NoDeniedRoles),

            // Finans her kurumda; öğretmen göremez.
            [AssistantIntent.GetPaymentSummary] = new(Any, "finance", DenyTeacher),
            [AssistantIntent.ListStudentsWithDebt] = new(Any, "finance", DenyTeacher),

            // ─── Yalnız okul/dershane ─────────────────────────────────────────
            // Muhasebe rolü akademik veriye erişemez (KVKK: görev gereği değil).
            [AssistantIntent.GetAttendance] = new(Academic, "attendance", DenyAccounting),
            [AssistantIntent.ListAbsentStudents] = new(Academic, "attendance", DenyAccounting),
            [AssistantIntent.GetExamResults] = new(Academic, "exams", DenyAccounting),
            [AssistantIntent.GetExamAverage] = new(Academic, "exams", DenyAccounting),
            [AssistantIntent.GetUpcomingExams] = new(Academic, "exams", DenyAccounting),
            [AssistantIntent.ListLowScoreStudents] = new(Academic, "exams", DenyAccounting),
            [AssistantIntent.GetHomework] = new(Academic, "assignments", DenyAccounting),
            [AssistantIntent.GetSchedule] = new(Academic, "schedule", DenyAccounting),
            [AssistantIntent.ListClassStudents] = new(Academic, "students", DenyAccounting),
            // Servis (okul taşıtı) sürücü kursunda yok — kursun aracı öğrenci taşımaz.
            [AssistantIntent.GetTransportStatus] = new(Academic, "service", DenyAccounting),

            // ─── Yalnız sürücü kursu ──────────────────────────────────────────
            [AssistantIntent.GetDrivingLessons] = new(Driving, "schedule", DenyAccounting),
            [AssistantIntent.GetDrivingExamStatus] = new(Driving, "exams", DenyAccounting),
            [AssistantIntent.GetDrivingProgress] = new(Driving, "students", DenyAccounting),
            [AssistantIntent.GetDrivingDocuments] = new(Driving, "students", DenyAccounting),
            [AssistantIntent.GetDrivingAppointments] = new(Driving, "schedule", DenyAccounting),
            [AssistantIntent.GetDrivingGraduation] = new(Driving, "students", DenyAccounting),

            // ─── Yalnız okul/dershane ─────────────────────────────────────────
            [AssistantIntent.GetLibraryLoans] = new(Academic, "library", DenyAccounting),

            // ─── Analitik özetler (yönetici seviyesi, öğrenci hedefi yok) ─────
            // Finans özeti her kurumda, muhasebe de görebilir.
            [AssistantIntent.GetFinanceOverview] = new(Any, "finance", DenyBelowFinance),
            // Kurum panosu akademik/kursiyer sayımı içerir; muhasebe kapsam dışı.
            [AssistantIntent.GetInstitutionSummary] = new(Any, "students", DenyBelowManagement),

            // ─── Yazma eylemleri ──────────────────────────────────────────────
            // Bildirim gönderme kursiyer/öğrenci dosyasına dokunduğu için
            // "students" modülüne ve öğretmen üstü rollere bağlı.
            [AssistantIntent.SendDocumentReminder] = new(Driving, "students", DenyAccounting),
            [AssistantIntent.NotifyParentAboutAbsence] = new(Academic, "attendance", DenyAccounting),
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

    /// <summary>Onay kartında gösterilecek, ne olacağını açıkça anlatan metin.</summary>
    public static string WriteActionDescription(AssistantIntent intent, string subjectName) => intent switch
    {
        AssistantIntent.SendDocumentReminder =>
            $"{subjectName} adlı kursiyere eksik evrakları için hatırlatma bildirimi gönderilecek.",
        AssistantIntent.NotifyParentAboutAbsence =>
            $"{subjectName} adlı öğrencinin velisine devamsızlık bilgilendirmesi gönderilecek.",
        _ => "Bu işlem veri değiştirecek.",
    };

    /// <summary>Kataloğa girmemiş bir niyet varsayılan olarak her yerde ve serbesttir.</summary>
    private static readonly AssistantIntentScope Fallback = new(Any, null, NoDeniedRoles);

    public static AssistantIntentScope ScopeOf(AssistantIntent intent) =>
        Scopes.TryGetValue(intent, out var scope) ? scope : Fallback;

    /// <summary>Bu niyet ilgili kurum türünde anlamlı mı? (Modül/rol kontrolü ayrıca yapılır.)</summary>
    public static bool IsAvailableFor(AssistantIntent intent, InstitutionType institutionType)
    {
        var scope = ScopeOf(intent);
        return scope.InstitutionTypes.Count == 0 || scope.InstitutionTypes.Contains(institutionType);
    }

    /// <summary>Bu rol bu niyeti kullanabilir mi?</summary>
    public static bool IsAllowedForRole(AssistantIntent intent, string primaryRole) =>
        !ScopeOf(intent).DeniedRoles.Contains((primaryRole ?? string.Empty).ToLowerInvariant());

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
