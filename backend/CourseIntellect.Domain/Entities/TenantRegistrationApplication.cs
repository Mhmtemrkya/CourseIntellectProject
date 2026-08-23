using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Pazarlama sitesinden gelen kurum kaydı BAŞVURUSU.
/// </summary>
/// <remarks>
/// Başvurular bilinçli olarak <see cref="TenantWorkspace"/> DIŞINDA durur: o tablo
/// kimliği doğrulanmış kurumların tablosudur ve anonim yazma oraya hiç dokunmamalıdır.
/// Ayrı tablo üç şeyi birden çözer: slug ad alanı işgal edilmez (slug yalnız onayda
/// üretilir), platform sayaç/sorguları anonim satır görmez ve bekleyen başvuruda
/// e-posta üzerinde gerçek bir benzersizlik kısıtı kurulabilir.
/// Onaylanan başvuru silinmez; <see cref="Status"/> "approved" olur ve
/// <see cref="CreatedTenantId"/> üretilen kurumu işaret eder (iz kaydı).
/// </remarks>
public sealed class TenantRegistrationApplication
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string InstitutionName { get; set; } = string.Empty;
    public string ContactName { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;

    /// <summary>Tekilleştirme anahtarı: küçük harfe INVARIANT kültürle çevrilmiş e-posta.</summary>
    public string ContactEmailNormalized { get; set; } = string.Empty;

    public string? ContactPhone { get; set; }
    public string Plan { get; set; } = string.Empty;
    public InstitutionType InstitutionType { get; set; } = InstitutionType.PrivateSchool;

    /// <summary>Formda beyan edilen öğrenci sayısı. Bilgi amaçlı; hiçbir KPI'ya girmez.</summary>
    public int EstimatedStudents { get; set; }

    /// <summary>pending | approved | rejected</summary>
    public string Status { get; set; } = "pending";

    public string? RegistrationIp { get; set; }
    public string? RegistrationUserAgent { get; set; }
    public string? RegistrationReferer { get; set; }

    public string? KvkkConsentVersion { get; set; }
    public DateTime? KvkkConsentAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ApprovedAtUtc { get; set; }
    public DateTime? RejectedAtUtc { get; set; }

    /// <summary>Red gerekçesi (platform yöneticisi girer, başvurana gönderilmez).</summary>
    public string? RejectionReason { get; set; }

    /// <summary>Kuyrukta işaretli görünür. Kayıt anında sezgisel olarak kurulur,
    /// platform yöneticisi elle açıp kapatabilir. Başvuruyu engellemez.</summary>
    public bool IsSuspicious { get; set; }

    /// <summary>İşaretin nedeni (otomatikse sezgiselin açıklaması).</summary>
    public string? SuspiciousReason { get; set; }

    /// <summary>Onay sonucunda üretilen kurum.</summary>
    public Guid? CreatedTenantId { get; set; }

    // --- İletişim adresi doğrulaması ---

    /// <summary>Doğrulama bağlantısındaki tek kullanımlık kodun SHA-256 özeti.
    /// Kodun kendisi HİÇBİR ZAMAN saklanmaz.</summary>
    public string? VerificationTokenHash { get; set; }

    public DateTime? VerificationExpiresAtUtc { get; set; }

    /// <summary>Doğrulama e-postası gerçekten gönderildiyse dolu.</summary>
    public DateTime? VerificationSentAtUtc { get; set; }

    public DateTime? VerifiedAtUtc { get; set; }

    /// <summary>
    /// verified — adres kanıtlandı.
    /// awaiting — doğrulama e-postası gitti, yanıt bekleniyor (kuyrukta gösterilmez).
    /// unproven — e-posta hiç gönderilemedi (SMTP yok); kuyrukta GÖRÜNÜR ama adres
    /// kanıtlanmamış olarak işaretlenir. Gönderilemeyen bir doğrulama, gerçek bir
    /// kurumu görünmez yapmamalı.
    /// </summary>
    public string VerificationState =>
        VerifiedAtUtc is not null ? "verified"
        : VerificationSentAtUtc is not null ? "awaiting"
        : "unproven";
}
