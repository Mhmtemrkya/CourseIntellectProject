using System.Security.Claims;
using CourseIntellect.Api.Security;
using CourseIntellect.Application.DTOs.ExamResults;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class ExamResultsController(
    IAcademicQueryService academicQueryService,
    CourseIntellectDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? studentName, [FromQuery] string? className, CancellationToken cancellationToken)
    {
        // Kapsam: öğrenci yalnızca kendi sonuçlarını, veli yalnızca kendi
        // çocuklarının sonuçlarını görebilir; personel rolleri kısıtsızdır.
        var allowedNames = await StudentScope.ResolveAllowedStudentNamesAsync(User, dbContext, cancellationToken);
        if (allowedNames is { Count: 0 })
        {
            return Ok(Array.Empty<ExamResultDto>());
        }

        if (allowedNames is { Count: 1 })
        {
            studentName = allowedNames[0];
        }
        else if (allowedNames is { Count: > 1 })
        {
            // Veli birden fazla çocuğa sahipse: istenen isim izinli listedeyse
            // korunur, değilse/boşsa tüm çocuklarına daraltılır.
            var requested = studentName?.Trim();
            studentName = !string.IsNullOrWhiteSpace(requested)
                && allowedNames.Any(name => string.Equals(name.Trim(), requested, StringComparison.OrdinalIgnoreCase))
                ? requested
                : null;
        }

        var results = await academicQueryService.GetExamResultsAsync(studentName, className, cancellationToken);

        if (allowedNames is { Count: > 1 } && string.IsNullOrWhiteSpace(studentName))
        {
            results = StudentScope.FilterByStudentNames(results, allowedNames, item => item.StudentName);
        }

        return Ok(results);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> Create([FromBody] CreateExamResultRequest request, CancellationToken cancellationToken)
    {
        // Rehberlik öğretmenleri öğrenci sınavlarını yalnızca görüntüleyebilir;
        // sonuç girişi/değişikliği yapamaz. Branş bilgisi personel kaydından okunur.
        if (User.IsInRole("Teacher") && !User.IsInRole("Admin"))
        {
            var userRaw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (Guid.TryParse(userRaw, out var userId))
            {
                var branch = await dbContext.Staff
                    .AsNoTracking()
                    .Where(x => x.UserId == userId)
                    .Select(x => x.DepartmentOrBranch)
                    .FirstOrDefaultAsync(cancellationToken);
                if (IsGuidanceBranch(branch))
                {
                    return StatusCode(StatusCodes.Status403Forbidden, new
                    {
                        message = "Rehberlik öğretmenleri sınav sonuçlarını yalnızca görüntüleyebilir; sonuç girişi yapamaz.",
                    });
                }
            }
        }

        var result = await academicQueryService.CreateExamResultAsync(request, cancellationToken);
        return Ok(result);
    }

    private static bool IsGuidanceBranch(string? branch)
    {
        if (string.IsNullOrWhiteSpace(branch))
        {
            return false;
        }

        var folded = branch
            .Trim()
            .ToLowerInvariant()
            .Replace('ı', 'i')
            .Replace('İ', 'i');
        return folded.Contains("rehber");
    }
}
