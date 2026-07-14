namespace CourseIntellect.Domain.Enums;

/// <summary>
/// Ders hakkı defterindeki hareket türleri. Bakiye bu hareketlerin toplamıdır —
/// hiçbir yerde dakika "elle" hesaplanmaz.
///
/// Pozitif hareket hak ekler (paket, ek satın alma, iade), negatif hareket hak
/// düşer (planlama rezervasyonu, gerçekleşen ders, devamsızlık cezası).
/// </summary>
public enum DrivingLedgerEntryType
{
    /// <summary>Kayıtta paketten gelen dakikalar (+).</summary>
    PackageMinutes = 1,

    /// <summary>Randevu oluşturulunca bloke edilen dakikalar (−). Ders yapılmadan da hak "bağlıdır".</summary>
    PlannedMinutes = 2,

    /// <summary>Planlanan randevu iptal/ertelenince rezervasyonun geri bırakılması (+).</summary>
    ReservationReleased = 3,

    /// <summary>Gerçekleşen dersin işlenmesi (−).</summary>
    LessonUsage = 4,

    /// <summary>Ek satın alınan direksiyon dakikaları (+).</summary>
    ExtraPurchasedMinutes = 5,

    /// <summary>Devamsızlık cezası — öğrenci gelmedi, hak yanar (−).</summary>
    NoShowDeductedMinutes = 6,

    /// <summary>Geç iptal cezası (−).</summary>
    CancelledDeductedMinutes = 7,

    /// <summary>Kurum/öğretmen kaynaklı iptalde hakkın iadesi (+).</summary>
    RefundedMinutes = 8,

    /// <summary>Yetkilinin gerekçeli elle düzeltmesi (+/−).</summary>
    ManualAdjustmentMinutes = 9,
}

/// <summary>Öğretmen-araç atamasının türü. Öneri motoru bu sırayla önerir.</summary>
public enum VehicleAssignmentType
{
    /// <summary>Öğretmenin asıl aracı.</summary>
    Primary = 1,

    /// <summary>İkinci araç — asıl araç doluysa/uygunsuzsa kullanılır.</summary>
    Secondary = 2,

    /// <summary>Belirli tarih aralığında geçerli geçici atama.</summary>
    Temporary = 3,

    /// <summary>Yalnızca belirli günlerde geçerli (gün maskesi ile).</summary>
    SpecificDays = 4,

    /// <summary>Yedek — yalnızca diğerleri tükenince önerilir.</summary>
    Backup = 5,
}

public static class DrivingAppointmentStatuses
{
    /// <summary>
    /// Takvimde YER TUTAN durumlar: çakışma kontrolü ve ders hakkı rezervasyonu
    /// yalnızca bunlar için işler. Taslak yer tutmaz, iptal/devamsızlık yer bırakır.
    /// </summary>
    public static readonly IReadOnlySet<DrivingAppointmentStatus> Blocking = new HashSet<DrivingAppointmentStatus>
    {
        DrivingAppointmentStatus.Requested,
        DrivingAppointmentStatus.WaitingApproval,
        DrivingAppointmentStatus.Planned,
        DrivingAppointmentStatus.Approved,
        DrivingAppointmentStatus.CheckedIn,
        DrivingAppointmentStatus.InProgress,
    };

    /// <summary>Dersin başlatılabileceği durumlar.</summary>
    public static readonly IReadOnlySet<DrivingAppointmentStatus> Startable = new HashSet<DrivingAppointmentStatus>
    {
        DrivingAppointmentStatus.Planned,
        DrivingAppointmentStatus.Approved,
        DrivingAppointmentStatus.CheckedIn,
    };

    /// <summary>Kim iptal ettiyse o durum yazılır — iade kuralı buna göre değişir.</summary>
    public static readonly IReadOnlySet<DrivingAppointmentStatus> Cancelled = new HashSet<DrivingAppointmentStatus>
    {
        DrivingAppointmentStatus.Cancelled,
        DrivingAppointmentStatus.CancelledByStudent,
        DrivingAppointmentStatus.CancelledByInstructor,
        DrivingAppointmentStatus.CancelledByInstitution,
    };

    /// <summary>Artık değiştirilemeyen (kapanmış) durumlar.</summary>
    public static readonly IReadOnlySet<DrivingAppointmentStatus> Terminal = new HashSet<DrivingAppointmentStatus>
    {
        DrivingAppointmentStatus.Completed,
        DrivingAppointmentStatus.NoShow,
        DrivingAppointmentStatus.Rescheduled,
        DrivingAppointmentStatus.Cancelled,
        DrivingAppointmentStatus.CancelledByStudent,
        DrivingAppointmentStatus.CancelledByInstructor,
        DrivingAppointmentStatus.CancelledByInstitution,
    };

    /// <summary>İptal edilebilir mi? Başlamış veya kapanmış ders iptal edilmez.</summary>
    public static bool CanCancel(DrivingAppointmentStatus status)
        => Blocking.Contains(status)
           && status != DrivingAppointmentStatus.InProgress;

    public static bool IsCancelled(DrivingAppointmentStatus status) => Cancelled.Contains(status);

    /// <summary>Ders hakkı rezervasyonu tutuyor mu? (Ders işlenince rezervasyon kullanıma döner.)</summary>
    public static bool HoldsReservation(DrivingAppointmentStatus status) => Blocking.Contains(status);

    public static string Label(DrivingAppointmentStatus status) => status switch
    {
        DrivingAppointmentStatus.Draft => "Taslak",
        DrivingAppointmentStatus.Requested => "Talep edildi",
        DrivingAppointmentStatus.WaitingApproval => "Onay bekliyor",
        DrivingAppointmentStatus.Planned => "Planlandı",
        DrivingAppointmentStatus.Approved => "Onaylandı",
        DrivingAppointmentStatus.CheckedIn => "Buluşuldu",
        DrivingAppointmentStatus.InProgress => "Ders sürüyor",
        DrivingAppointmentStatus.Completed => "Tamamlandı",
        DrivingAppointmentStatus.Cancelled => "İptal",
        DrivingAppointmentStatus.CancelledByStudent => "Öğrenci iptal etti",
        DrivingAppointmentStatus.CancelledByInstructor => "Öğretmen iptal etti",
        DrivingAppointmentStatus.CancelledByInstitution => "Kurum iptal etti",
        DrivingAppointmentStatus.NoShow => "Öğrenci gelmedi",
        DrivingAppointmentStatus.Rescheduled => "Yeniden planlandı",
        DrivingAppointmentStatus.Suspended => "Askıya alındı",
        _ => status.ToString(),
    };
}
