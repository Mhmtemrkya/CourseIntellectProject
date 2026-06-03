using CourseIntellect.Application.DTOs.Contents;
using CourseIntellect.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace CourseIntellect.Infrastructure.Services;

public sealed class LocalFileStorageService(IHostEnvironment environment, IConfiguration configuration) : IFileStorageService
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
        var uploadsRoot = Path.Combine(UploadStoragePathResolver.ResolveUploadsRoot(environment, configuration), safeFolder);
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

    public async Task<byte[]?> ReadBytesAsync(string fileUrl, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(fileUrl)) return null;

        var relativePath = Uri.TryCreate(fileUrl, UriKind.Absolute, out var absoluteUri)
            ? absoluteUri.AbsolutePath
            : fileUrl;
        relativePath = relativePath.Replace('\\', '/').TrimStart('/');
        if (!relativePath.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase)) return null;

        var uploadsRoot = UploadStoragePathResolver.ResolveUploadsRoot(environment, configuration);
        var uploadRelativePath = relativePath["uploads/".Length..];
        var physicalPath = Path.GetFullPath(Path.Combine(uploadsRoot, uploadRelativePath.Replace('/', Path.DirectorySeparatorChar)));
        var uploadsRootWithSeparator = Path.EndsInDirectorySeparator(uploadsRoot)
            ? uploadsRoot
            : uploadsRoot + Path.DirectorySeparatorChar;
        if (!physicalPath.StartsWith(uploadsRootWithSeparator, StringComparison.OrdinalIgnoreCase)
            || !File.Exists(physicalPath))
        {
            return null;
        }

        return await File.ReadAllBytesAsync(physicalPath, cancellationToken);
    }
}
