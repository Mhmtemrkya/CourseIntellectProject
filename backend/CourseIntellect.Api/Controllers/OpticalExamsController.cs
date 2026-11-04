using CourseIntellect.Api.Authorization;
using CourseIntellect.Api.Security;
using CourseIntellect.Application.DTOs.OpticalExams;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Optik okuyucu dosyasından deneme sonucu aktarımı. Kurum yöneticisi / şube müdürü ve
/// öğretmen (rehber dahil). Önizleme hiçbir şey yazmaz; içe aktarma onayla yapılır.
/// </summary>
[ApiController]
[Authorize(Roles = "Admin,Teacher")]
[Route("api/optical-exams")]
[RequireEntitlement("optical-exams")]
public sealed class OpticalExamsController(
    IOpticalExamService service,
    IOpticalTemplateSuggester suggester,
    IOpticalStudyPlanService studyPlans,
    IEntitlementService entitlements) : ControllerBase
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    [HttpGet("templates")]
    public async Task<IActionResult> ListTemplates(CancellationToken cancellationToken) => Ok(await service.ListTemplatesAsync(cancellationToken));

    [HttpPost("templates")]
    public Task<IActionResult> CreateTemplate([FromBody] SaveOpticalTemplateRequest request, CancellationToken cancellationToken)
        => Run(async () => Ok(await service.SaveTemplateAsync(null, request, cancellationToken)));

    [HttpPut("templates/{id:guid}")]
    public Task<IActionResult> UpdateTemplate(Guid id, [FromBody] SaveOpticalTemplateRequest request, CancellationToken cancellationToken)
        => Run(async () => Ok(await service.SaveTemplateAsync(id, request, cancellationToken)));

    /// <summary>Dosyadan şablon önerisi. Yalnız öneri döner; şablon, öğrenci ya da sonuç kaydetmez.</summary>
    [HttpPost("templates/suggest")]
    [RequestSizeLimit(6_000_000)]
    public Task<IActionResult> SuggestTemplate(IFormFile file, [FromForm] string? encoding, CancellationToken cancellationToken)
        => Run(async () => Ok(await suggester.SuggestAsync(await ReadAsync(file, cancellationToken), encoding, cancellationToken)));

    [HttpDelete("templates/{id:guid}")]
    public Task<IActionResult> DeleteTemplate(Guid id, CancellationToken cancellationToken)
        => Run(async () => { await service.DeleteTemplateAsync(id, cancellationToken); return NoContent(); });

    [HttpGet]
    public async Task<IActionResult> ListExams(CancellationToken cancellationToken) => Ok(await service.ListExamsAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetExam(Guid id, CancellationToken cancellationToken)
    {
        var result = await service.GetExamAsync(id, cancellationToken);
        return result is null ? NotFound(new { message = "Deneme bulunamadı." }) : Ok(result);
    }

    [HttpPost]
    public Task<IActionResult> CreateExam([FromBody] SaveOpticalExamRequest request, CancellationToken cancellationToken)
        => Run(async () => Ok(await service.SaveExamAsync(null, request, cancellationToken)));

    [HttpPut("{id:guid}")]
    public Task<IActionResult> UpdateExam(Guid id, [FromBody] SaveOpticalExamRequest request, CancellationToken cancellationToken)
        => Run(async () => Ok(await service.SaveExamAsync(id, request, cancellationToken)));

    [HttpDelete("{id:guid}")]
    public Task<IActionResult> DeleteExam(Guid id, CancellationToken cancellationToken)
        => Run(async () => { await service.DeleteExamAsync(id, cancellationToken); return NoContent(); });

    [HttpPost("{id:guid}/preview")]
    [RequestSizeLimit(6_000_000)]
    public Task<IActionResult> Preview(Guid id, IFormFile file, [FromForm] string? encoding, CancellationToken cancellationToken)
        => Run(async () => Ok(await service.PreviewAsync(id, await ReadAsync(file, cancellationToken), encoding, cancellationToken)));

    /// <summary>overrides: [{ "line": 3, "studentUserId": "…" | null }] — null satırı atlar.</summary>
    [HttpPost("{id:guid}/import")]
    [RequestSizeLimit(6_000_000)]
    public Task<IActionResult> Import(Guid id, IFormFile file, [FromForm] string? encoding, [FromForm] string? overrides, CancellationToken cancellationToken)
        => Run(async () =>
        {
            var parsedOverrides = string.IsNullOrWhiteSpace(overrides)
                ? []
                : JsonSerializer.Deserialize<List<OpticalMatchOverrideDto>>(overrides, Json) ?? [];
            return Ok(await service.ImportAsync(id, await ReadAsync(file, cancellationToken), encoding, file.FileName,
                parsedOverrides, StudentScope.ResolveUserId(User), cancellationToken));
        });

    [HttpGet("{id:guid}/results")]
    public async Task<IActionResult> Results(Guid id, CancellationToken cancellationToken)
    {
        var result = await service.GetResultsAsync(id, cancellationToken);
        return result is null ? NotFound(new { message = "Deneme bulunamadı." }) : Ok(result);
    }

    /// <summary>Soru konusu listesi: ?level=LGS&amp;subject=Türkçe&amp;subject=Matematik</summary>
    [HttpGet("topics")]
    public async Task<IActionResult> Topics([FromQuery] string? level, [FromQuery(Name = "subject")] string[]? subjects, CancellationToken cancellationToken)
        => Ok(await service.GetTopicsAsync(level, subjects ?? [], cancellationToken));

    /// <summary>Kurum listesine konu ekler; hazır listede ya da kurum listesinde varsa mevcut yazımı döner.</summary>
    [HttpPost("topics")]
    public Task<IActionResult> AddTopic([FromBody] AddOpticalTopicRequest request, CancellationToken cancellationToken)
        => Run(async () => Ok(await service.AddTopicAsync(request, StudentScope.ResolveUserId(User), cancellationToken)));

    [HttpDelete("topics/{id:guid}")]
    public Task<IActionResult> DeleteTopic(Guid id, CancellationToken cancellationToken)
        => Run(async () => { await service.DeleteTopicAsync(id, cancellationToken); return NoContent(); });

    /// <summary>Deneme sonrası çalışma planı önizlemesi (hiçbir şey yazmaz).</summary>
    [HttpGet("{id:guid}/study-plans")]
    public Task<IActionResult> StudyPlans(Guid id, CancellationToken cancellationToken)
        => Run(async () => Ok(await studyPlans.PreviewAsync(id, await entitlements.IsAllowedAsync(User, "study-plan", null, cancellationToken), cancellationToken)));

    /// <summary>Öğretmenin onayladığı görevleri öğrencilerin çalışma programına ekler; isteğe bağlı veli özeti.</summary>
    [HttpPost("{id:guid}/study-plans/apply")]
    public Task<IActionResult> ApplyStudyPlans(Guid id, [FromBody] ApplyOpticalStudyPlansRequest request, CancellationToken cancellationToken)
        => Run(async () => Ok(await studyPlans.ApplyAsync(id, request, StudentScope.ResolveUserId(User), cancellationToken)));

    [HttpGet("students")]
    public async Task<IActionResult> SearchStudents([FromQuery] string? search, CancellationToken cancellationToken)
        => Ok(await service.SearchStudentsAsync(search, cancellationToken));

    private static async Task<byte[]> ReadAsync(IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0) throw new ArgumentException("Optik dosyası seçilmedi.");
        await using var stream = new MemoryStream();
        await file.CopyToAsync(stream, cancellationToken);
        return stream.ToArray();
    }

    private async Task<IActionResult> Run(Func<Task<IActionResult>> action)
    {
        try
        {
            return await action();
        }
        catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (JsonException) { return BadRequest(new { message = "Eşleştirme listesi okunamadı." }); }
    }
}
