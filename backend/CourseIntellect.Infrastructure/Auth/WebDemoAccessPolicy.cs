using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace CourseIntellect.Infrastructure.Auth;

/// <summary>
/// Web (tarayıcı) kanalı ve herkese açık demo hesapları için tek kural kaynağı.
///
/// • <c>WebDemo:Usernames</c>: parolası ziyaretçilere açıkça verilen demo hesapları. Bu hesapların
///   parola/kullanıcı adı/durum değişikliği, sıfırlaması ve silinmesi HER kanalda engellenir.
/// • <c>WebDemo:Origins</c>: web uygulamasının tarayıcı kökenleri. Bu kökenden gelen isteklerde
///   yalnız demo hesapları (ve yalnız <c>WebDemo:TenantId</c> kurumunda) oturum açabilir/kullanabilir.
///   TenantId yoksa web girişi tamamen kapalıdır (fail-closed).
///
/// Origin başlığı tarayıcıda taklit edilemez ama tarayıcı dışı istemci onu hiç göndermeyebilir;
/// bu kural yalnız WEB yüzeyini daraltır. Veri yalıtımı yine kurum (tenant) denetimlerindedir.
/// </summary>
public sealed class WebDemoAccessPolicy
{
    private readonly HashSet<string> usernames;
    private readonly HashSet<string> origins;
    private readonly Guid? tenantId;

    public WebDemoAccessPolicy(IConfiguration configuration)
    {
        usernames = Split(configuration["WebDemo:Usernames"])
            .Select(x => x.ToLowerInvariant())
            .ToHashSet(StringComparer.Ordinal);
        origins = Split(configuration["WebDemo:Origins"])
            .Select(x => x.TrimEnd('/'))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        tenantId = Guid.TryParse(configuration["WebDemo:TenantId"], out var parsed) && parsed != Guid.Empty
            ? parsed
            : null;
    }

    public bool HasProtectedAccounts => usernames.Count > 0;

    public bool IsProtectedUsername(string? username)
        => username is not null && usernames.Contains(username.Trim().ToLowerInvariant());

    public bool IsWebRequest(HttpContext? context)
    {
        if (context is null || origins.Count == 0) return false;
        var origin = context.Request.Headers.Origin.ToString().TrimEnd('/');
        return origin.Length > 0 && origins.Contains(origin);
    }

    /// <summary>Web kanalında bu hesap kullanılabilir mi? Kullanıcı adı listede VE kurum demo kurumu olmalı.</summary>
    public bool IsAllowedOnWeb(string? username, Guid? userTenantId)
        => tenantId is Guid demoTenant && userTenantId == demoTenant && IsProtectedUsername(username);

    public bool IsDemoTenant(Guid? candidate) => tenantId is Guid demoTenant && candidate == demoTenant;

    private static IEnumerable<string> Split(string? value)
        => (value ?? string.Empty).Split([',', ';'], StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
}
