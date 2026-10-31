using CourseIntellect.Api.Authorization;
using CourseIntellect.Api.Security;
using CourseIntellect.Application.DTOs.Insights;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Öğrencinin kendi, velinin çocuklarının konu analizi (rapor sayfaları için). Yalnız
/// deterministik analiz ve sabit öneriler döner; öğretmen notu (yapay zekâ taslağı)
/// personele özeldir ve burada gizlenir.
/// </summary>
[ApiController]
[Route("api/insights")]
[RequireEntitlement("student-insights")]
public sealed class MyInsightsController(IStudentInsightService service, CourseIntellectDbContext dbContext) : ControllerBase
{
    private static readonly InsightNoteDto Hidden = new(null, "hidden", null, null, null, null, false, "None", null);

    [HttpGet("me")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
    {
        if (StudentScope.ResolveUserId(User) is not Guid userId) return Unauthorized();
        var result = await service.GetStudentAsync(userId, cancellationToken);
        return result is null ? NotFound(new { message = "Öğrenci kaydı bulunamadı." }) : Ok(result with { Note = Hidden });
    }

    [HttpGet("children")]
    [Authorize(Roles = "Parent")]
    public async Task<IActionResult> GetChildren(CancellationToken cancellationToken)
    {
        var children = await StudentScope.ResolveParentChildrenAsync(User, dbContext, cancellationToken);
        var results = new List<StudentInsightDto>();
        foreach (var (childId, _) in children)
        {
            var insight = await service.GetStudentAsync(childId, cancellationToken);
            if (insight is not null) results.Add(insight with { Note = Hidden });
        }
        return Ok(results);
    }
}
