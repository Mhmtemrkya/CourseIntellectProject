namespace CourseIntellect.Application.Interfaces;

/// <summary>Tam yedek üretiminin sonucu (denetim kaydı ve özet için).</summary>
public sealed record TenantBackupResult(
    int TableCount,
    long RowCount,
    int FileCount,
    long FileBytes);

/// <summary>
/// Kurumun tüm verisini tek bir ZIP arşivine akıtır. Arşiv sunucuda saklanmaz;
/// doğrudan yanıt akışına yazılır (kişisel veri diskte artık bırakmamak için).
/// </summary>
public interface ITenantBackupService
{
    /// <summary>
    /// Arşivi <paramref name="output"/> akışına yazar. Akış sarılmaz/kapatılmaz.
    /// </summary>
    /// <param name="includeFiles">
    /// Yüklenmiş belgeler (evrak, fotoğraf, sertifika) da eklensin mi.
    /// Kapalıyken yalnız veri tabloları yazılır — çok daha küçük ve hızlıdır.
    /// </param>
    Task<TenantBackupResult> WriteArchiveAsync(
        Stream output,
        bool includeFiles,
        CancellationToken cancellationToken = default);
}
