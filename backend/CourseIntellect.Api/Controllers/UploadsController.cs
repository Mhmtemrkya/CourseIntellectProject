using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class UploadsController(IFileStorageService fileStorageService) : ControllerBase
{
    [HttpPost]
    [RequestSizeLimit(100_000_000)]
    public async Task<IActionResult> Upload([FromForm] IFormFile file, [FromForm] string? folder, CancellationToken cancellationToken)
    {
        if (file.Length <= 0)
        {
            return BadRequest("Boş dosya yüklenemez.");
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
    [RequestSizeLimit(100_000_000)]
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
}

public sealed class JsonFileUploadRequest
{
    public string FileName { get; set; } = string.Empty;
    public string Base64Content { get; set; } = string.Empty;
    public string? ContentType { get; set; }
}
