using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace CourseIntellect.Api.Authorization;

/// <summary>
/// Bir endpoint'in, oturum açan kullanıcının kurumuna atanmış pakette belirli
/// bir modül (ve isteğe bağlı sayfa içi işlem) için yetkili olmasını zorunlu
/// kılar. Rol tabanlı [Authorize] kontrolünün ÜZERİNE eklenir — kimin
/// yapabileceğini rol, kurumun neyi kullanabileceğini paket belirler.
///
///   [RequireEntitlement("students", "create")]  // POST /api/students
///   [RequireEntitlement("finance")]              // yalnızca modül açık mı
///
/// Paket tanımsız kurumlar ve platform yöneticisi kısıtsızdır.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true, Inherited = true)]
public sealed class RequireEntitlementAttribute(string module, string? action = null)
    : Attribute, IFilterFactory
{
    public string Module { get; } = module;
    public string? Action { get; } = action;

    public bool IsReusable => false;

    public IFilterMetadata CreateInstance(IServiceProvider serviceProvider)
        => new EntitlementAuthorizationFilter(
            Module,
            Action,
            serviceProvider.GetRequiredService<IEntitlementService>());
}

/// <summary>
/// Attribute'un asıl çalışan yetki filtresi. Authorization aşamasında çalışır;
/// izin yoksa 403 döndürür ve action'ı hiç çalıştırmaz.
/// </summary>
public sealed class EntitlementAuthorizationFilter(
    string module,
    string? action,
    IEntitlementService entitlementService) : IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var allowed = await entitlementService.IsAllowedAsync(
            context.HttpContext.User,
            module,
            action,
            context.HttpContext.RequestAborted);

        if (!allowed)
        {
            context.Result = new ObjectResult(new
            {
                message = "Bu işlem kurumunuzun paketinde bulunmuyor.",
                module,
                action,
            })
            {
                StatusCode = StatusCodes.Status403Forbidden,
            };
        }
    }
}
