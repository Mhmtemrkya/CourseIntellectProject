using CourseIntellect.Api.Security;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// KVKK/yasal metin onayının sunucu kaydı. Eskiden karar yalnız istemcinin yerel
/// deposundaydı (ispatı yoktu, cihaz değişince kayboluyordu). Kayıt eklemelidir;
/// kimlik, kurum, IP ve zaman oturumdan/sunucudan alınır, istemciye güvenilmez.
/// </summary>
[ApiController]
[Authorize]
[Route("api/legal-consent")]
public sealed class LegalConsentController(CourseIntellectDbContext dbContext) : ControllerBase
{
    /// <summary>Geçerli aydınlatma metni sürümü; istemcilerdeki sabitle aynı olmalıdır.</summary>
    public const string CurrentVersion = "2026-05-02.kvkk.v1";

    private static readonly HashSet<string> AllowedStatuses = new(StringComparer.Ordinal) { "accepted", "declined" };
    private static readonly HashSet<string> AllowedPlatforms = new(StringComparer.Ordinal) { "desktop", "mobile", "web" };

    /// <summary>Oturumdaki kullanıcının geçerli sürümdeki son kararı (yoksa 204).</summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
    {
        var userId = StudentScope.ResolveUserId(User);
        if (userId is null) return Unauthorized();

        var latest = await dbContext.LegalConsentRecords
            .AsNoTracking()
            .Where(x => x.UserId == userId.Value && x.ConsentVersion == CurrentVersion)
            .OrderByDescending(x => x.RecordedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        return latest is null ? NoContent() : Ok(ToResponse(latest));
    }

    [HttpPost]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Record([FromBody] LegalConsentDecisionRequest request, CancellationToken cancellationToken)
    {
        var userId = StudentScope.ResolveUserId(User);
        if (userId is null) return Unauthorized();

        // Girdi doğrulama: yalnız bilinen sürüm, durum ve platform kabul edilir.
        if (!string.Equals(request.Version, CurrentVersion, StringComparison.Ordinal))
        {
            return BadRequest(new { message = "Onay metni sürümü güncel değil. Uygulamayı güncelleyip tekrar deneyin.", code = "CONSENT_VERSION_MISMATCH" });
        }
        if (!AllowedStatuses.Contains(request.Status ?? string.Empty))
        {
            return BadRequest(new { message = "Geçersiz onay kararı." });
        }
        var platform = (request.Platform ?? string.Empty).Trim().ToLowerInvariant();
        if (!AllowedPlatforms.Contains(platform))
        {
            return BadRequest(new { message = "Geçersiz platform." });
        }

        // İstemci karar zamanı yalnız makul aralıktaysa saklanır (gelecek/çok eski değil).
        var now = DateTime.UtcNow;
        DateTime? clientDecidedAt = request.DecidedAtUtc is { } decided
            && decided.ToUniversalTime() <= now.AddMinutes(5)
            && decided.ToUniversalTime() >= now.AddDays(-30)
            ? decided.ToUniversalTime()
            : null;

        var declined = request.Status == "declined";
        var record = new LegalConsentRecord
        {
            UserId = userId.Value,
            ConsentVersion = CurrentVersion,
            Status = request.Status!,
            // Reddedilen kararda açık rızalar her zaman kapalı kaydedilir.
            Marketing = !declined && request.Marketing,
            Push = !declined && request.Push,
            Analytics = !declined && request.Analytics,
            Platform = platform,
            IpAddress = Truncate(HttpContext.Connection.RemoteIpAddress?.ToString(), 60),
            UserAgent = Truncate(Request.Headers.UserAgent.ToString(), 500),
            ClientDecidedAtUtc = clientDecidedAt,
            RecordedAtUtc = now,
        };
        dbContext.LegalConsentRecords.Add(record);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(record));
    }

    private static string Truncate(string? value, int max)
    {
        var text = value ?? string.Empty;
        return text.Length <= max ? text : text[..max];
    }

    private static LegalConsentResponse ToResponse(LegalConsentRecord record) => new(
        record.ConsentVersion,
        record.Status,
        record.Marketing,
        record.Push,
        record.Analytics,
        record.RecordedAtUtc);
}

public sealed record LegalConsentDecisionRequest(
    string? Version,
    string? Status,
    bool Marketing,
    bool Push,
    bool Analytics,
    string? Platform,
    DateTime? DecidedAtUtc);

public sealed record LegalConsentResponse(
    string Version,
    string Status,
    bool Marketing,
    bool Push,
    bool Analytics,
    DateTime RecordedAtUtc);
