using System.Security.Claims;
using CourseIntellect.Api.Security;
using CourseIntellect.Application.DTOs.ExamResults;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using CourseIntellect.Api.Authorization;
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

    // Öğrencinin kendi sınıfı içindeki başarı sıralamasını, başka öğrencilerin
    // notlarını sızdırmadan döndürür. Sıralama, sınıftaki öğrencilerin genel
    // not (sınav puanı) ortalamasına göre hesaplanır.
    [HttpGet("class-ranking")]
    public async Task<IActionResult> GetClassRanking(CancellationToken cancellationToken)
    {
        var userRaw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        CourseIntellect.Domain.Entities.StudentProfile? me = null;
        if (Guid.TryParse(userRaw, out var userId))
        {
            me = await dbContext.Students.AsNoTracking()
                .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        }
        if (me is null)
        {
            var fullName = (User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Name) ?? string.Empty).Trim();
            if (!string.IsNullOrWhiteSpace(fullName))
            {
                me = await dbContext.Students.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.FullName == fullName, cancellationToken);
            }
        }

        if (me is null || string.IsNullOrWhiteSpace(me.ClassName))
        {
            return Ok(new ClassRankingDto(0, 0, 0, me?.ClassName ?? string.Empty));
        }

        var className = me.ClassName;
        var classmates = await dbContext.Students.AsNoTracking()
            .Where(x => x.ClassName == className)
            .Select(x => x.FullName)
            .ToListAsync(cancellationToken);

        var results = await dbContext.ExamResults.AsNoTracking()
            .Where(x => x.ClassName == className && x.Score > 0)
            .Select(x => new { x.StudentName, x.Score })
            .ToListAsync(cancellationToken);

        var averages = results
            .GroupBy(r => r.StudentName.Trim().ToLowerInvariant())
            .ToDictionary(g => g.Key, g => g.Average(x => x.Score));

        var ranked = classmates
            .Select(name => new
            {
                Key = name.Trim().ToLowerInvariant(),
                Avg = averages.TryGetValue(name.Trim().ToLowerInvariant(), out var value) ? value : 0d,
            })
            .OrderByDescending(x => x.Avg)
            .ToList();

        var total = ranked.Count;
        var myKey = me.FullName.Trim().ToLowerInvariant();
        var myAverage = averages.TryGetValue(myKey, out var mine) ? mine : 0d;
        var rank = ranked.FindIndex(x => x.Key == myKey) + 1;
        if (rank <= 0)
        {
            rank = total > 0 ? total : 1;
            total = Math.Max(total, 1);
        }

        return Ok(new ClassRankingDto(rank, total, Math.Round(myAverage, 1), className));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Teacher")]
    [RequireEntitlement("exams", "create")]
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

    public sealed record ClassRankingDto(int Rank, int TotalStudents, double Average, string ClassName);

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
