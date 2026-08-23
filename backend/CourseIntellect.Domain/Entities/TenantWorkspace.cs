using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Entities;

public sealed class TenantWorkspace
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Bağlı olduğu kurum grubu / marka (opsiyonel). Sahip, gruba verilen
    /// grant ile altındaki tüm kurumları tek ekrandan görür.</summary>
    public Guid? GroupId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string? ContactPhone { get; set; }
    /// <summary>Kullanılmıyor. Anonim kayıt artık parola almıyor; yönetici parolası
    /// onay anında üretilir. Kolon geriye dönük uyum için duruyor.</summary>
    public string? PendingAdminPasswordHash { get; set; }
    public string Plan { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public InstitutionType InstitutionType { get; set; } = InstitutionType.PrivateSchool;
    public bool DrivingSchoolModuleEnabled { get; set; }
    public Guid? AdminUserId { get; set; }
    public int UserCount { get; set; }
    public int BranchCount { get; set; }
    public int StudentCount { get; set; }
    public int StaffCount { get; set; }
    public decimal MonthlyFee { get; set; }
    public decimal CollectedAmount { get; set; }
    public decimal StorageUsedGb { get; set; }
    public int ApiUsage { get; set; }
    // --- Halka açık kurum kaydı: kötüye kullanım triyajı ve KVKK kanıtı ---

    /// <summary>Başvurunun geldiği istemci IP'si (yalnız self-signup kayıtlarında dolu).</summary>
    public string? RegistrationIp { get; set; }
    public string? RegistrationUserAgent { get; set; }
    public string? RegistrationReferer { get; set; }

    /// <summary>Formda beyan edilen öğrenci sayısı. Bilgi amaçlıdır; platform
    /// KPI toplamlarına GİRMEZ (anonim girdi olduğu için).</summary>
    public int? RegistrationEstimatedStudents { get; set; }

    /// <summary>Onaylanan aydınlatma/açık rıza metninin sürümü.</summary>
    public string? KvkkConsentVersion { get; set; }
    public DateTime? KvkkConsentAtUtc { get; set; }

    public DateTime? ApprovedAtUtc { get; set; }
    public DateTime? RejectedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
