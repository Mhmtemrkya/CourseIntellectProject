namespace CourseIntellect.Application.Interfaces;

/// <summary>Resmî kimlik doğrulama servisinin sonucu.</summary>
public enum IdentityVerificationStatus
{
    /// <summary>Devlet kaydıyla eşleşti.</summary>
    Verified,

    /// <summary>Devlet kaydıyla eşleşmedi (ad, soyad, TC veya doğum yılı hatalı).</summary>
    Mismatch,

    /// <summary>Servis yapılandırılmamış — kurumda KPS aboneliği tanımlı değil.</summary>
    NotConfigured,

    /// <summary>Servis yapılandırılmış ama şu an ulaşılamıyor / yanıtı çözümlenemedi.</summary>
    Unavailable,
}

public sealed record IdentityVerificationResult(IdentityVerificationStatus Status, string? Detail = null);

/// <summary>
/// Resmî kimlik doğrulama (NVİ/KPS). Kayıt sırasında TC + ad + soyad + doğum yılı
/// devlet kaydıyla karşılaştırılır ki MEBBİS'e girişte "kimlik uyuşmuyor" retleri
/// yaşanmasın.
/// </summary>
/// <remarks>
/// NVİ'nin eskiden herkese açık olan <c>KPSPublic.asmx</c> SOAP servisi KAPATILDI
/// (bugün GET 302 → hata sayfası, POST 404 döner). Bu yüzden doğrulama artık
/// YAPILANDIRMAYA bağlıdır: kurumun KPS aboneliği varsa uç nokta tanımlanır,
/// yoksa <see cref="IdentityVerificationStatus.NotConfigured"/> döner ve arayüz
/// bunu "doğrulanamadı" gibi değil, "bu kurumda tanımlı değil" diye gösterir.
/// Servis yokken bile kayıt akışı yerel kontrollerle (TC kontrol basamağı, yaş,
/// mükerrer kayıt) korunur.
/// </remarks>
public interface IIdentityVerificationService
{
    /// <summary>Servis bu kurulumda kullanılabilir mi (uç nokta tanımlı mı)?</summary>
    bool IsConfigured { get; }

    Task<IdentityVerificationResult> VerifyTurkishIdAsync(
        string identityNumber,
        string firstName,
        string lastName,
        int birthYear,
        CancellationToken cancellationToken = default);
}
