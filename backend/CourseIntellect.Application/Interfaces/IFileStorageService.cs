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
}
