using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Entities;

/// <summary>
/// Kurumun yüklediği hazır PDF belgesi (matbu sözleşme, taahhütname, veli
/// bilgilendirme formu…). İçerik VERİTABANINDA tutulur: /uploads klasörü
/// statik ve kimliksiz servis edilir; onam belgeleri kişisel veri taşıdığı için
/// yalnız kimlik doğrulanmış ve kurum süzgecinden geçen uç üzerinden okunmalıdır.
///
/// Kayıtlar içerik adresidir (<see cref="Sha256"/>): aynı PDF ikinci kez
/// yüklenirse yeni satır açılmaz, var olan paylaşılır. Şablon silinse bile
/// imzalı kayıtların belgesi burada durmaya devam eder.
/// </summary>
public sealed class ConsentDocument : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }

    /// <summary>Kullanıcının yüklediği özgün dosya adı — indirmede geri verilir.</summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>İçeriğin SHA-256 özeti; tekilleştirme ve imza sayfasındaki künye için.</summary>
    public string Sha256 { get; set; } = string.Empty;

    public int ByteSize { get; set; }
    public int PageCount { get; set; }

    /// <summary>Ham PDF baytları.</summary>
    public byte[] Content { get; set; } = [];

    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Kurumun yazdığı onam/izin formu şablonu (KVKK açık rıza, veli muvafakatnamesi,
/// gezi izni, sürücü kursu taahhütnamesi…).
///
/// Şablon YALNIZCA yeni kayıt üretirken kaynaktır: metin, onay maddeleri ve imza
/// zorunluluğu kayda KOPYALANIR. Şablon sonradan değişse veya silinse bile
/// imzalanmış belge aynen kalır.
/// </summary>
public sealed class ConsentFormTemplate : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }

    public string Title { get; set; } = string.Empty;

    /// <summary>Gövde sistemde yazılan metin mi, yüklenmiş PDF mi?</summary>
    public ConsentDocumentSource SourceKind { get; set; } = ConsentDocumentSource.Text;

    /// <summary>PDF kaynaklı şablonun belgesi. Metin şablonunda null.</summary>
    public Guid? DocumentId { get; set; }

    /// <summary>
    /// Form metni. İçinde yer tutucu bulunabilir: {{ogrenci}}, {{veli}}, {{kurum}},
    /// {{personel}}, {{tarih}}, {{tc}}, {{sinif}}, {{konu}}. Yer tutucular kayıt
    /// oluşturulurken SUNUCUDA doldurulur.
    ///
    /// PDF kaynaklı şablonda bu alan belgenin yerine geçmez; tablette belgenin
    /// üstünde gösterilen kısa açıklamadır (boş bırakılabilir).
    /// </summary>
    public string Body { get; set; } = string.Empty;

    /// <summary>Müşterinin/velinin işaretleyeceği onay maddeleri — JSON string dizisi.</summary>
    public string CheckItemsJson { get; set; } = "[]";

    /// <summary>false = yalnız bilgilendirme metni; imza istenmez.</summary>
    public bool RequiresSignature { get; set; } = true;

    public ConsentSignerRole SignerRole { get; set; } = ConsentSignerRole.StudentOrParent;

    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }

    /// <summary>
    /// Şablon silindiğinde satır durur (imzalı kayıtların künyesi buna bakar),
    /// listelerde görünmez ve yeni kayıt üretmez.
    /// </summary>
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAtUtc { get; set; }

    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Şablonun hangi iş akışında zorunlu olduğunu söyleyen bağ (çoka-çok).
/// Bir şablon N akışa, bir akış N şablona bağlanabilir.
///
/// <see cref="ContextKey"/> boşsa şablon o türdeki tüm kayıtlarda zorunludur;
/// doluysa yalnız o anahtarda (sürücü paketi kimliği, program/sınıf adı…).
/// </summary>
public sealed class ConsentFormRequirement : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }

    public Guid TemplateId { get; set; }
    public ConsentContextKind ContextKind { get; set; }

    /// <summary>Tür içinde daraltma anahtarı (paket Id'si, program adı…). Boş = tümü.</summary>
    public string ContextKey { get; set; } = string.Empty;
}

/// <summary>
/// Öğrenciye/kursiyere ait onam formu kaydı — imzalanan belgenin kendisi.
///
/// Metin alanları şablondan kopyalanır ve yer tutucular doldurulmuş hâlde saklanır;
/// belge kendi başına ayakta durur.
/// </summary>
public sealed class ConsentFormRecord : IBranchScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }

    /// <summary>StudentProfile.Id — okul ve sürücü kursu için ortak öğrenci kimliği.</summary>
    public Guid StudentProfileId { get; set; }

    /// <summary>Öğrencinin kullanıcı kimliği (varsa) — cari/finans ekranlarıyla eşleşme için.</summary>
    public Guid? StudentUserId { get; set; }

    public string StudentName { get; set; } = string.Empty;

    public ConsentContextKind ContextKind { get; set; }
    public string ContextKey { get; set; } = string.Empty;

    /// <summary>Randevu / sözleşme / mezuniyet kaydının kimliği — kapı sorgusu bununla yapılır.</summary>
    public Guid? ContextRefId { get; set; }

    /// <summary>Belgeye basılan bağlam etiketi (ör. "B Sınıfı Direksiyon Dersi").</summary>
    public string ContextLabel { get; set; } = string.Empty;

    /// <summary>Şablon silinse de kayıt yaşar; bu yüzden nullable ve SET NULL.</summary>
    public Guid? TemplateId { get; set; }

    // ─── Şablondan kopyalanan belge gövdesi ───────────────────────────────────
    public string Title { get; set; } = string.Empty;

    /// <summary>Şablondan kopyalanır; kayıt açıldıktan sonra değişmez.</summary>
    public ConsentDocumentSource SourceKind { get; set; } = ConsentDocumentSource.Text;

    /// <summary>
    /// PDF kaynaklı kaydın belgesi. Şablonun belgesi sonradan değiştirilse bile
    /// kayıt İMZALANDIĞI belgeye bağlı kalır — imzalı belge geriye dönük değişmez.
    /// </summary>
    public Guid? DocumentId { get; set; }

    public string Body { get; set; } = string.Empty;
    public string CheckItemsJson { get; set; } = "[]";
    public bool RequiresSignature { get; set; } = true;
    public ConsentSignerRole SignerRole { get; set; } = ConsentSignerRole.StudentOrParent;

    // ─── Uygulayan personel ───────────────────────────────────────────────────
    public Guid? StaffUserId { get; set; }

    /// <summary>Belgeye basılan personel adı. E-posta ASLA yazılmaz — ad yoksa boş kalır.</summary>
    public string StaffName { get; set; } = string.Empty;

    /// <summary>Personelin uygulama notu (bölge, uyarı, özel durum).</summary>
    public string StaffNotes { get; set; } = string.Empty;

    // ─── İmza oturumu ─────────────────────────────────────────────────────────
    public ConsentFormStatus Status { get; set; } = ConsentFormStatus.Draft;

    /// <summary>Tek kullanımlık oturum anahtarı; imzadan sonra null'lanır.</summary>
    public Guid? SessionToken { get; set; }

    /// <summary>
    /// Hedef tabletin adı. ŞİFRELENMEZ / dönüştürülmez: tablet yoklaması bu kolonla
    /// eşleşme yapıyor. Karşılaştırma için normalize edilmiş kopyası ayrı tutulur.
    /// </summary>
    public string StationName { get; set; } = string.Empty;

    /// <summary>Baş/son boşluk ve büyük-küçük harf farkını tolere eden eşleşme anahtarı.</summary>
    public string StationKey { get; set; } = string.Empty;

    public DateTime? SessionExpiresAtUtc { get; set; }

    // ─── İmza ─────────────────────────────────────────────────────────────────
    /// <summary>Müşterinin işaretlediği maddelerin indeks dizisi (JSON).</summary>
    public string CheckedItemsJson { get; set; } = "[]";

    /// <summary>base64 PNG — beyaz zeminli imza görseli.</summary>
    public string SignatureImage { get; set; } = string.Empty;

    public DateTime? SignedAtUtc { get; set; }
    public string SignerName { get; set; } = string.Empty;

    /// <summary>İmzalayanın öğrenciye yakınlığı (veli imzasında "Anne", "Baba"…).</summary>
    public string SignerRelation { get; set; } = string.Empty;

    public string SignerDevice { get; set; } = string.Empty;
    public string SignerIp { get; set; } = string.Empty;

    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Kurumdaki imza tabletlerinin kaydı. Personel ekranında serbest metin yerine
/// AÇIK tabletlerin listesi gösterilsin diye tutulur — yazım hatası yüzünden
/// formun "hiçbir yere" gitmesini engeller.
///
/// Tablet her yoklamada kendini bildirir; <see cref="LastSeenAtUtc"/> tazeliği
/// "çevrimiçi/çevrimdışı" rozetini belirler.
/// </summary>
public sealed class ConsentSignatureStation : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid? BranchId { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>Eşleşme anahtarı: kırpılmış + küçük harfe indirgenmiş ad.</summary>
    public string StationKey { get; set; } = string.Empty;

    public string DeviceInfo { get; set; } = string.Empty;
    public DateTime LastSeenAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
