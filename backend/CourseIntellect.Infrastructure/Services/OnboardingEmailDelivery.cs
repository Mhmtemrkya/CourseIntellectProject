using System.Security.Cryptography;
using System.Text.Json;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CourseIntellect.Infrastructure.Services;

public sealed class OnboardingEmailDelivery(CourseIntellectDbContext db, IEmailSender sender,
    IDataProtectionProvider protection, ILogger<OnboardingEmailDelivery> logger) : IOnboardingEmailDelivery
{
    private readonly IDataProtector protector = protection.CreateProtector("SchoolAsist.OnboardingEmails.v1");
    private sealed record Payload(string Recipient, string Subject, string Html);

    public OnboardingEmail Queue(string eventKey, string kind, Guid relatedId, string? version,
        DateTime expiresAtUtc, string recipient, string subject, string html)
    {
        var item = new OnboardingEmail { EventKey = eventKey, Kind = kind, RelatedId = relatedId,
            Version = version, ExpiresAtUtc = expiresAtUtc,
            ProtectedPayload = protector.Protect(JsonSerializer.Serialize(new Payload(recipient, subject, html))) };
        db.Set<OnboardingEmail>().Add(item);
        return item;
    }

    public async Task DispatchAsync(CancellationToken ct = default)
    {
        // Must never send inside a caller's uncommitted onboarding transaction.
        if (db.Database.CurrentTransaction is not null || !sender.IsConfigured) return;
        var now = DateTime.UtcNow;
        var ids = await db.Set<OnboardingEmail>().AsNoTracking()
            .Where(x => x.CompletedAtUtc == null && x.NextAttemptAtUtc <= now
                && (x.LeaseUntilUtc == null || x.LeaseUntilUtc < now))
            .OrderBy(x => x.CreatedAtUtc).Select(x => x.Id).Take(25).ToListAsync(ct);
        foreach (var id in ids)
        {
            // Each SMTP attempt can take 90 seconds. A batch-wide timestamp would
            // give later messages an expired lease before their send even starts.
            now = DateTime.UtcNow;
            var lease = Guid.NewGuid();
            var claimed = await db.Set<OnboardingEmail>().Where(x => x.Id == id && x.CompletedAtUtc == null && x.NextAttemptAtUtc <= now
                && (x.LeaseUntilUtc == null || x.LeaseUntilUtc < now))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.LeaseId, lease)
                    .SetProperty(x => x.LeaseUntilUtc, now.AddMinutes(5))
                    .SetProperty(x => x.Attempts, x => x.Attempts + 1), ct);
            if (claimed == 0) continue;
            var item = await db.Set<OnboardingEmail>().AsNoTracking().SingleAsync(x => x.Id == id, ct);
            if (item.ExpiresAtUtc <= DateTime.UtcNow || !await IsCurrentAsync(item, ct))
            { await CompleteAsync(item, lease, false, ct); continue; }
            Payload? payload;
            try { payload = JsonSerializer.Deserialize<Payload>(protector.Unprotect(item.ProtectedPayload)); }
            catch (Exception ex) when (ex is CryptographicException or JsonException)
            {
                // A missing key is recoverable after restoring the key ring. No payload in logs.
                logger.LogError("Onboarding mail cannot be decrypted. EmailId={EmailId}", id);
                await RetryAsync(item, lease, ct); continue;
            }
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(90));
            var delivered = payload is not null && await sender.SendAsync(payload.Recipient, payload.Subject, payload.Html, timeout.Token);
            if (delivered) await CompleteAsync(item, lease, true, ct);
            else await RetryAsync(item, lease, ct);
        }
    }

    private async Task<bool> IsCurrentAsync(OnboardingEmail mail, CancellationToken ct)
    {
        if (mail.Kind == "verification")
            return await db.TenantRegistrationApplications.AnyAsync(x => x.Id == mail.RelatedId
                && x.Status == "pending" && x.VerifiedAtUtc == null && x.VerificationTokenHash == mail.Version, ct);
        if (mail.Kind == "received")
            return await db.TenantRegistrationApplications.AnyAsync(x => x.Id == mail.RelatedId && x.VerifiedAtUtc != null, ct);
        if (mail.Kind == "approval")
        {
            var user = await db.Users.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == mail.RelatedId, ct);
            return user is not null && user.SecurityVersion.ToString() == mail.Version && user.MustChangePassword
                && await db.TenantWorkspaces.AnyAsync(x => x.Id == user.TenantId && x.Status == "active", ct);
        }
        return false;
    }

    private async Task CompleteAsync(OnboardingEmail mail, Guid lease, bool delivered, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var changed = await db.Set<OnboardingEmail>().Where(x => x.Id == mail.Id && x.LeaseId == lease)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.CompletedAtUtc, DateTime.UtcNow)
                .SetProperty(x => x.Delivered, delivered).SetProperty(x => x.ProtectedPayload, "")
                .SetProperty(x => x.LeaseUntilUtc, (DateTime?)null).SetProperty(x => x.LeaseId, (Guid?)null), ct);
        if (changed > 0 && delivered && mail.Kind == "approval")
        {
            var user = await db.Users.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(x => x.Id == mail.RelatedId, ct);
            if (user is not null && user.SecurityVersion.ToString() == mail.Version)
                await db.TenantWorkspaces.Where(x => x.Id == user.TenantId)
                    .ExecuteUpdateAsync(s => s.SetProperty(x => x.ApprovalEmailSentAtUtc, DateTime.UtcNow), ct);
        }
        await transaction.CommitAsync(ct);
    }
    private async Task RetryAsync(OnboardingEmail mail, Guid lease, CancellationToken ct)
    {
        var next = DateTime.UtcNow.AddMinutes(Math.Min(60, Math.Pow(2, Math.Min(mail.Attempts, 6))));
        await db.Set<OnboardingEmail>().Where(x => x.Id == mail.Id && x.LeaseId == lease)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.NextAttemptAtUtc, next)
                .SetProperty(x => x.LeaseUntilUtc, (DateTime?)null).SetProperty(x => x.LeaseId, (Guid?)null), ct);
        logger.LogWarning("Onboarding mail scheduled for retry. EmailId={EmailId} Attempt={Attempt}", mail.Id, mail.Attempts);
    }
}
