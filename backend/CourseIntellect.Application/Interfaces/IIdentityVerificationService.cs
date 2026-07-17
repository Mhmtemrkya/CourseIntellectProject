namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Resmî kimlik doğrulama (NVİ). Kayıt sırasında TC + ad + soyad + doğum yılı
/// devlet kaydıyla karşılaştırılır ki MEBBİS'e girişte "kimlik uyuşmuyor"
/// retleri yaşanmasın.
/// </summary>
public interface IIdentityVerificationService
{
    /// <summary>
    /// NVİ'den kimlik doğrular. <c>true</c> = doğrulandı, <c>false</c> = kayıtla
    /// eşleşmedi, <c>null</c> = servise ulaşılamadı (kayıt engellenmez).
    /// </summary>
    Task<bool?> VerifyTurkishIdAsync(
        string identityNumber,
        string firstName,
        string lastName,
        int birthYear,
        CancellationToken cancellationToken = default);
}
