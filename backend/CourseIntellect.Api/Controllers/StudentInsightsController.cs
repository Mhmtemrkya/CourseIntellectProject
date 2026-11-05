using CourseIntellect.Api.Authorization;
using CourseIntellect.Api.Security;
using CourseIntellect.Application.DTOs.Insights;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
public sealed class StudentInsightsController(IStudentInsightService service, CourseIntellectDbContext dbContext) : ControllerBase
{
    // Öğretmen yalnız ders verdiği sınıfları görür (rehber ve yöneticiler hariç; bkz. TeacherClassScope).
    // Kapsam dışı istekler 404 döner: başka sınıfın/öğrencinin var olup olmadığı da sızmaz.
    private Task<IReadOnlySet<string>?> ScopeAsync(CancellationToken ct) => TeacherClassScope.ResolveAsync(User, dbContext, ct);

    private async Task<bool> CanSeeStudentAsync(Guid studentUserId, CancellationToken ct)
    {
        var scope = await ScopeAsync(ct);
        if (scope is null) return true;
        var className = await dbContext.Students.AsNoTracking().Where(x => x.UserId == studentUserId).Select(x => x.ClassName).FirstOrDefaultAsync(ct);
        return className is not null && scope.Contains(TeacherClassScope.Key(className));
    }

    [HttpGet]
    public async Task<IActionResult> GetOverview(CancellationToken cancellationToken)
    {
        var overview = await service.GetOverviewAsync(cancellationToken);
        var scope = await ScopeAsync(cancellationToken);
        return Ok(scope is null ? overview : overview with
        {
            Classes = overview.Classes.Where(item => scope.Contains(TeacherClassScope.Key(item.ClassName))).ToList(),
        });
    }

    [HttpGet("classes/{className}")]
    public async Task<IActionResult> GetClass(string className, CancellationToken cancellationToken)
    {
        if (await ScopeAsync(cancellationToken) is { } scope && !scope.Contains(TeacherClassScope.Key(className)))
            return NotFound(new { message = "Sınıf bulunamadı." });
        var result = await service.GetClassAsync(className, cancellationToken);
        return result is null ? NotFound(new { message = "Sınıf bulunamadı." }) : Ok(result);
    }

    [HttpGet("students/{studentUserId:guid}")]
    public async Task<IActionResult> GetStudent(Guid studentUserId, CancellationToken cancellationToken)
    {
        if (!await CanSeeStudentAsync(studentUserId, cancellationToken)) return NotFound(new { message = "Öğrenci bulunamadı." });
        var result = await service.GetStudentAsync(studentUserId, cancellationToken);
        return result is null ? NotFound(new { message = "Öğrenci bulunamadı." }) : Ok(result);
    }

    [HttpPost("students/{studentUserId:guid}/note")]
    public async Task<IActionResult> RequestNote(Guid studentUserId, CancellationToken cancellationToken)
    {
        if (!await CanSeeStudentAsync(studentUserId, cancellationToken)) return NotFound(new { message = "Öğrenci bulunamadı." });
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
        var noteStudent = await dbContext.StudentInsightNotes.AsNoTracking().Where(x => x.Id == noteId).Select(x => (Guid?)x.StudentUserId).FirstOrDefaultAsync(cancellationToken);
        if (noteStudent is not Guid owner || !await CanSeeStudentAsync(owner, cancellationToken)) return NotFound(new { message = "Not bulunamadı." });
        try
        {
            var result = await service.ReviewNoteAsync(noteId, request, StudentScope.ResolveUserId(User), cancellationToken);
            return result is null ? NotFound(new { message = "Not bulunamadı." }) : Ok(result);
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }
}
