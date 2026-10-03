using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Auth;

// Used only after the application JWT signature and user security version were validated.
public sealed class AdminSessionGuard(CourseIntellectDbContext db, AdminEmailAccessPolicy policy, TimeProvider clock, IHttpContextAccessor http)
{
    public async Task<bool> ValidateAsync(AppUser user, ClaimsPrincipal principal, CancellationToken cancellationToken = default)
    {
        if (!policy.IsManagementRequest(http.HttpContext) || !policy.IsAllowed(user)) return false;
        if (!string.Equals(principal.FindFirstValue("admin_mfa"), "true", StringComparison.OrdinalIgnoreCase)
            || !Guid.TryParse(principal.FindFirstValue("admin_session"), out var sessionId)
) return false;
        var now = clock.GetUtcNow().UtcDateTime;
        var session = await db.RefreshTokenSessions.AsNoTracking().SingleOrDefaultAsync(x => x.Id == sessionId, cancellationToken);
        if (session is null || session.AdminVerificationMethod != "email" || session.UserId != user.Id || session.SecurityVersion != user.SecurityVersion
            || session.RevokedAtUtc is not null || session.ExpiresAtUtc <= now
            || session.AdminMfaVerifiedAtUtc is null || session.AdminMfaVerifiedAtUtc <= now.AddHours(-8)
            || session.AdminLastActivityAtUtc is null || session.AdminLastActivityAtUtc <= now.AddMinutes(-15)) return false;
        if (session.AdminLastActivityAtUtc < now.AddMinutes(-1))
        {
            // Never revive a concurrently revoked or expired session.
            var updated = await db.RefreshTokenSessions.Where(x => x.Id == sessionId && x.RevokedAtUtc == null
                && x.ExpiresAtUtc > now && x.AdminLastActivityAtUtc > now.AddMinutes(-15))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.AdminLastActivityAtUtc, now), cancellationToken);
            if (updated != 1) return false;
        }
        return true;
    }
}
