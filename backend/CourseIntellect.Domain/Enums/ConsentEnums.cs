namespace CourseIntellect.Domain.Enums;

/// <summary>
/// Onam formu kaydının yaşam döngüsü.
///
/// Draft → AwaitingSignature → Signed tek yönlüdür; imzalanmış kayıt bir daha
/// değişmez (hukuki kayıttır). Cancelled yalnız imzalanmamış kayıtlar için.
/// </summary>
public enum ConsentFormStatus
{
    /// <summary>Personel hazırladı, henüz tablete gönderilmedi.</summary>
    Draft = 0,

    /// <summary>Tablete aktarıldı; imza oturumu açık.</summary>
    AwaitingSignature = 1,

    /// <summary>İmzalandı. Değiştirilemez.</summary>
    Signed = 2,

    /// <summary>İmzalanmadan iptal edildi.</summary>
    Cancelled = 3,
}

/// <summary>
/// Formun hangi iş akışına bağlandığı. Şablonlar bu türe göre "gerekli form"
/// listesine girer; kayıtlar da bu türle etiketlenir.
///
/// ContextKey ile birlikte çalışır: aynı türde daraltma yapılabilir
/// (ör. DrivingEnrollment + paket kimliği, SchoolEnrollment + program adı).
/// ContextKey boşsa şablon o türdeki TÜM kayıtlar için zorunludur.
/// </summary>
public enum ConsentContextKind
{
    /// <summary>Kuruma kayıtlı her öğrenciden bir kez istenen form (ör. KVKK açık rıza).</summary>
    General = 0,

    /// <summary>Okul kaydı / veli sözleşmesi.</summary>
    SchoolEnrollment = 1,

    /// <summary>Sürücü kursu kaydı (taahhütname, kayıt sözleşmesi, KVKK).</summary>
    DrivingEnrollment = 2,

    /// <summary>Direksiyon dersi/randevusu öncesi onay.</summary>
    DrivingLesson = 3,

    /// <summary>Mezuniyet / sertifika teslim tutanağı.</summary>
    DrivingGraduation = 4,

    /// <summary>Servis (taşıma) sözleşmesi.</summary>
    Transport = 5,

    /// <summary>Gezi / etkinlik izin belgesi.</summary>
    Trip = 6,

    /// <summary>Yemekhane / kantin izni.</summary>
    Cafeteria = 7,

    /// <summary>Sağlık / ilaç uygulama muvafakati.</summary>
    Health = 8,

    /// <summary>Fotoğraf ve görüntü kullanım izni.</summary>
    MediaRelease = 9,
}

/// <summary>
/// Belgeyi kimin imzalaması beklenir. Yalnızca ekrandaki yönlendirmeyi ve PDF'teki
/// imza etiketini belirler — imzalayanın adı her hâlükârda kayda yazılır.
/// </summary>
public enum ConsentSignerRole
{
    /// <summary>Öğrenci / kursiyerin kendisi.</summary>
    Student = 0,

    /// <summary>Veli veya yasal temsilci (18 yaş altı).</summary>
    Parent = 1,

    /// <summary>18 yaş altıysa veli, değilse öğrencinin kendisi.</summary>
    StudentOrParent = 2,
}
