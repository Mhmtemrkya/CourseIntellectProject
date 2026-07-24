namespace CourseIntellect.Domain.Enums;

/// <summary>Kimlik türü — yabancı uyruklu kursiyerler pasaport/yabancı kimlik ile kaydolur.</summary>
public enum IdentityKind
{
    TurkishId = 1,
    ForeignId = 2,
    Passport = 3,
}

public enum DrivingExperienceLevel
{
    None = 1,
    Some = 2,
    Experienced = 3,
}

/// <summary>
/// Sürücü adayının kurs içindeki yaşam döngüsü. Ön kayıttan mezuniyete kadar
/// tek yönlü ilerler; iptal ve askıya alma her aşamadan mümkündür.
/// </summary>
public enum DrivingStudentStatus
{
    PreRegistered = 1,
    DocumentsPending = 2,
    Active = 3,
    TheoryOngoing = 4,
    PracticeOngoing = 5,
    ExamPending = 6,
    Graduated = 7,
    Suspended = 8,
    Cancelled = 9,
    GraduationPending = 10,
}

public static class DrivingStudentStatuses
{
    /// <summary>Kurstan ayrılmamış, sayımlarda "aktif kursiyer" olarak görünen durumlar.</summary>
    public static readonly IReadOnlySet<DrivingStudentStatus> Open = new HashSet<DrivingStudentStatus>
    {
        DrivingStudentStatus.PreRegistered,
        DrivingStudentStatus.DocumentsPending,
        DrivingStudentStatus.Active,
        DrivingStudentStatus.TheoryOngoing,
        DrivingStudentStatus.PracticeOngoing,
        DrivingStudentStatus.ExamPending,
        DrivingStudentStatus.GraduationPending,
    };

    /// <summary>
    /// Teorik sınıfa/döneme atanabilecek durumlar. Yeni kayıt (evrakları henüz onaylanmamış)
    /// kursiyerler de dahildir; teoriye başlamak için evrak onayı beklenmez. Teorik aşamayı
    /// çoktan geçmiş (PracticeOngoing/ExamPending/GraduationPending) veya kurstan ayrılmış
    /// adaylar dışarıda kalır.
    /// </summary>
    public static readonly IReadOnlySet<DrivingStudentStatus> TheoryEnrollable = new HashSet<DrivingStudentStatus>
    {
        DrivingStudentStatus.PreRegistered,
        DrivingStudentStatus.DocumentsPending,
        DrivingStudentStatus.Active,
        DrivingStudentStatus.TheoryOngoing,
    };

    /// <summary>Direksiyon randevusu alınabilecek durumlar — dosyası eksik veya askıdaki aday randevuya giremez.</summary>
    public static readonly IReadOnlySet<DrivingStudentStatus> Schedulable = new HashSet<DrivingStudentStatus>
    {
        DrivingStudentStatus.Active,
        DrivingStudentStatus.TheoryOngoing,
        DrivingStudentStatus.PracticeOngoing,
        DrivingStudentStatus.ExamPending,
    };
}

/// <summary>MEB'in sürücü kursu dosyasında aradığı belge türleri.</summary>
public enum StudentDocumentType
{
    Identity = 1,
    Diploma = 2,
    HealthReport = 3,
    BiometricPhoto = 4,
    CriminalRecord = 5,
    BloodTypeCertificate = 6,
    Residence = 7,
    ParentalConsent = 8,
    ExistingLicense = 9,
    Other = 10,
    ForeignStudentDocument = 11,
}

public enum StudentDocumentStatus
{
    /// <summary>Zorunlu ama hiç yüklenmemiş (kayıt satırı yok; hesaplanan durum).</summary>
    Missing = 1,
    PendingApproval = 2,
    Approved = 3,
    Rejected = 4,
    Expired = 5,
    /// <summary>Belge teknik olarak incelendi ancak yeni sürüm yüklenmesi istendi.</summary>
    ReuploadRequested = 6,
}
