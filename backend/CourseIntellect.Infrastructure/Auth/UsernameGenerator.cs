using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Auth;

public sealed record UsernameContext(
    string Role,
    string? ClassName = null,
    string? Branch = null,
    string? StudentClassName = null);

public sealed class UsernameGenerator(CourseIntellectDbContext dbContext)
{
    public async Task<string> GenerateAsync(
        Guid tenantId,
        string fullName,
        UsernameContext context,
        CancellationToken cancellationToken = default)
    {
        var domain = await ResolveDomainAsync(tenantId, cancellationToken);
        var baseLocal = NormalizeAscii(fullName);
        if (string.IsNullOrWhiteSpace(baseLocal))
        {
            baseLocal = "kullanici";
        }

        foreach (var candidate in BuildCandidates(baseLocal, context))
        {
            var trimmed = candidate.Trim();
            if (string.IsNullOrEmpty(trimmed)) continue;
            var fullCandidate = $"{trimmed}@{domain}";
            if (!await ExistsAsync(fullCandidate, cancellationToken))
            {
                return fullCandidate;
            }
        }

        for (var i = 2; i <= 999; i++)
        {
            var numeric = $"{baseLocal}{i}@{domain}";
            if (!await ExistsAsync(numeric, cancellationToken))
            {
                return numeric;
            }
        }

        throw new InvalidOperationException("Kullanici adi uretilemedi: cok fazla cakisma.");
    }

    private async Task<string> ResolveDomainAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var contactEmail = await dbContext.TenantWorkspaces
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(t => t.Id == tenantId)
            .Select(t => t.ContactEmail)
            .FirstOrDefaultAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(contactEmail))
        {
            return "courseintellect.app";
        }

        var atIndex = contactEmail.IndexOf('@');
        if (atIndex < 0 || atIndex == contactEmail.Length - 1)
        {
            return "courseintellect.app";
        }

        var domain = contactEmail[(atIndex + 1)..].Trim().ToLowerInvariant();
        return string.IsNullOrEmpty(domain) ? "courseintellect.app" : domain;
    }

    private async Task<bool> ExistsAsync(string username, CancellationToken cancellationToken)
        => await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .AnyAsync(u => u.Username == username, cancellationToken);

    private static IEnumerable<string> BuildCandidates(string baseLocal, UsernameContext context)
    {
        yield return baseLocal;

        var role = (context.Role ?? string.Empty).Trim().ToLowerInvariant();
        var classNorm = NormalizeAscii(context.ClassName ?? string.Empty);
        var branchNorm = NormalizeAscii(context.Branch ?? string.Empty);
        var studentClassNorm = NormalizeAscii(context.StudentClassName ?? string.Empty);

        switch (role)
        {
            case "student":
                if (!string.IsNullOrEmpty(classNorm)) yield return baseLocal + classNorm;
                break;
            case "teacher":
                if (!string.IsNullOrEmpty(classNorm)) yield return baseLocal + classNorm;
                if (!string.IsNullOrEmpty(branchNorm)) yield return baseLocal + branchNorm;
                yield return baseLocal + "ogretmen";
                break;
            case "administrative":
                yield return baseLocal + "idari";
                break;
            case "accounting":
                yield return baseLocal + "muhasebe";
                break;
            case "parent":
                if (!string.IsNullOrEmpty(studentClassNorm)) yield return baseLocal + studentClassNorm + "veli";
                yield return baseLocal + "veli";
                break;
            case "admin":
                yield return baseLocal + "admin";
                break;
        }
    }

    private static string NormalizeAscii(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var lower = value.ToLowerInvariant();
        var sb = new System.Text.StringBuilder(lower.Length);
        foreach (var ch in lower)
        {
            char mapped = ch switch
            {
                'ç' => 'c',
                'ğ' => 'g',
                'ı' => 'i',
                'ö' => 'o',
                'ş' => 's',
                'ü' => 'u',
                'â' => 'a',
                'î' => 'i',
                'û' => 'u',
                _ => ch,
            };
            if (char.IsLetterOrDigit(mapped))
            {
                sb.Append(mapped);
            }
        }
        return sb.ToString();
    }
}
