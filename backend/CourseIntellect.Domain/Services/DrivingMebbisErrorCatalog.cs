using CourseIntellect.Domain.Entities;

namespace CourseIntellect.Domain.Services;

public sealed record DrivingMebbisErrorTemplate(string Code, string Title, string Description,
    string PossibleCause, DrivingMebbisErrorSeverity Severity, params string[] ResolutionSteps);

public static class DrivingMebbisErrorCatalog
{
    public const string IdentityMismatch = "IDENTITY_MISMATCH";
    public const string DuplicateActiveEnrollment = "DUPLICATE_ACTIVE_ENROLLMENT";
    public const string MinimumAge = "MINIMUM_AGE";
    public const string TermQuotaFull = "TERM_QUOTA_FULL";
    public const string HealthReportMissing = "HEALTH_REPORT_MISSING";
    public const string PhotoFormatInvalid = "PHOTO_FORMAT_INVALID";
    public const string LicenseClassMismatch = "LICENSE_CLASS_MISMATCH";
    public const string General = "GENERAL_MEBBIS_ERROR";

    public static IReadOnlyList<DrivingMebbisErrorTemplate> Defaults { get; } = new DrivingMebbisErrorTemplate[]
    {
        new(IdentityMismatch, "TC kimlik bilgileri uyuşmuyor", "Kursiyer kimlik bilgileri MEBBİS veya resmî kimlik kaydıyla eşleşmiyor.", "TC kimlik, ad-soyad, doğum tarihi ya da anne/baba adı yanlış veya güncel olmayabilir.", DrivingMebbisErrorSeverity.Blocking, "Kimlik belgesini ve kursiyer kaydını karşılaştırın.", "Alanları resmî belgedeki biçimiyle düzeltin.", "MEBBİS girişini tekrar deneyip sonucu doğrulayın."),
        new(DuplicateActiveEnrollment, "Aynı adayın aktif kaydı var", "Aynı kursiyer için ikinci bir açık kayıt tespit edildi.", "Başka dönem veya kurumda kapanmamış aday kaydı bulunabilir.", DrivingMebbisErrorSeverity.Blocking, "Kursiyerin açık dönem kayıtlarını kontrol edin.", "Mükerrer kaydı kapatın veya yetkili kurumla iletişime geçin.", "Aktif kayıt kalmadığını doğrulayın."),
        new(MinimumAge, "Yaş şartı sağlanmıyor", "Seçilen sertifika sınıfının asgari yaş şartı karşılanmıyor.", "Doğum tarihi veya sertifika sınıfı yanlış olabilir; başvuru tarihi erken olabilir.", DrivingMebbisErrorSeverity.Blocking, "Doğum tarihini kimlikten doğrulayın.", "Sertifika sınıfını kontrol edin.", "Uygun tarihe kadar kaydı bekletin."),
        new(TermQuotaFull, "Dönem kontenjanı dolu", "Dönem kontenjanı yeni aday kabul etmiyor.", "Kontenjan dolmuş veya sistemdeki liste MEBBİS ile uyuşmuyor olabilir.", DrivingMebbisErrorSeverity.Blocking, "Dönem listesini mutabakat ekranında karşılaştırın.", "Hatalı dönem atamalarını düzeltin.", "Gerekirse adayı uygun başka döneme taşıyın."),
        new(HealthReportMissing, "Sağlık raporu bilgisi eksik", "Geçerli ve onaylı sağlık raporu bulunmuyor.", "Belge yüklenmemiş, reddedilmiş veya geçerlilik tarihi geçmiş olabilir.", DrivingMebbisErrorSeverity.Blocking, "Evrak onay kuyruğunu kontrol edin.", "Geçerli raporu yeniden yükletin.", "Belgeyi onaylayıp son geçerlilik tarihini doğrulayın."),
        new(PhotoFormatInvalid, "Fotoğraf formatı uygun değil", "Biyometrik fotoğraf dosyası MEBBİS kalite veya biçim şartlarını karşılamıyor.", "Dosya türü, ölçü, çözünürlük, ışık, arka plan veya yüz sayısı uygun olmayabilir.", DrivingMebbisErrorSeverity.Blocking, "Fotoğraf kalite denetimi sonuçlarını açın.", "Uygun biyometrik fotoğrafı yeniden yükletin.", "MEBBİS için üretilen JPEG kopyasını kullanın."),
        new(LicenseClassMismatch, "Sertifika sınıfı uyuşmuyor", "Aday sertifika sınıfı ile dönem, araç veya mevcut kayıt bilgileri uyuşmuyor.", "Yanlış sınıf seçilmiş veya dönem/araç ataması hatalı olabilir.", DrivingMebbisErrorSeverity.Blocking, "Adayın talep ettiği sertifika sınıfını doğrulayın.", "Dönem ve araç sınıfını karşılaştırın.", "Uyumsuz atamayı düzelterek kalite kontrolünü yenileyin."),
        new(General, "Diğer MEBBİS hatası", "Standart hata kartlarından biriyle eşleşmeyen MEBBİS işlemi sorunu.", "MEBBİS uyarısı, eksik veri veya kurum içi işlem hatası olabilir.", DrivingMebbisErrorSeverity.Warning, "Hata mesajını kişisel veri içermeden kaydedin.", "İlgili kursiyer ve işlemi kontrol edin.", "Çözümü kayıt üzerinde belgeleyip gerekiyorsa yeni bir hata kartı oluşturun."),
    };
}
