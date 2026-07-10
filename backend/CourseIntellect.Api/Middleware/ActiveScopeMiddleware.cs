using System.Security.Claims;
using CourseIntellect.Application.Interfaces;

namespace CourseIntellect.Api.Middleware;

/// <summary>
/// İstek başına aktif görüntüleme bağlamını (kurum + şube) BİR KEZ çözer ve
/// <see cref="IActiveScope"/> holder'ına yazar. Böylece query filter içinde DB'ye gitmeden
/// grant doğrulaması yapılmış olur.
///
/// Geriye uyum: yalnız kimliği doğrulanmış VE grant'ı olan kullanıcı için holder doldurulur.
/// Grant'ı olmayan (henüz backfill edilmemiş) veya anonim istekler dokunulmadan bırakılır —
/// DbContext/ITenantContext eski claim/rol mantığına fallback eder, davranış birebir aynıdır.
///
/// Yetkisiz bağlam: erişilemeyen bir kuruma/şubeye geçiş isteyen header 403 ile reddedilir.
/// </summary>
public sealed class ActiveScopeMiddleware(RequestDelegate next)
{
    private const string TenantHeader = "X-Tenant-Context";
    private const string BranchHeader = "X-Branch-Filter";

    public async Task InvokeAsync(HttpContext context)
    {
        var user = context.User;
        if (user?.Identity?.IsAuthenticated == true
            && ResolveUserId(user) is Guid userId)
        {
            var scopeService = context.RequestServices.GetRequiredService<IUserScopeService>();
            var grants = await scopeService.GetGrantsAsync(userId, context.RequestAborted);

            // Grant varsa yeni çözümleme; yoksa (geçiş dönemi) hiç dokunma → eski davranış.
            if (grants.Count > 0
                && !await TryResolveAsync(context, user, userId, scopeService))
            {
                return; // 403 yazıldı, isteği sonlandır.
            }

            // Salt-okunur bağlam zorlaması (MEB/denetçi): aktif bağlamı YÖNETME yetkisi
            // yoksa yazma istekleri reddedilir. Auth uçları (login/refresh/logout) muaf.
            if (grants.Count > 0
                && IsWriteMethod(context.Request.Method)
                && !context.Request.Path.StartsWithSegments("/api/auth")
                && !await CanManageActiveContextAsync(context, userId, grants, scopeService))
            {
                await ForbidAsync(context, "Bu bağlamda salt-okunur erişiminiz var; değişiklik yapılamaz.");
                return;
            }
        }

        await next(context);
    }

    private static bool IsWriteMethod(string method) =>
        !HttpMethods.IsGet(method) && !HttpMethods.IsHead(method) && !HttpMethods.IsOptions(method);

    // Aktif bağlam (kurum ya da platform) Manage yetkisiyle mi kapsanıyor?
    private static async Task<bool> CanManageActiveContextAsync(
        HttpContext context, Guid userId, IReadOnlyList<CourseIntellect.Domain.Entities.UserScopeGrant> grants, IUserScopeService scopeService)
    {
        var activeScope = context.RequestServices.GetRequiredService<IActiveScope>();
        if (activeScope.IsResolved && activeScope.TenantId is Guid tenant)
        {
            // Kurum bağlamı: Tenant/Group/Platform Manage kapsıyorsa yazabilir.
            if (await scopeService.CanManageTenantAsync(userId, tenant, context.RequestAborted)) return true;

            // Şubeye kilitli Manage (şube müdürü): şubesi bu kuruma aitse yazabilir.
            var branchManage = grants
                .Where(g => g.Level == CourseIntellect.Domain.Enums.ScopeLevel.Branch
                    && g.AccessMode == CourseIntellect.Domain.Enums.ScopeAccessMode.Manage
                    && g.TargetId is not null)
                .Select(g => g.TargetId!.Value)
                .ToList();
            foreach (var branchId in branchManage)
            {
                if (await scopeService.BranchBelongsToTenantAsync(branchId, tenant, context.RequestAborted)) return true;
            }
            return false;
        }

        // Platform bağlamı: Platform seviyesinde Manage grant gerekir.
        return grants.Any(g => g.Level == CourseIntellect.Domain.Enums.ScopeLevel.Platform
            && g.AccessMode == CourseIntellect.Domain.Enums.ScopeAccessMode.Manage);
    }

    /// <returns><c>false</c> ise 403 yazıldı ve istek sonlandırılmalı.</returns>
    private static async Task<bool> TryResolveAsync(
        HttpContext context, ClaimsPrincipal user, Guid userId, IUserScopeService scopeService)
    {
        var activeScope = context.RequestServices.GetRequiredService<IActiveScope>();
        var homeTenant = ParseGuid(user.FindFirstValue("tenant_id"));
        var homeBranch = ParseGuid(user.FindFirstValue("branch_id"));

        // 1) Aktif kurum: header ev kurumdan farklıysa doğrula.
        var activeTenant = homeTenant;
        if (ParseGuid(context.Request.Headers[TenantHeader]) is Guid requestedTenant
            && requestedTenant != homeTenant)
        {
            if (!await scopeService.CanAccessTenantAsync(userId, requestedTenant, context.RequestAborted))
            {
                return await ForbidAsync(context, "Bu kuruma erişim yetkiniz yok.");
            }
            activeTenant = requestedTenant;
        }

        // 2) Platform bağlamı (kurum yok) → şube kısıtı yok.
        if (activeTenant is not Guid tenant)
        {
            activeScope.Set(null, null);
            return true;
        }

        // 3) Aktif şube.
        var allowed = await scopeService.ResolveAllowedBranchesAsync(userId, tenant, context.RequestAborted);
        var requestedBranch = ParseGuid(context.Request.Headers[BranchHeader]);

        Guid? activeBranch;
        if (allowed is null)
        {
            // Kurum içinde tüm şubeler. Header varsa o şubeye odaklan (kuruma ait olmalı).
            if (requestedBranch is Guid focusBranch)
            {
                if (!await scopeService.BranchBelongsToTenantAsync(focusBranch, tenant, context.RequestAborted))
                {
                    return await ForbidAsync(context, "Seçilen şube bu kuruma ait değil.");
                }
                activeBranch = focusBranch;
            }
            else
            {
                activeBranch = null;
            }
        }
        else if (allowed.Count == 0)
        {
            return await ForbidAsync(context, "Bu kurumda görüntüleyebileceğiniz şube yok.");
        }
        else if (requestedBranch is Guid lockedBranch)
        {
            if (!allowed.Contains(lockedBranch))
            {
                return await ForbidAsync(context, "Bu şubeye erişim yetkiniz yok.");
            }
            activeBranch = lockedBranch;
        }
        else
        {
            // Şubeye kilitli, header yok: ev şubesi izinliyse onu, değilse ilk izinli şubeyi seç.
            activeBranch = homeBranch is Guid hb && allowed.Contains(hb) ? hb : allowed.Min();
        }

        activeScope.Set(tenant, activeBranch);
        return true;
    }

    private static Guid? ResolveUserId(ClaimsPrincipal user) =>
        ParseGuid(user.FindFirstValue("user_id")
            ?? user.FindFirstValue("nameid")
            ?? user.FindFirstValue("sub")
            ?? user.FindFirstValue(ClaimTypes.NameIdentifier));

    private static Guid? ParseGuid(string? raw) => Guid.TryParse(raw, out var value) ? value : null;

    private static async Task<bool> ForbidAsync(HttpContext context, string message)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new { message });
        return false;
    }
}
