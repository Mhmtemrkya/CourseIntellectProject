using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class UploadsController(IFileStorageService fileStorageService) : ControllerBase
{
    private const long MaxUploadSizeBytes = 10L * 1024 * 1024 * 1024;
    private const int MaxChunkSizeBytes = 768 * 1024;
    private const string MaxUploadSizeLabel = "10 GB";

    [HttpPost]
    [RequestSizeLimit(MaxUploadSizeBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadSizeBytes)]
    public async Task<IActionResult> Upload([FromForm] IFormFile file, [FromForm] string? folder, CancellationToken cancellationToken)
    {
        if (file.Length <= 0)
        {
            return BadRequest("Boş dosya yüklenemez.");
        }

        if (file.Length > MaxUploadSizeBytes)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, new
            {
                message = $"Dosya boyutu {MaxUploadSizeLabel} sınırını aşıyor.",
            });
        }

        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        await using var stream = file.OpenReadStream();
        var result = await fileStorageService.SaveAsync(
            stream,
            file.FileName,
            file.ContentType,
            string.IsNullOrWhiteSpace(folder) ? "general" : folder,
            baseUrl,
            cancellationToken);

        return Ok(result);
    }

    [HttpPost("json")]
    [RequestSizeLimit(MaxUploadSizeBytes)]
    public async Task<IActionResult> UploadJson([FromBody] JsonFileUploadRequest request, [FromQuery] string? folder, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.FileName) || string.IsNullOrWhiteSpace(request.Base64Content))
        {
            return BadRequest(new { message = "Dosya adı ve içerik zorunludur." });
        }

        byte[] contentBytes;
        try
        {
            contentBytes = Convert.FromBase64String(request.Base64Content.Trim());
        }
        catch (FormatException)
        {
            return BadRequest(new { message = "Base64 içerik geçersiz." });
        }

        if (contentBytes.Length == 0)
        {
            return BadRequest(new { message = "Boş dosya yüklenemez." });
        }

        if (contentBytes.LongLength > MaxUploadSizeBytes)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, new
            {
                message = $"Dosya boyutu {MaxUploadSizeLabel} sınırını aşıyor.",
            });
        }

        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        await using var stream = new MemoryStream(contentBytes);
        var result = await fileStorageService.SaveAsync(
            stream,
            request.FileName,
            request.ContentType ?? "application/octet-stream",
            string.IsNullOrWhiteSpace(folder) ? "general" : folder,
            baseUrl,
            cancellationToken);

        return Ok(result);
    }

    [HttpPost("chunk")]
    [RequestSizeLimit(MaxUploadSizeBytes)]
    public async Task<IActionResult> UploadChunk([FromBody] ChunkedFileUploadRequest request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(request.UploadId, out var uploadId))
        {
            return BadRequest(new { message = "Yükleme kimliği geçersiz." });
        }

        if (string.IsNullOrWhiteSpace(request.FileName) || string.IsNullOrWhiteSpace(request.Base64Content))
        {
            return BadRequest(new { message = "Dosya adı ve parça içeriği zorunludur." });
        }

        if (request.TotalChunks <= 0 || request.ChunkIndex < 0 || request.ChunkIndex >= request.TotalChunks)
        {
            return BadRequest(new { message = "Dosya parça bilgisi geçersiz." });
        }

        if (request.TotalSize <= 0 || request.TotalSize > MaxUploadSizeBytes)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, new
            {
                message = $"Dosya boyutu {MaxUploadSizeLabel} sınırını aşıyor.",
            });
        }

        if (request.StartByte < 0 || request.StartByte >= request.TotalSize)
        {
            return BadRequest(new { message = "Dosya parça konumu geçersiz." });
        }

        byte[] chunkBytes;
        try
        {
            chunkBytes = Convert.FromBase64String(request.Base64Content.Trim());
        }
        catch (FormatException)
        {
            return BadRequest(new { message = "Base64 parça içeriği geçersiz." });
        }

        if (chunkBytes.Length == 0)
        {
            return BadRequest(new { message = "Boş dosya parçası yüklenemez." });
        }

        if (chunkBytes.Length > MaxChunkSizeBytes)
        {
            return StatusCode(StatusCodes.Status413PayloadTooLarge, new
            {
                message = "Dosya parçası 768 KB sınırını aşıyor.",
            });
        }

        if (request.StartByte + chunkBytes.LongLength > request.TotalSize)
        {
            return BadRequest(new { message = "Dosya parçası toplam dosya boyutunu aşıyor." });
        }

        var chunksRoot = Path.Combine(Path.GetTempPath(), "courseintellect-upload-chunks");
        Directory.CreateDirectory(chunksRoot);
        var tempPath = Path.Combine(chunksRoot, $"{uploadId:N}.part");

        await using (var tempStream = new FileStream(tempPath, FileMode.OpenOrCreate, FileAccess.Write, FileShare.None))
        {
            tempStream.Position = request.StartByte;
            await tempStream.WriteAsync(chunkBytes, cancellationToken);
        }

        if (request.ChunkIndex < request.TotalChunks - 1)
        {
            return Ok(new { uploadId = request.UploadId, received = request.ChunkIndex + 1, complete = false });
        }

        var fileInfo = new FileInfo(tempPath);
        if (fileInfo.Length != request.TotalSize)
        {
            return BadRequest(new { message = "Dosya parçaları tamamlanmadı." });
        }

        if (fileInfo.Length > MaxUploadSizeBytes)
        {
            System.IO.File.Delete(tempPath);
            return StatusCode(StatusCodes.Status413PayloadTooLarge, new
            {
                message = $"Dosya boyutu {MaxUploadSizeLabel} sınırını aşıyor.",
            });
        }

        try
        {
            var baseUrl = $"{Request.Scheme}://{Request.Host}";
            await using var finalStream = System.IO.File.OpenRead(tempPath);
            var result = await fileStorageService.SaveAsync(
                finalStream,
                request.FileName,
                request.ContentType ?? "application/octet-stream",
                string.IsNullOrWhiteSpace(request.Folder) ? "general" : request.Folder,
                baseUrl,
                cancellationToken);

            return Ok(result);
        }
        finally
        {
            if (System.IO.File.Exists(tempPath))
            {
                System.IO.File.Delete(tempPath);
            }
        }
    }
}

public sealed class JsonFileUploadRequest
{
    public string FileName { get; set; } = string.Empty;
    public string Base64Content { get; set; } = string.Empty;
    public string? ContentType { get; set; }
}

public sealed class ChunkedFileUploadRequest
{
    public string UploadId { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string Base64Content { get; set; } = string.Empty;
    public string? ContentType { get; set; }
    public string? Folder { get; set; }
    public long StartByte { get; set; }
    public long TotalSize { get; set; }
    public int ChunkIndex { get; set; }
    public int TotalChunks { get; set; }
}
