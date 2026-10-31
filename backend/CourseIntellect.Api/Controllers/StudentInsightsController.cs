using CourseIntellect.Api.Authorization;
using CourseIntellect.Api.Security;
using CourseIntellect.Application.DTOs.Insights;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Öğrenci konu analizi (hangi öğrenci hangi konuda zorlanıyor) ve öğretmen notu.
/// İlk sürümde yalnız personel: öğretmen (rehber dahil) ve kurum yöneticisi / şube müdürü.
/// Şube müdürü öğrenci listesi şube filtresiyle kendi şubesine kilitlidir. Öğrenci ve veli
/// görünümü, öğretmenlerin not kalitesini değerlendirmesinden sonra açılacak.
/// </summary>
[ApiController]
[Authorize(Roles = "Admin,Teacher")]
[Route("api/insights")]
[RequireEntitlement("student-insights")]
public sealed class StudentInsightsController(IStudentInsightService service) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetOverview(CancellationToken cancellationToken)
        => Ok(await service.GetOverviewAsync(cancellationToken));

    [HttpGet("classes/{className}")]
    public async Task<IActionResult> GetClass(string className, CancellationToken cancellationToken)
    {
        var result = await service.GetClassAsync(className, cancellationToken);
        return result is null ? NotFound(new { message = "Sınıf bulunamadı." }) : Ok(result);
    }

    [HttpGet("students/{studentUserId:guid}")]
    public async Task<IActionResult> GetStudent(Guid studentUserId, CancellationToken cancellationToken)
    {
        var result = await service.GetStudentAsync(studentUserId, cancellationToken);
        return result is null ? NotFound(new { message = "Öğrenci bulunamadı." }) : Ok(result);
    }

    [HttpPost("students/{studentUserId:guid}/note")]
    public async Task<IActionResult> RequestNote(Guid studentUserId, CancellationToken cancellationToken)
    {
        try
        {
            var result = await service.RequestNoteAsync(studentUserId, StudentScope.ResolveUserId(User), cancellationToken);
            return result is null ? NotFound(new { message = "Öğrenci bulunamadı." }) : Ok(result);
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("notes/{noteId:guid}/review")]
    public async Task<IActionResult> ReviewNote(Guid noteId, [FromBody] ReviewInsightNoteRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await service.ReviewNoteAsync(noteId, request, StudentScope.ResolveUserId(User), cancellationToken);
            return result is null ? NotFound(new { message = "Not bulunamadı." }) : Ok(result);
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }
}
