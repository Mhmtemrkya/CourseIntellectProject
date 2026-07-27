using static CourseIntellect.Domain.Permissions.DrivingPermissions;

namespace CourseIntellect.Domain.Permissions;

/// <summary>
/// Sürücü kursu rollerinin varsayılan izin setleri ve özel rol tavanları.
///
/// İki ayrı kavram vardır:
///   • <see cref="Defaults"/> — kullanıcının özel rolü YOKSA taban rolünden gelen izinler.
///   • <see cref="Ceilings"/> — kurum yöneticisi özel rol tanımlarken (ör. "Filo Sorumlusu")
///     seçebileceği izinlerin üst sınırı. Özel rol tavanı aşamaz; böylece kurum admini
///     bir sekretere override yetkisi veremez.
/// </summary>
public static class DrivingPermissionCatalog
{
    // Rol anahtarları — EntitlementService'in rol eşlemesiyle aynı dili konuşur.
    public const string Owner = "owner";
    public const string BranchManager = "branch_manager";
    public const string Secretary = "secretary";
    public const string Accounting = "accounting";
    public const string Fleet = "fleet";
    public const string DrivingInstructor = "driving_instructor";
    public const string TheoryInstructor = "theory_instructor";
    public const string Student = "student";

    /// <summary>Kurum sahibi: modülün tamamı, izin yönetimi ve override'lar dahil.</summary>
    private static readonly HashSet<string> OwnerSet = new(All, StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Şube yöneticisi: kendi şubesinin tüm operasyonu + override yetkileri. Kurum
    /// geneline dokunan üç şey hariç: izin yönetimi, kurum ayarları, paket kataloğu
    /// (paketler kurum genelidir; şube yöneticisi görür ama tanımlamaz).
    /// Veri izolasyonu ayrıca Branch query filter ile sağlanır.
    /// </summary>
    private static readonly HashSet<string> BranchManagerSet = new(
        All.Except([PermissionManage, SettingsManage, PackageCreate, PackageUpdate, PackageDelete], StringComparer.OrdinalIgnoreCase),
        StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Sekreter: ön kayıt, öğrenci kaydı, evrak, randevu ve kasa tahsilatı.
    /// Bilerek YOK: genel finans raporları, indirim/iade, filo müdahalesi, override.
    /// </summary>
    private static readonly HashSet<string> SecretarySet = new(StringComparer.OrdinalIgnoreCase)
    {
        DashboardView,
        LeadView, LeadManage, LeadConvert,
        StudentView, StudentCreate, StudentUpdate,
        StudentDocumentView, StudentDocumentUpload, StudentDocumentReview,
        PackageView,
        VehicleView, VehicleDocumentView, VehicleServiceView,
        InstructorView,
        AppointmentView, AppointmentCreate, AppointmentUpdate, AppointmentCancel, AppointmentReschedule,
        LessonViewAll,
        TheoryView, ExamView, GraduationView, GraduationManage, CertificateDeliver,
        GraduationOverrideRequest, GraduationRevokeRequest,
        FinanceView, FinanceCollect,
        ReportView,
        MebbisView, MebbisManage,
    };

    /// <summary>
    /// Muhasebe: finansın tamamı ve raporlar. Bilerek YOK: araç ve randevu
    /// operasyonuna müdahale (yalnızca okuma), öğrenci/evrak düzenleme.
    /// </summary>
    private static readonly HashSet<string> AccountingSet = new(StringComparer.OrdinalIgnoreCase)
    {
        DashboardView,
        StudentView,
        PackageView,
        VehicleView, VehicleServiceView,
        AppointmentView, LessonViewAll,
        ExamView, GraduationView,
        FinanceView, FinanceCollect, FinanceDiscount, FinanceRefund, FinanceReportView,
        ReportView, ReportExport,
        MebbisView,
    };

    /// <summary>Filo sorumlusu: yalnızca araç, evrak, bakım ve öğretmen-araç ataması.</summary>
    private static readonly HashSet<string> FleetSet = new(StringComparer.OrdinalIgnoreCase)
    {
        DashboardView,
        VehicleView, VehicleCreate, VehicleUpdate, VehicleRetire,
        VehicleDocumentView, VehicleDocumentUpload, VehicleDocumentReview,
        VehicleServiceView, VehicleServiceManage, VehicleServiceReport,
        InstructorView, InstructorAssignmentManage,
        AppointmentView,
        ReportView,
    };

    /// <summary>Direksiyon öğretmeni: kendi randevuları ve ders akışı (kapsam uçta "kendi"ne kilitlenir).</summary>
    private static readonly HashSet<string> DrivingInstructorSet = new(StringComparer.OrdinalIgnoreCase)
    {
        StudentView,
        VehicleView, VehicleDocumentView, VehicleServiceView, VehicleServiceReport,
        AppointmentView,
        LessonStart, LessonComplete, LessonMarkNoShow,
        ExamView,
    };

    /// <summary>Teorik öğretmen: sınıf, yoklama, materyal.</summary>
    private static readonly HashSet<string> TheoryInstructorSet = new(StringComparer.OrdinalIgnoreCase)
    {
        StudentView,
        TheoryView, TheoryManage, TheoryAttendance,
        ExamView,
    };

    /// <summary>Öğrenci: yalnızca kendi verisi (kapsam uçta zorlanır).</summary>
    private static readonly HashSet<string> StudentSet = new(StringComparer.OrdinalIgnoreCase)
    {
        StudentDocumentView, StudentDocumentUpload,
        AppointmentView, AppointmentCreate, AppointmentCancel, AppointmentReschedule,
        ExamView, GraduationView,
        FinanceView,
    };

    public static readonly IReadOnlyDictionary<string, IReadOnlySet<string>> Defaults =
        new Dictionary<string, IReadOnlySet<string>>(StringComparer.OrdinalIgnoreCase)
        {
            [Owner] = OwnerSet,
            [BranchManager] = BranchManagerSet,
            [Secretary] = SecretarySet,
            [Accounting] = AccountingSet,
            [Fleet] = FleetSet,
            [DrivingInstructor] = DrivingInstructorSet,
            [TheoryInstructor] = TheoryInstructorSet,
            [Student] = StudentSet,
        };

    /// <summary>
    /// Özel rol tavanları (taban rol → seçilebilecek en geniş izin kümesi).
    /// Administrative tabanlı özel roller (sekreter, filo sorumlusu, kayıt sorumlusu…)
    /// idari işlerin tamamını kapsayabilir ama asla izin yönetimi veya override alamaz.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, IReadOnlySet<string>> Ceilings =
        new Dictionary<string, IReadOnlySet<string>>(StringComparer.OrdinalIgnoreCase)
        {
            ["Administrative"] = new HashSet<string>(
                All.Where(x => !OverrideCodes.Contains(x)
                    && x != PermissionManage
                    && x != SettingsManage
                    && x != CertificateIssue),
                StringComparer.OrdinalIgnoreCase),
            ["Accounting"] = new HashSet<string>(AccountingSet.Concat([AuditView]), StringComparer.OrdinalIgnoreCase),
            ["Teacher"] = new HashSet<string>(
                DrivingInstructorSet.Concat(TheoryInstructorSet),
                StringComparer.OrdinalIgnoreCase),
            ["Cafeteria"] = new HashSet<string>(StringComparer.OrdinalIgnoreCase),
        };

    /// <summary>Bir taban rolün özel rol tanımlarken seçebileceği izinler.</summary>
    public static IReadOnlySet<string> CeilingFor(string baseRole) =>
        Ceilings.TryGetValue(baseRole, out var set) ? set : new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    public static IReadOnlySet<string> DefaultsFor(string roleKey) =>
        Defaults.TryGetValue(roleKey, out var set) ? set : new HashSet<string>(StringComparer.OrdinalIgnoreCase);
}
