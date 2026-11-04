using System.Security.Claims;
using CourseIntellect.Api.Security;
using CourseIntellect.Application.DTOs.ExamResults;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
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
    public async Task<IActionResult> Get(
        [FromQuery] string? studentName,
        [FromQuery] string? className,
        [FromQuery] Guid? studentId,
        CancellationToken cancellationToken)
    {
        // Kapsam: öğrenci yalnızca kendi sonuçlarını, veli yalnızca kendi
        // çocuklarının sonuçlarını görebilir; personel rolleri kısıtsızdır.
        // Kimliğe bağlı sonuçlar kimlikle, bağlanmamış eski sonuçlar adla süzülür.
        var scope = await StudentScope.ResolveStudentRecordScopeAsync(User, dbContext, cancellationToken);
        if (scope is { StudentIds.Count: 0, StudentNames.Count: 0 })
        {
            return Ok(Array.Empty<ExamResultDto>());
        }

        if (scope is not null)
        {
            // Kapsam dışı öğrenci istenirse boş döner. Eskiden istek yok sayılıp tüm kapsam
            // dönüyordu: çok çocuklu velide bir çocuğun kartına kardeşlerinin kayıtları karışabilirdi.
            if (studentId is { } requestedId && !scope.StudentIds.Contains(requestedId))
            {
                return Ok(Array.Empty<object>());
            }

            // Ad harf/Türkçe karakterden bağımsız karşılaştırılır: mobil adı "Ayse" diye
            // gönderebilir, kayıtta "Ayşe" yazar.
            var requested = studentName?.Trim();
            studentName = !string.IsNullOrWhiteSpace(requested)
                && scope.StudentNames.Any(name => StudentIdentityResolver.NameKey(name) == StudentIdentityResolver.NameKey(requested))
                ? requested
                : null;
        }

        var results = await academicQueryService.GetExamResultsAsync(studentName, className, studentId, scope, cancellationToken);
        return Ok(results);
    }

    // Öğrencinin kendi sınıfı içindeki başarı sıralamasını, başka öğrencilerin
    // notlarını sızdırmadan döndürür. Sıralama, sınıftaki öğrencilerin genel
    // not (sınav puanı) ortalamasına göre hesaplanır.
    [HttpGet("class-ranking")]
    public async Task<IActionResult> GetClassRanking(CancellationToken cancellationToken)
    {
        // Kimlik "sub"/"nameid" claim'iyle gelir (ClaimTypes.NameIdentifier eşlenmez); eskiden
        // bulunamayınca adla aranıyor ve başka sınıftaki aynı adlı öğrencinin sırası dönüyordu.
        CourseIntellect.Domain.Entities.StudentProfile? me = null;
        if (StudentScope.ResolveUserId(User) is { } userId)
        {
            me = await dbContext.Students.AsNoTracking()
                .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        }

        if (me is null || string.IsNullOrWhiteSpace(me.ClassName))
        {
            return Ok(new ClassRankingDto(0, 0, 0, me?.ClassName ?? string.Empty));
        }

        var className = me.ClassName;
        var classmates = await dbContext.Students.AsNoTracking()
            .Where(x => x.ClassName == className)
            .Select(x => new { x.Id, x.FullName })
            .ToListAsync(cancellationToken);

        var results = await dbContext.ExamResults.AsNoTracking()
            .Where(x => x.ClassName == className && x.Score > 0)
            .Select(x => new { x.StudentId, x.StudentName, x.Score })
            .ToListAsync(cancellationToken);

        // Sonuç öğrenciye kimlikle, bağlanmamış eski sonuç adla eşlenir.
        double AverageOf(Guid id, string fullName)
        {
            var key = StudentIdentityResolver.NameKey(fullName);
            var scores = results
                .Where(r => r.StudentId is { } linked ? linked == id : StudentIdentityResolver.NameKey(r.StudentName) == key)
                .Select(r => (double)r.Score)
                .ToList();
            return scores.Count > 0 ? scores.Average() : 0d;
        }

        var averages = classmates.Select(x => AverageOf(x.Id, x.FullName)).ToList();
        var myAverage = AverageOf(me.Id, me.FullName);
        var total = classmates.Count;
        // Eşit ortalamalar aynı sırayı alır (1, 2, 2, 4).
        var rank = 1 + averages.Count(value => value > myAverage);

        return Ok(new ClassRankingDto(rank, Math.Max(total, 1), Math.Round(myAverage, 1), className));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Teacher")]
    [RequireEntitlement("exams", "create")]
    public async Task<IActionResult> Create([FromBody] CreateExamResultRequest request, CancellationToken cancellationToken)
    {
        // Rehberlik öğretmenleri öğrenci sınavlarını yalnızca görüntüleyebilir;
        // sonuç girişi/değişikliği yapamaz. Branş bilgisi personel kaydından okunur.
        if (await IsGuidanceOnlyTeacherAsync(cancellationToken))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Rehberlik öğretmenleri sınav sonuçlarını yalnızca görüntüleyebilir; sonuç girişi yapamaz.",
            });
        }

        var result = await academicQueryService.CreateExamResultAsync(request, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Girilmiş bir sonucun düzeltilmesi (puan/net veya sınav künyesi). Sonuç
    /// girebilen roller düzeltebilir de — yanlış puan tek yol olarak silinip
    /// yeniden girilmek zorunda kalmasın.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Teacher")]
    [RequireEntitlement("exams", "edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateExamResultRequest request, CancellationToken cancellationToken)
    {
        if (await IsGuidanceOnlyTeacherAsync(cancellationToken))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Rehberlik öğretmenleri sınav sonuçlarını yalnızca görüntüleyebilir; sonuç düzenleyemez.",
            });
        }

        var updated = await academicQueryService.UpdateExamResultAsync(id, request, cancellationToken);
        return updated is null ? NotFound(new { message = "Sınav sonucu bulunamadı." }) : Ok(updated);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Teacher")]
    [RequireEntitlement("exams", "delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (await IsGuidanceOnlyTeacherAsync(cancellationToken))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Rehberlik öğretmenleri sınav sonuçlarını yalnızca görüntüleyebilir; sonuç silemez.",
            });
        }

        var deleted = await academicQueryService.DeleteExamResultAsync(id, cancellationToken);
        return deleted ? Ok(new { id }) : NotFound(new { message = "Sınav sonucu bulunamadı." });
    }

    public sealed record ClassRankingDto(int Rank, int TotalStudents, double Average, string ClassName);

    /// <summary>
    /// Rehberlik branşındaki öğretmen mi (yönetici değil)? Rehber öğretmen sınav
    /// sonuçlarını yalnızca görüntüler; yazma yollarının hepsinde aynı kontrol.
    /// </summary>
    private async Task<bool> IsGuidanceOnlyTeacherAsync(CancellationToken cancellationToken)
    {
        if (!User.IsInRole("Teacher") || User.IsInRole("Admin"))
        {
            return false;
        }

        var userRaw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userRaw, out var userId))
        {
            return false;
        }

        var branch = await dbContext.Staff
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => x.DepartmentOrBranch)
            .FirstOrDefaultAsync(cancellationToken);
        return IsGuidanceBranch(branch);
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
