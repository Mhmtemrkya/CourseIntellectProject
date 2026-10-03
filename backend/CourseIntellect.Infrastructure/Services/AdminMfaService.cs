using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using CourseIntellect.Application.DTOs.Auth;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Auth;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AdminMfaService(CourseIntellectDbContext db, AdminEmailAccessPolicy policy,
    IEmailSender sender, TimeProvider clock, IHttpContextAccessor http) : IAdminMfaService
{
    public static bool IsPlatformAdmin(AppUser user) => user.PrimaryRole == UserRole.Developer && user.TenantId is null;
    private DateTime Now => clock.GetUtcNow().UtcDateTime;
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private async Task<bool> IsLockedAsync(Guid userId, DateTime now, CancellationToken ct)
    {
        // SQLite test provider cannot translate DateTimeOffset comparisons. Bound by user first.
        var failures = await db.LoginAttempts.IgnoreQueryFilters().Where(x => x.UserId == userId && !x.Success)
            .Select(x => x.Timestamp).ToListAsync(ct);
        return failures.Count(x => x > new DateTimeOffset(now.AddMinutes(-15))) >= 5;
    }

    public async Task<AdminMfaStartResponse?> StartAsync(AppUser user, CancellationToken cancellationToken = default)
    {
        if (!policy.IsManagementRequest(http.HttpContext) || !policy.IsAllowed(user) || !sender.IsConfigured) return null;
        var now = Now;
        if (await IsLockedAsync(user.Id, now, cancellationToken)) return null;
        await db.AdminMfaChallenges.Where(x => x.ExpiresAtUtc < now.AddMinutes(-15)).ExecuteDeleteAsync(cancellationToken);
        var recent = await db.AdminMfaChallenges.Where(x => x.UserId == user.Id && x.CreatedAtUtc >= now.AddMinutes(-15))
            .ToListAsync(cancellationToken);
        // Persisted budgets cover retries and multiple API processes, including delivery failure.
        if (recent.Count >= 3 || recent.Any(x => x.CreatedAtUtc > now.AddSeconds(-60))) return null;
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var code = RandomNumberGenerator.GetInt32(1_000_000).ToString("D6", CultureInfo.InvariantCulture);
        foreach (var previous in recent.Where(x => x.ConsumedAtUtc is null))
        {
            previous.ConsumedAtUtc = now;
            previous.Version++;
        }
        var challenge = new AdminMfaChallenge
        {
            UserId = user.Id, AccessEmail = user.PlatformAccessEmail!, SecurityVersion = user.SecurityVersion,
            TokenHash = Hash(token), CodeHash = Hash(token + ":" + code), CreatedAtUtc = now, ExpiresAtUtc = now.AddMinutes(5)
        };
        // The raw random challenge token is not stored. It binds the low-entropy code hash
        // to a high-entropy client secret, so the database alone cannot enumerate all codes.
        user.AdminMfaVersion++;
        db.Add(challenge);
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { db.ChangeTracker.Clear(); return null; }

        bool sent;
        try
        {
            sent = await sender.SendAsync(challenge.AccessEmail, "SchoolAsist yönetim giriş kodunuz",
                "<div style=\"font-family:Arial,sans-serif;color:#101d3b;max-width:520px\"><h1>SchoolAsist</h1>"
                + "<h2>Yönetim giriş kodunuz</h2><p>" + WebUtility.HtmlEncode(user.Username) + " hesabı için:</p>"
                + "<p style=\"font-size:32px;font-weight:700;letter-spacing:8px\">" + code + "</p>"
                + "<p>Bu kod 5 dakika geçerlidir ve yalnızca bir kez kullanılabilir. Kimseyle paylaşmayın.</p>"
                + "<p>Giriş yapmayı siz başlatmadıysanız bu kodu kullanmayın ve hesabınızın güvenliğini kontrol edin.</p></div>",
                cancellationToken);
        }
        catch (OperationCanceledException) { throw; }
        catch { sent = false; } // Do not log the recipient, SMTP body, token or code.
        if (sent && Now < challenge.ExpiresAtUtc) challenge.DeliveredAtUtc = Now;
        else challenge.ConsumedAtUtc = Now;
        challenge.Version++;
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { db.ChangeTracker.Clear(); return null; }
        if (challenge.DeliveredAtUtc is null) return null;
        var at = challenge.AccessEmail.IndexOf('@');
        return new(token, challenge.ExpiresAtUtc, challenge.AccessEmail[..1] + "•••" + challenge.AccessEmail[at..]);
    }

    public async Task<AppUser?> VerifyAsync(AdminMfaVerifyRequest request, CancellationToken cancellationToken = default)
    {
        if (!policy.IsManagementRequest(http.HttpContext) || request.ChallengeToken is null
            || request.ChallengeToken.Length != 64 || request.Code is null || request.Code.Length > 64) return null;
        var tokenHash = Hash(request.ChallengeToken);
        var challenge = await db.AdminMfaChallenges.SingleOrDefaultAsync(x => x.TokenHash == tokenHash, cancellationToken);
        var now = Now;
        if (challenge is null || challenge.ConsumedAtUtc is not null || challenge.DeliveredAtUtc is null
            || challenge.ExpiresAtUtc <= now || challenge.Attempts >= 5 || challenge.CodeHash.Length != 64) return null;
        var user = await db.Users.SingleOrDefaultAsync(x => x.Id == challenge.UserId, cancellationToken);
        if (user is null || !policy.IsAllowed(user) || user.SecurityVersion != challenge.SecurityVersion
            || !string.Equals(user.PlatformAccessEmail, challenge.AccessEmail, StringComparison.OrdinalIgnoreCase)
            || await IsLockedAsync(user.Id, now, cancellationToken)) return null;
        var reserved = await db.AdminMfaChallenges.Where(x => x.Id == challenge.Id && x.Attempts < 5
            && x.ConsumedAtUtc == null && x.DeliveredAtUtc != null && x.ExpiresAtUtc > now && x.Version == challenge.Version)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Attempts, x => x.Attempts + 1)
                .SetProperty(x => x.Version, x => x.Version + 1), cancellationToken);
        if (reserved != 1) return null;
        await db.Entry(challenge).ReloadAsync(cancellationToken);
        if (request.Code.Length != 6 || request.Code.Any(c => c < '0' || c > '9')
            || !CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(challenge.CodeHash),
                Encoding.ASCII.GetBytes(Hash(request.ChallengeToken + ":" + request.Code))))
        {
            db.LoginAttempts.Add(new LoginAttemptItem
            {
                UserId = user.Id, Email = user.Username, Role = user.PrimaryRole.ToString(), Success = false,
                IpAddress = http.HttpContext?.Connection.RemoteIpAddress?.ToString() ?? string.Empty,
                UserAgent = http.HttpContext?.Request.Headers.UserAgent.ToString() ?? string.Empty,
                DeviceId = "admin-email-code", Timestamp = new DateTimeOffset(now)
            });
            await db.SaveChangesAsync(cancellationToken);
            return null;
        }
        user.IsEmailVerified = true;
        user.AdminMfaVersion++;
        challenge.ConsumedAtUtc = now;
        challenge.Version++;
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { db.ChangeTracker.Clear(); return null; }
        return user;
    }
}
