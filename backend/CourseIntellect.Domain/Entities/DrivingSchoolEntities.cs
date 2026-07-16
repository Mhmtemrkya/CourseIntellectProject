using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Entities;

public sealed class DrivingPackage : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string LicenseClass { get; set; } = "B";
    public TransmissionType TransmissionType { get; set; }
    public int DrivingLessonMinutes { get; set; }
    public int TheoryLessonMinutes { get; set; }
    public decimal Price { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class DrivingVehicle : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string PlateNumber { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public int ModelYear { get; set; }
    public string LicenseClass { get; set; } = "B";
    public TransmissionType TransmissionType { get; set; }
    public int CurrentKilometer { get; set; }
    public DateTime? InspectionExpiresAtUtc { get; set; }
    public DateTime? InsuranceExpiresAtUtc { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsInMaintenance { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class DrivingInstructorProfile : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid StaffId { get; set; }
    public string LicenseClasses { get; set; } = "B";
    public bool CanTeachManual { get; set; }
    public bool CanTeachAutomatic { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Sürücü adayının kurs dosyası. Kişinin kimlik/iletişim bilgileri paylaşılan
/// <see cref="StudentProfile"/>'da durur; burada yalnızca sürücü kursuna özgü
/// alanlar tutulur (paket, ders hakkı, uygunluk tercihleri, rıza kayıtları).
/// </summary>
public sealed class StudentDrivingProfile : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid StudentId { get; set; }
    public Guid PackageId { get; set; }
    /// <summary>Atandığı kursiyer grubu (dönem). Boşsa gruba atanmamış.</summary>
    public Guid? StudentGroupId { get; set; }
    public string LicenseClass { get; set; } = "B";
    public TransmissionType TransmissionType { get; set; }
    public int PurchasedDrivingMinutes { get; set; }
    public int UsedDrivingMinutes { get; set; }
    public DrivingStudentStatus Status { get; set; } = DrivingStudentStatus.Active;
    public DateTime RegisteredAtUtc { get; set; } = DateTime.UtcNow;

    // ─── Kimlik ve kişisel bilgiler ───────────────────────────────────────────
    public IdentityKind IdentityKind { get; set; } = IdentityKind.TurkishId;
    /// <summary>TC dışı kimlik/pasaport numarası. TC vatandaşında StudentProfile.TcNo kullanılır.</summary>
    public string IdentityNumber { get; set; } = string.Empty;
    public string Nationality { get; set; } = string.Empty;
    public string Gender { get; set; } = string.Empty;
    public string BloodType { get; set; } = string.Empty;
    public string Occupation { get; set; } = string.Empty;
    public string EducationLevel { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string District { get; set; } = string.Empty;
    /// <summary>El ile girilen ikametgâh (yerleşim yeri) adresi — MEB dosyası için.</summary>
    public string ResidenceAddress { get; set; } = string.Empty;
    public string WhatsAppPhone { get; set; } = string.Empty;
    public string EmergencyContactName { get; set; } = string.Empty;
    public string EmergencyContactPhone { get; set; } = string.Empty;
    public string PhotoUrl { get; set; } = string.Empty;

    // ─── Eğitim tercihleri ────────────────────────────────────────────────────
    public DateTime? CourseStartsAtUtc { get; set; }
    public Guid? PreferredInstructorProfileId { get; set; }
    public Guid? PreferredVehicleId { get; set; }
    public DrivingExperienceLevel DrivingExperience { get; set; } = DrivingExperienceLevel.None;
    public bool AvailableWeekdays { get; set; } = true;
    public bool AvailableWeekend { get; set; }
    public bool PrefersMorning { get; set; }
    public bool PrefersMidday { get; set; }
    public bool PrefersEvening { get; set; }
    public string AccessibilityNotes { get; set; } = string.Empty;

    // ─── Sözleşme, rıza ve onay ───────────────────────────────────────────────
    /// <summary>Kayıt sihirbazının finans adımında üretilen sözleşme.</summary>
    public Guid? EnrollmentContractId { get; set; }
    public DateTime? KvkkConsentAtUtc { get; set; }
    public bool CommunicationConsent { get; set; }
    public DateTime? ContractSignedAtUtc { get; set; }
    /// <summary>Öğrenci imzasının güvenli yükleme alanındaki adresi.</summary>
    public string SignatureUrl { get; set; } = string.Empty;
    public Guid? RegisteredByUserId { get; set; }
    public Guid? ApprovedByUserId { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
}

public sealed class DrivingAppointment : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid StudentDrivingProfileId { get; set; }
    public Guid InstructorProfileId { get; set; }
    public Guid VehicleId { get; set; }
    public DateTime StartsAtUtc { get; set; }
    public DateTime EndsAtUtc { get; set; }
    public DrivingAppointmentStatus Status { get; set; } = DrivingAppointmentStatus.Planned;
    public string Notes { get; set; } = string.Empty;

    /// <summary>Öğrencinin alınacağı yer — öğretmen mobilde haritada açar.</summary>
    public string MeetingPoint { get; set; } = string.Empty;

    public DateTime? CheckedInAtUtc { get; set; }

    // ─── İptal / yeniden planlama izi ─────────────────────────────────────────
    public string CancellationReason { get; set; } = string.Empty;
    public Guid? CancelledByUserId { get; set; }
    public DateTime? CancelledAtUtc { get; set; }

    /// <summary>Bu randevu bir ertelemenin sonucuysa, kaynağı.</summary>
    public Guid? RescheduledFromAppointmentId { get; set; }

    /// <summary>Bu randevu ertelendiyse, yerine geçen randevu.</summary>
    public Guid? RescheduledToAppointmentId { get; set; }

    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Randevunun her durum değişikliği ayrı satır olarak saklanır: kim, ne zaman,
/// hangi durumdan hangisine, neden. "Bu ders neden iptal oldu" sorusunun tek cevabı.
/// </summary>
public sealed class DrivingAppointmentStatusHistory : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid AppointmentId { get; set; }
    public DrivingAppointmentStatus? FromStatus { get; set; }
    public DrivingAppointmentStatus ToStatus { get; set; }
    public Guid? ChangedByUserId { get; set; }
    public string ChangedByName { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Kurumun randevu ve iptal kuralları. Kurum başına tek satır; yoksa
/// <see cref="DrivingSchoolSettings"/> varsayılanları geçerlidir.
/// </summary>
public sealed class DrivingSchoolSettings : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }

    /// <summary>Bu saatten geç yapılan öğrenci iptali "geç iptal" sayılır.</summary>
    public int LateCancellationHours { get; set; } = 24;

    /// <summary>Geç iptalde ders hakkından düşülecek yüzde (0-100).</summary>
    public int LateCancellationDeductPercent { get; set; } = 50;

    /// <summary>Öğrenci gelmediğinde ders hakkından düşülecek yüzde (0-100).</summary>
    public int NoShowDeductPercent { get; set; } = 100;

    /// <summary>Öğrencinin randevu talebi yönetici onayından geçsin mi?</summary>
    public bool RequireApprovalForStudentRequests { get; set; } = true;

    /// <summary>Randevu bu saatten yakınsa yeniden planlanamaz.</summary>
    public int MinRescheduleHours { get; set; } = 12;

    // ─── Uygunluk limitleri (0 = sınırsız) ────────────────────────────────────

    /// <summary>Bir öğretmenin aynı gün verebileceği toplam direksiyon dakikası.</summary>
    public int MaxInstructorDailyMinutes { get; set; } = 480;

    /// <summary>Bir aracın aynı gün kullanılabileceği toplam dakika.</summary>
    public int MaxVehicleDailyMinutes { get; set; } = 600;

    /// <summary>Bir öğrencinin aynı gün alabileceği ders sayısı.</summary>
    public int MaxStudentDailyLessons { get; set; } = 2;

    /// <summary>İki ders arasında bırakılması gereken hazırlık/yol payı.</summary>
    public int PreparationMinutes { get; set; } = 15;

    /// <summary>Borcu eşiği aşan öğrenciye randevu verilmesin mi?</summary>
    public bool FinancialHoldEnabled { get; set; }

    /// <summary>Randevuyu kapatan gecikmiş borç eşiği (₺).</summary>
    public decimal FinancialHoldThreshold { get; set; } = 1000;

    /// <summary>Mezuniyet için gerekli asgari teorik devam oranı (0-100).</summary>
    public decimal MinimumTheoryAttendancePercent { get; set; } = 80;

    /// <summary>Mazeretli yoklamanın devam hesabına nasıl katılacağı.</summary>
    public DrivingExcusedAbsencePolicy ExcusedAbsencePolicy { get; set; } = DrivingExcusedAbsencePolicy.ExcludeFromCalculation;

    public string CertificateDirectorName { get; set; } = string.Empty;
    public string CertificateDirectorTitle { get; set; } = "Kurum Müdürü";
    public string CertificateLogoUrl { get; set; } = string.Empty;
    public string CertificateSignatureUrl { get; set; } = string.Empty;
    public string CertificatePrimaryColor { get; set; } = "#173B57";
    public int CertificateSettingsRevision { get; set; } = 1;
    public int? CertificateSettingsApprovedRevision { get; set; }
    public Guid? CertificateSettingsApprovedByUserId { get; set; }
    public DateTime? CertificateSettingsApprovedAtUtc { get; set; }

    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class DrivingLesson : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid AppointmentId { get; set; }
    public Guid StudentDrivingProfileId { get; set; }
    public Guid InstructorProfileId { get; set; }
    public Guid VehicleId { get; set; }
    public DateTime StartedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public int StartKilometer { get; set; }
    public int? EndKilometer { get; set; }
    public bool BrakesOk { get; set; }
    public bool TiresOk { get; set; }
    public bool LightsOk { get; set; }
    public bool FluidsOk { get; set; }
    public string PreCheckNote { get; set; } = string.Empty;
    public string InstructorNote { get; set; } = string.Empty;
    public int? TrafficRulesScore { get; set; }
    public int? VehicleControlScore { get; set; }
    public int? ManeuversScore { get; set; }
    public int? SafetyScore { get; set; }
    public int EvaluationVersion { get; set; }
    public string EvaluationScoresJson { get; set; } = "{}";
    public int ChargedMinutes { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class DrivingLessonLedgerEntry : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid StudentDrivingProfileId { get; set; }

    /// <summary>Gerçekleşen derse bağlı hareketlerde dolu; rezervasyon/düzeltmede boş.</summary>
    public Guid? DrivingLessonId { get; set; }

    /// <summary>Rezervasyon, iptal ve devamsızlık hareketlerinde ilgili randevu.</summary>
    public Guid? AppointmentId { get; set; }

    /// <summary>Pozitif hak ekler, negatif hak düşer. Bakiye = tüm hareketlerin toplamı.</summary>
    public int MinutesDelta { get; set; }

    public DrivingLedgerEntryType EntryType { get; set; } = DrivingLedgerEntryType.LessonUsage;
    public string Description { get; set; } = string.Empty;

    /// <summary>Elle düzeltme ve ceza hareketlerinde zorunlu gerekçe.</summary>
    public string Reason { get; set; } = string.Empty;

    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class DrivingVehicleDocument : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid VehicleId { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public string DocumentNumber { get; set; } = string.Empty;
    public DateTime? StartsAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public string FileUrl { get; set; } = string.Empty;
    public int ReminderDays { get; set; } = 30;
    public string Description { get; set; } = string.Empty;
    public Guid ApprovedByUserId { get; set; }
    public DateTime ApprovedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class DrivingVehicleServiceRecord : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid VehicleId { get; set; }
    public string RecordType { get; set; } = "Maintenance";
    public string Title { get; set; } = string.Empty;
    public string ServiceProvider { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Priority { get; set; } = "Normal";
    public DateTime ReportedAtUtc { get; set; } = DateTime.UtcNow;
    public int Kilometer { get; set; }
    public bool VehicleUsable { get; set; }
    public decimal LaborCost { get; set; }
    public decimal PartsCost { get; set; }
    public DateTime? NextServiceAtUtc { get; set; }
    public int? NextServiceKilometer { get; set; }
    public string Status { get; set; } = "Open";
    public string Resolution { get; set; } = string.Empty;
    public DateTime? CompletedAtUtc { get; set; }
    public Guid ReportedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
