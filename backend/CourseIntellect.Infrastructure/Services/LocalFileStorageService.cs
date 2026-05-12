using CourseIntellect.Application.DTOs.Contents;
using CourseIntellect.Application.Interfaces;
using Microsoft.Extensions.Hosting;

namespace CourseIntellect.Infrastructure.Services;

public sealed class LocalFileStorageService(IHostEnvironment environment) : IFileStorageService
{
    public async Task<UploadedAssetDto> SaveAsync(
        Stream stream,
        string fileName,
        string contentType,
        string folder,
        string baseUrl,
        CancellationToken cancellationToken = default)
    {
        var safeFolder = string.IsNullOrWhiteSpace(folder) ? "general" : folder.Trim().ToLowerInvariant();
        var webRoot = Path.Combine(environment.ContentRootPath, "wwwroot");
        var uploadsRoot = Path.Combine(webRoot, "uploads", safeFolder);
        Directory.CreateDirectory(uploadsRoot);

        var extension = Path.GetExtension(fileName);
        var baseName = Path.GetFileNameWithoutExtension(fileName);
        var safeName = string.Concat(baseName.Where(ch => char.IsLetterOrDigit(ch) || ch is '-' or '_')).Trim();
        if (string.IsNullOrWhiteSpace(safeName))
        {
            safeName = "asset";
        }

        var finalFileName = $"{safeName}-{Guid.NewGuid():N}{extension}";
        var physicalPath = Path.Combine(uploadsRoot, finalFileName);

        await using var target = File.Create(physicalPath);
        await stream.CopyToAsync(target, cancellationToken);
        await target.FlushAsync(cancellationToken);

        var info = new FileInfo(physicalPath);
        var relative = $"/uploads/{safeFolder}/{finalFileName}";

        return new UploadedAssetDto(
            fileName,
            relative,
            string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType,
            info.Length);
    }
}
