using System.Security.Claims;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Kurum yöneticisinin tüm kurum verisini tek dosya olarak indirmesi.
///
/// Arşiv sunucuda saklanmaz; doğrudan yanıt akışına yazılır. Böylece kişisel veri
/// içeren dev bir dosya diskte artık kalmaz ve temizlik işi gerekmez.
/// </summary>
[ApiController]
[Authorize(Roles = "Admin,Developer")]
[Route("api/tenant-backup")]
public sealed class TenantBackupController(
    ITenantBackupService backupService,
    CourseIntellectDbContext dbContext,
    IAuditLogService auditLog,
    ILogger<TenantBackupController> logger) : ControllerBase
{
    private const string AuditAction = "Kurum yedeği indirildi";
    private const string AuditCategory = "Kayıt";

    /// <summary>Günlük tam yedek üst sınırı (kurum başına).</summary>
    private const int FullBackupDailyLimit = 3;

    /// <summary>Yedek almadan önce kapsamı gösterir: kaç kayıt, kaç belge, ne kadar yer.</summary>
    [HttpGet("summary")]
    public async Task<IActionResult> Summary(CancellationToken ct)
    {
        if (dbContext.CurrentTenantId is not Guid tenantId)
            return BadRequest(new { message = "Yedek yalnızca bir kuruma bağlı oturumla alınabilir." });

        var tenant = await dbContext.TenantWorkspaces.AsNoTracking().IgnoreQueryFilters()
            .SingleOrDefaultAsync(x => x.Id == tenantId, ct);

        var tableCount = dbContext.Model.GetEntityTypes()
            .Where(x => typeof(ITenantScopedEntity).IsAssignableFrom(x.ClrType) && !x.IsOwned())
            .Select(x => x.ClrType).Distinct().Count();

        var students = await dbContext.Students.AsNoTracking().CountAsync(ct);
        var staff = await dbContext.Staff.AsNoTracking().CountAsync(ct);
        var documents = await dbContext.StudentDrivingDocuments.AsNoTracking().CountAsync(ct);
        var payments = await dbContext.FinancePayments.AsNoTracking().CountAsync(ct);
        var usedToday = await CountTodayBackupsAsync(ct);

        return Ok(new
        {
            institutionName = tenant?.Name ?? string.Empty,
            institutionType = tenant?.InstitutionType.ToString() ?? string.Empty,
            tableCount,
            students,
            staff,
            documents,
            payments,
            dailyLimit = FullBackupDailyLimit,
            usedToday,
            remainingToday = Math.Max(0, FullBackupDailyLimit - usedToday),
        });
    }

    /// <summary>
    /// Tam yedek: tüm tablolar + yüklenmiş belgeler tek ZIP olarak akıtılır.
    /// <paramref name="includeFiles"/> kapatılırsa yalnız veri iner (çok daha hızlı).
    /// </summary>
    [HttpGet("download")]
    public async Task<IActionResult> Download([FromQuery] bool includeFiles = true, CancellationToken ct = default)
    {
        if (dbContext.CurrentTenantId is not Guid tenantId)
            return BadRequest(new { message = "Yedek yalnızca bir kuruma bağlı oturumla alınabilir." });

        // Kötüye kullanım/veri sızdırma kalkanı: sürekli tam yedek çeken hesap
        // normal bir kullanım değildir.
        if (includeFiles && await CountTodayBackupsAsync(ct) >= FullBackupDailyLimit)
        {
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                message = $"Günlük tam yedek sınırına ulaşıldı ({FullBackupDailyLimit}). Yarın tekrar deneyebilir "
                    + "veya belgeleri hariç tutarak yalnız veri yedeği alabilirsiniz.",
            });
        }

        var tenant = await dbContext.TenantWorkspaces.AsNoTracking().IgnoreQueryFilters()
            .SingleOrDefaultAsync(x => x.Id == tenantId, ct);
        var slug = Slug(tenant?.Slug ?? tenant?.Name ?? "kurum");
        var fileName = $"yedek-{slug}-{DateTime.UtcNow.AddHours(3):yyyyMMdd-HHmm}.zip";

        Response.ContentType = "application/zip";
        Response.Headers.ContentDisposition = $"attachment; filename=\"{fileName}\"";
        // Ters vekil (nginx) yanıtı tamponlamasın: arşiv üretilirken akmaya başlasın.
        Response.Headers["X-Accel-Buffering"] = "no";

        TenantBackupResult result;
        try
        {
            result = await backupService.WriteArchiveAsync(Response.Body, includeFiles, ct);
        }
        catch (OperationCanceledException)
        {
            // Kullanıcı indirmeyi iptal etti; gövde zaten yazılmaya başlandığı için
            // hata yanıtı gönderilemez.
            logger.LogInformation("Kurum yedeği indirme iptal edildi (tenant {TenantId})", tenantId);
            return new EmptyResult();
        }

        await auditLog.LogAsync(
            AuditAction,
            AuditCategory,
            "TenantWorkspace",
            tenantId.ToString(),
            $"{result.TableCount} tablo, {result.RowCount} kayıt"
                + (includeFiles ? $", {result.FileCount} belge ({result.FileBytes / 1024 / 1024} MB)" : ", belgeler hariç")
                + $" indirildi ({fileName}).",
            ct);

        return new EmptyResult();
    }

    /// <summary>Bugün bu kurumda alınan tam yedek sayısı (denetim kaydından okunur).</summary>
    private async Task<int> CountTodayBackupsAsync(CancellationToken ct)
    {
        var since = DateTime.UtcNow.AddHours(-24);
        return await dbContext.AuditLogEntries.AsNoTracking()
            .CountAsync(x => x.Action == AuditAction && x.CreatedAtUtc >= since, ct);
    }

    private static string Slug(string value)
    {
        var map = new Dictionary<char, char>
        {
            ['ı'] = 'i', ['İ'] = 'i', ['ş'] = 's', ['Ş'] = 's', ['ğ'] = 'g', ['Ğ'] = 'g',
            ['ü'] = 'u', ['Ü'] = 'u', ['ö'] = 'o', ['Ö'] = 'o', ['ç'] = 'c', ['Ç'] = 'c',
        };
        var builder = new System.Text.StringBuilder();
        foreach (var raw in value.Trim())
        {
            var ch = map.TryGetValue(raw, out var mapped) ? mapped : char.ToLowerInvariant(raw);
            if (char.IsLetterOrDigit(ch) && ch < 128) builder.Append(ch);
            else if (builder.Length > 0 && builder[^1] != '-') builder.Append('-');
        }
        return builder.ToString().Trim('-') is { Length: > 0 } slug ? slug : "kurum";
    }
}
