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
        // Klasör istemciden gelir: ".." / mutlak yol / ayraç oyunları burada durur.
        // Geçersizse sessizce "general"a düşürmek yerine hata veririz — dosyanın
        // beklenmedik bir yere yazılması sessizce yutulmamalıdır.
        if (!UploadPathSafety.TrySanitizeFolder(folder, out var safeFolder))
        {
            throw new InvalidOperationException("Geçersiz yükleme klasörü.");
        }

        var storageRoot = UploadStoragePathResolver.ResolveUploadsRoot(environment, configuration);
        var uploadsRoot = Path.GetFullPath(Path.Combine(storageRoot, safeFolder.Replace('/', Path.DirectorySeparatorChar)));

        // Sanitizasyondan sonraki son kapı: hedef gerçekten kökün altında mı?
        if (!UploadPathSafety.IsWithinRoot(storageRoot, uploadsRoot))
        {
            throw new InvalidOperationException("Geçersiz yükleme klasörü.");
        }

        Directory.CreateDirectory(uploadsRoot);

        // Uzantı sunucu beyaz listesinden gelir; istemci ".html"/".svg" göndererek
        // aynı origin altında aktif içerik yayınlayamaz.
        var extension = UploadPathSafety.ResolveSafeExtension(fileName);
        var safeName = UploadPathSafety.SanitizeBaseName(fileName);

        // İçerik denetimi: dosyanın başı uzantının imzasıyla uyuşmalı (diske
        // yazmadan önce). Uyuşmazsa hiçbir şey yazılmaz.
        var header = new byte[FileSignatureValidator.HeaderLength];
        var headerLength = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false, cancellationToken);
        if (headerLength == 0 || !FileSignatureValidator.Matches(extension, header.AsSpan(0, headerLength)))
        {
            throw new CourseIntellect.Application.Exceptions.UploadRejectedException("Dosya içeriği uzantısıyla uyuşmuyor ya da dosya boş. Geçerli bir dosya seçin.");
        }

        var finalFileName = $"{safeName}-{Guid.NewGuid():N}{extension}";
        var physicalPath = Path.Combine(uploadsRoot, finalFileName);

        await using (var target = File.Create(physicalPath))
        {
            await target.WriteAsync(header.AsMemory(0, headerLength), cancellationToken);
            await stream.CopyToAsync(target, cancellationToken);
            await target.FlushAsync(cancellationToken);
        }

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

    public Task<bool> DeleteAsync(string fileUrl, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(fileUrl)) return Task.FromResult(false);

        var relativePath = Uri.TryCreate(fileUrl, UriKind.Absolute, out var absoluteUri)
            ? absoluteUri.AbsolutePath
            : fileUrl;
        relativePath = relativePath.Replace('\\', '/').TrimStart('/');
        if (!relativePath.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase)) return Task.FromResult(false);

        var uploadsRoot = UploadStoragePathResolver.ResolveUploadsRoot(environment, configuration);
        var physicalPath = Path.GetFullPath(Path.Combine(uploadsRoot, relativePath["uploads/".Length..].Replace('/', Path.DirectorySeparatorChar)));
        var uploadsRootWithSeparator = Path.EndsInDirectorySeparator(uploadsRoot)
            ? uploadsRoot
            : uploadsRoot + Path.DirectorySeparatorChar;
        // Kök dışına çıkış koruması — asla uploads kökü dışında silme.
        if (!physicalPath.StartsWith(uploadsRootWithSeparator, StringComparison.OrdinalIgnoreCase)
            || !File.Exists(physicalPath))
        {
            return Task.FromResult(false);
        }

        try
        {
            File.Delete(physicalPath);
            return Task.FromResult(true);
        }
        catch (IOException)
        {
            return Task.FromResult(false);
        }
        catch (UnauthorizedAccessException)
        {
            return Task.FromResult(false);
        }
    }

    public async Task<StoredFilePrefixDto?> ReadPrefixAsync(string fileUrl, int maxBytes, CancellationToken cancellationToken = default)
    {
        if (maxBytes is < 1 or > 1024 * 1024 || string.IsNullOrWhiteSpace(fileUrl)) return null;
        var relativePath = Uri.TryCreate(fileUrl, UriKind.Absolute, out var absoluteUri) ? absoluteUri.AbsolutePath : fileUrl;
        relativePath = relativePath.Replace('\\', '/').TrimStart('/');
        if (!relativePath.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase)) return null;

        var uploadsRoot = UploadStoragePathResolver.ResolveUploadsRoot(environment, configuration);
        var physicalPath = Path.GetFullPath(Path.Combine(uploadsRoot, relativePath["uploads/".Length..].Replace('/', Path.DirectorySeparatorChar)));
        var safeRoot = Path.EndsInDirectorySeparator(uploadsRoot) ? uploadsRoot : uploadsRoot + Path.DirectorySeparatorChar;
        if (!physicalPath.StartsWith(safeRoot, StringComparison.OrdinalIgnoreCase) || !File.Exists(physicalPath)) return null;

        var info = new FileInfo(physicalPath);
        var length = (int)Math.Min(info.Length, maxBytes);
        var buffer = new byte[length];
        await using var stream = new FileStream(physicalPath, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.Asynchronous | FileOptions.SequentialScan);
        var read = await stream.ReadAtLeastAsync(buffer, length, throwOnEndOfStream: false, cancellationToken);
        return new StoredFilePrefixDto(read == buffer.Length ? buffer : buffer[..read], info.Length);
    }
}
