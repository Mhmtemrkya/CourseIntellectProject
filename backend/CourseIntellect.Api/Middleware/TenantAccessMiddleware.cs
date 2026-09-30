using System.Security.Claims;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Middleware;

/// <summary>Disabling an institution also invalidates access through previously issued JWTs.</summary>
public sealed class TenantAccessMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, CourseIntellectDbContext db, CourseIntellect.Application.Interfaces.IActiveScope activeScope)
    {
        if (context.GetEndpoint()?.Metadata.GetMetadata<Microsoft.AspNetCore.Authorization.IAllowAnonymous>() is not null)
        {
            await next(context);
            return;
        }
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var raw = context.User.FindFirstValue("sub") ?? context.User.FindFirstValue("nameid")
                ?? context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!Guid.TryParse(raw, out var userId))
            {
                context.Response.StatusCode = 401;
                return;
            }
            var user = await db.Users.IgnoreQueryFilters().AsNoTracking()
                .Where(u => u.Id == userId).Select(u => new { u.TenantId, u.Status })
                .SingleOrDefaultAsync(context.RequestAborted);
            if (user is null || user.Status != CourseIntellect.Domain.Enums.UserStatus.Active)
            {
                context.Response.StatusCode = 401;
                return;
            }
            var targetTenant = user.TenantId;
            var platformAdmin = context.User.HasClaim("platform_admin", "true") || context.User.IsInRole("Developer");
            if (!platformAdmin && activeScope.TenantId is Guid activeTenant && activeTenant != user.TenantId
                && !await db.TenantWorkspaces.IgnoreQueryFilters().AnyAsync(t => t.Id == activeTenant && t.Status == "active", context.RequestAborted))
                targetTenant = activeTenant;
            if (targetTenant is Guid tenantId && !await db.TenantWorkspaces.IgnoreQueryFilters()
                .AnyAsync(t => t.Id == tenantId && t.Status == "active", context.RequestAborted))
            {
                context.Response.StatusCode = 403;
                await context.Response.WriteAsJsonAsync(new
                {
                    code = "TENANT_DISABLED",
                    message = "Kurumunuzun erişimi kapalı. Müşteri numaranızla destek sayfasından bize ulaşabilirsiniz.",
                }, context.RequestAborted);
                return;
            }
        }
        await next(context);
    }
}
