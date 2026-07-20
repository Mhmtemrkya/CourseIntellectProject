using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Kursiyer grubu (dönem) — ör. "Temmuz 2026 grubu". Kursiyerler bir gruba
/// atanır; öğrenci listeleri ve raporlar grup bazlı filtrelenir. Şimdilik bir
/// kursiyer aynı anda tek gruptadır (<see cref="StudentDrivingProfile.StudentGroupId"/>);
/// çoklu üyelik gerekirse ara tabloya çevrilir.
/// </summary>
public sealed class DrivingStudentGroup : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    /// <summary>Pasif grup yeni atamalarda seçilemez ama geçmiş atamalar korunur.</summary>
    public bool IsActive { get; set; } = true;

    // ─── MEBBİS dönem hizalaması ──────────────────────────────────────────────
    // MTSK'da her ay resmî bir dönemdir (ör. 2026 yılı 7. dönem). Grup = dönem.
    /// <summary>Resmî dönem yılı (ör. 2026). Boşsa MEBBİS dönemiyle eşlenmemiş.</summary>
    public int? TermYear { get; set; }
    /// <summary>Resmî dönem numarası (genelde ay: Temmuz = 7).</summary>
    public int? TermNumber { get; set; }
    /// <summary>MEBBİS'in verdiği dönem kodu — kurum MEBBİS'ten okuyup buraya yazar.</summary>
    public string MebbisTermCode { get; set; } = string.Empty;
    /// <summary>Dönem kontenjanı (teorik sınıf kapasitesi). 0 = sınırsız.</summary>
    public int Quota { get; set; }
    /// <summary>Dönem kayıt kesim tarihi — MEBBİS'e aday girişinin son günü.</summary>
    public DateTime? RegistrationDeadlineUtc { get; set; }

    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Sürücü adayının kurs dosyasındaki tek bir belge (kimlik, sağlık raporu, adli sicil…).
///
/// Bir belge türünün aynı anda yalnız BİR geçerli sürümü olur (<see cref="IsCurrent"/>).
/// Yeni sürüm yüklendiğinde eskisi geçmişe alınır — silinmez, çünkü hangi belgenin
/// hangi tarihte onaylandığı denetimde sorulur.
/// </summary>
public sealed class StudentDrivingDocument : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid StudentDrivingProfileId { get; set; }
    public StudentDocumentType DocumentType { get; set; }
    public StudentDocumentStatus Status { get; set; } = StudentDocumentStatus.PendingApproval;

    public string FileUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string DocumentNumber { get; set; } = string.Empty;
    /// <summary>Belgeyi veren kurum (sağlık raporunda MEBBİS zorunlu ister).</summary>
    public string IssuedBy { get; set; } = string.Empty;
    /// <summary>Belgenin düzenlenme tarihi (rapor tarihi).</summary>
    public DateTime? IssuedAtUtc { get; set; }
    /// <summary>Sağlık raporu, adli sicil gibi süreli belgelerde son geçerlilik.</summary>
    public DateTime? ExpiresAtUtc { get; set; }
    public string Description { get; set; } = string.Empty;

    public Guid? UploadedByUserId { get; set; }
    public DateTime UploadedAtUtc { get; set; } = DateTime.UtcNow;

    public Guid? ReviewedByUserId { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
    /// <summary>Reddedildiyse nedeni — öğrenciye aynen gösterilir.</summary>
    public string RejectionReason { get; set; } = string.Empty;
    /// <summary>İnceleyen personelin iç notu; kursiyere gösterilmez.</summary>
    public string ReviewNote { get; set; } = string.Empty;
    public DateTime? ReuploadRequestedAtUtc { get; set; }
    /// <summary>Eşzamanlı iki personelin aynı evrakı ezmesini engeller.</summary>
    public int ReviewVersion { get; set; }

    /// <summary>Bu tür için geçerli sürüm mü? Yeni yükleme eskiyi false'a çeker.</summary>
    public bool IsCurrent { get; set; } = true;
}

/// <summary>
/// Kayıt sihirbazının otomatik kaydettiği taslak. Personel formu yarıda bırakıp
/// döndüğünde veya sekme kapandığında veri kaybolmasın diye adım adım saklanır.
/// Kayıt tamamlanınca taslak silinir.
/// </summary>
public sealed class DrivingRegistrationDraft : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    /// <summary>Taslağı oluşturan personel — herkes yalnız kendi taslağını görür.</summary>
    public Guid CreatedByUserId { get; set; }
    /// <summary>Listede tanınsın diye: aday adı (henüz öğrenci kaydı yok).</summary>
    public string DisplayName { get; set; } = string.Empty;
    /// <summary>Sihirbazın o anki adımı (1..n) — kullanıcı kaldığı yerden devam eder.</summary>
    public int Step { get; set; } = 1;
    /// <summary>Formun tamamı (JSON). Şema istemci tarafında yaşar; sunucu sadece taşır.</summary>
    public string PayloadJson { get; set; } = "{}";
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}
