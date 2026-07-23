namespace CourseIntellect.Domain.Permissions;

/// <summary>
/// Sürücü kursu modülünün ince taneli yetki kodları. Rol kontrolü "hangi paneli
/// görür"ü, permission "hangi işlemi yapabilir"i belirler: her yazma ucu rolün
/// ÜSTÜNE bir permission kodu ister.
///
/// Kod düzeni: driving.&lt;alan&gt;.&lt;işlem&gt;. Override kodları ayrı tutulur çünkü
/// bunlar bir iş kuralını (uygunsuz araç, evrak süresi, vites uyumu, randevu
/// kuralı) bilerek ezmeye izin verir ve her zaman gerekçe + audit ister.
/// </summary>
public static class DrivingPermissions
{
    public const string DashboardView = "driving.dashboard.view";

    public const string LeadView = "driving.lead.view";
    public const string LeadManage = "driving.lead.manage";
    public const string LeadConvert = "driving.lead.convert";

    public const string StudentView = "driving.student.view";
    public const string StudentCreate = "driving.student.create";
    public const string StudentUpdate = "driving.student.update";
    public const string StudentDeactivate = "driving.student.deactivate";
    public const string StudentDocumentView = "driving.student.document.view";
    public const string StudentDocumentUpload = "driving.student.document.upload";
    public const string StudentDocumentReview = "driving.student.document.review";

    public const string PackageView = "driving.package.view";
    public const string PackageCreate = "driving.package.create";
    public const string PackageUpdate = "driving.package.update";
    public const string PackageDelete = "driving.package.delete";
    /// <summary>Öğrencinin paketini veya vites türünü değiştirme (fiyat farkı doğurur).</summary>
    public const string PackageChange = "driving.package.change";
    /// <summary>Ders hakkı dakikalarını elle düzeltme.</summary>
    public const string LessonBalanceAdjust = "driving.lessonbalance.adjust";

    public const string VehicleView = "driving.vehicle.view";
    public const string VehicleCreate = "driving.vehicle.create";
    public const string VehicleUpdate = "driving.vehicle.update";
    public const string VehicleRetire = "driving.vehicle.retire";
    public const string VehicleDocumentView = "driving.vehicle.document.view";
    public const string VehicleDocumentUpload = "driving.vehicle.document.upload";
    public const string VehicleDocumentReview = "driving.vehicle.document.review";
    public const string VehicleServiceView = "driving.vehicle.service.view";
    /// <summary>Bakım/arıza/hasar kaydı açma, kapatma, maliyet girme.</summary>
    public const string VehicleServiceManage = "driving.vehicle.service.manage";
    /// <summary>Yalnızca arıza/hasar bildirimi — öğretmen ders sırasında kullanır.</summary>
    public const string VehicleServiceReport = "driving.vehicle.service.report";

    public const string InstructorView = "driving.instructor.view";
    public const string InstructorCreate = "driving.instructor.create";
    public const string InstructorUpdate = "driving.instructor.update";
    public const string InstructorDeactivate = "driving.instructor.deactivate";
    /// <summary>Öğretmen-araç ataması kurma/kaldırma.</summary>
    public const string InstructorAssignmentManage = "driving.instructor.assignment.manage";

    public const string AppointmentView = "driving.appointment.view";
    public const string AppointmentCreate = "driving.appointment.create";
    public const string AppointmentUpdate = "driving.appointment.update";
    public const string AppointmentCancel = "driving.appointment.cancel";
    public const string AppointmentReschedule = "driving.appointment.reschedule";
    public const string AppointmentApprove = "driving.appointment.approve";

    public const string LessonViewAll = "driving.lesson.view.all";
    public const string LessonStart = "driving.lesson.start";
    public const string LessonComplete = "driving.lesson.complete";
    public const string LessonMarkNoShow = "driving.lesson.noshow";

    public const string TheoryView = "driving.theory.view";
    public const string TheoryManage = "driving.theory.manage";
    public const string TheoryAttendance = "driving.theory.attendance";

    public const string ExamView = "driving.exam.view";
    public const string ExamManage = "driving.exam.manage";
    public const string ExamResultEnter = "driving.exam.result";

    public const string GraduationView = "driving.graduation.view";
    public const string GraduationManage = "driving.graduation.manage";
    public const string CertificateIssue = "driving.certificate.issue";
    public const string CertificateDeliver = "driving.certificate.deliver";
    public const string CertificateRevoke = "driving.certificate.revoke";
    public const string GraduationOverrideRequest = "driving.graduation.override.request";
    public const string GraduationOverrideApprove = "driving.graduation.override.approve";
    public const string GraduationRevokeRequest = "driving.graduation.revoke.request";

    public const string FinanceView = "driving.finance.view";
    public const string FinanceCollect = "driving.finance.collect";
    public const string FinanceDiscount = "driving.finance.discount";
    public const string FinanceRefund = "driving.finance.refund";
    /// <summary>Kurum geneli finans raporları — sekreterde bilerek YOKTUR.</summary>
    public const string FinanceReportView = "driving.finance.report.view";

    public const string ReportView = "driving.report.view";
    public const string ReportExport = "driving.report.export";

    public const string SettingsManage = "driving.settings.manage";
    public const string PermissionManage = "driving.permission.manage";
    public const string AuditView = "driving.audit.view";

    public const string MebbisView = "driving.mebbis.view";
    public const string MebbisManage = "driving.mebbis.manage";
    /// <summary>MEBBİS'e girilmiş bir kaydı ikinci kontrolle doğrulama.</summary>
    public const string MebbisVerify = "driving.mebbis.verify";

    /// <summary>Bakımdaki / evrakı geçersiz aracı yine de randevuya bağlama.</summary>
    public const string OverrideVehicleCompliance = "driving.override.vehicle_compliance";
    /// <summary>Çakışma, limit, hazırlık süresi gibi randevu kurallarını ezme.</summary>
    public const string OverrideAppointmentRule = "driving.override.appointment_rule";
    /// <summary>Süresi dolmuş evrakla işlem yapmaya devam etme.</summary>
    public const string OverrideDocumentExpiry = "driving.override.document_expiry";
    /// <summary>Öğrenci-araç vites uyumsuzluğunu ezme.</summary>
    public const string OverrideTransmission = "driving.override.transmission";
    /// <summary>Borç/finansal bloke nedeniyle kapalı randevuyu açma.</summary>
    public const string OverrideFinancialHold = "driving.override.financial_hold";
    /// <summary>Eksik öğrenci evrakına rağmen eğitim/randevu açma.</summary>
    public const string OverrideStudentDocuments = "driving.override.student_documents";

    /// <summary>Gerekçe ve audit kaydı zorunlu olan kodlar.</summary>
    public static readonly IReadOnlySet<string> OverrideCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        OverrideVehicleCompliance,
        OverrideAppointmentRule,
        OverrideDocumentExpiry,
        OverrideTransmission,
        OverrideFinancialHold,
        OverrideStudentDocuments,
        GraduationOverrideApprove,
        CertificateRevoke,
    };

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        DashboardView,
        LeadView, LeadManage, LeadConvert,
        StudentView, StudentCreate, StudentUpdate, StudentDeactivate,
        StudentDocumentView, StudentDocumentUpload, StudentDocumentReview,
        PackageView, PackageCreate, PackageUpdate, PackageDelete, PackageChange, LessonBalanceAdjust,
        VehicleView, VehicleCreate, VehicleUpdate, VehicleRetire,
        VehicleDocumentView, VehicleDocumentUpload, VehicleDocumentReview,
        VehicleServiceView, VehicleServiceManage, VehicleServiceReport,
        InstructorView, InstructorCreate, InstructorUpdate, InstructorDeactivate, InstructorAssignmentManage,
        AppointmentView, AppointmentCreate, AppointmentUpdate, AppointmentCancel, AppointmentReschedule, AppointmentApprove,
        LessonViewAll, LessonStart, LessonComplete, LessonMarkNoShow,
        TheoryView, TheoryManage, TheoryAttendance,
        ExamView, ExamManage, ExamResultEnter,
        GraduationView, GraduationManage, CertificateIssue, CertificateDeliver, CertificateRevoke,
        GraduationOverrideRequest, GraduationOverrideApprove, GraduationRevokeRequest,
        FinanceView, FinanceCollect, FinanceDiscount, FinanceRefund, FinanceReportView,
        ReportView, ReportExport,
        SettingsManage, PermissionManage, AuditView,
        MebbisView, MebbisManage, MebbisVerify,
        OverrideVehicleCompliance, OverrideAppointmentRule, OverrideDocumentExpiry, OverrideTransmission, OverrideFinancialHold, OverrideStudentDocuments,
    };
}
