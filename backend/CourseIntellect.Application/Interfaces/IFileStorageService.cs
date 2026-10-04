using CourseIntellect.Application.DTOs.Contents;

namespace CourseIntellect.Application.Interfaces;

public interface IFileStorageService
{
    Task<UploadedAssetDto> SaveAsync(
        Stream stream,
        string fileName,
        string contentType,
        string folder,
        string baseUrl,
        CancellationToken cancellationToken = default);

    Task<byte[]?> ReadBytesAsync(
        string fileUrl,
        CancellationToken cancellationToken = default);

    /// <summary>Dosyanın tamamını belleğe almadan güvenli depodaki ilk baytları okur.</summary>
    Task<StoredFilePrefixDto?> ReadPrefixAsync(
        string fileUrl,
        int maxBytes,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Verilen /uploads URL'sine karşılık gelen fiziksel dosyayı güvenli şekilde siler
    /// (kök dışına çıkış engellenir). Hesap/kurum silmede kişisel medyayı diskten kaldırmak için.
    /// Dosya yoksa veya URL depo dışıysa false döner (hata atmaz).
    /// </summary>
    Task<bool> DeleteAsync(
        string fileUrl,
        CancellationToken cancellationToken = default);
}

public sealed record StoredFilePrefixDto(byte[] Bytes, long Length);
