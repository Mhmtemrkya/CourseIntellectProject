using System.Net.Mail;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace CourseIntellect.Infrastructure.Auth;

// The two identities are operator configuration, never selected by an incoming header.
public sealed class AdminEmailAccessPolicy(IConfiguration configuration)
{
    private string[] Addresses => (configuration["AdminAccess:AllowedEmails"] ?? "").Split(',',
        StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
        .Select(x => x.ToLowerInvariant()).ToArray();
    public bool IsConfigured => configuration["AdminAccess:Mode"] == "EmailCode"
        && Addresses.Length == 2 && Addresses.Distinct().Count() == 2
        && Addresses.All(x => MailAddress.TryCreate(x, out var address) && address.Address == x);
    public bool IsAllowedEmail(string? email) => IsConfigured && email is not null
        && Addresses.Contains(email.Trim().ToLowerInvariant(), StringComparer.Ordinal);
    public bool IsAllowed(AppUser user) => IsAllowedEmail(user.Username)
        && user.PrimaryRole == UserRole.Developer && user.TenantId is null
        && user.Status == UserStatus.Active && !user.MustChangePassword
        && string.Equals(user.Username, user.PlatformAccessEmail, StringComparison.OrdinalIgnoreCase);
    public bool IsManagementRequest(HttpContext? context) => context is not null && context.Request.IsHttps
        && string.Equals(context.Request.Host.Host, configuration["AdminAccess:Host"] ?? "yonetim.schoolasist.com",
            StringComparison.OrdinalIgnoreCase);
}
