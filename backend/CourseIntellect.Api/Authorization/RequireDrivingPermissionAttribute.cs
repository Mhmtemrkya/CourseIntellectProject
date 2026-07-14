using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace CourseIntellect.Api.Authorization;

/// <summary>
/// Sürücü kursu ucunun, oturum açan kullanıcının etkin izin setinde belirli bir
/// kodu taşımasını zorunlu kılar. Rol tabanlı <c>[Authorize]</c> kontrolünün
/// ÜZERİNE eklenir: rol paneli, permission işlemi belirler.
///
///   [RequireDrivingPermission(DrivingPermissions.VehicleCreate)]  // POST /vehicles
///
/// Birden çok kod verilirse HERHANGİ biri yeterlidir (ör. görüntüleme uçlarında
/// hem yönetici hem filo sorumlusunun farklı kodları kabul edilir).
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true, Inherited = true)]
public sealed class RequireDrivingPermissionAttribute(params string[] permissions) : Attribute, IFilterFactory
{
    public string[] Permissions { get; } = permissions;

    public bool IsReusable => false;

    public IFilterMetadata CreateInstance(IServiceProvider serviceProvider)
        => new DrivingPermissionFilter(
            Permissions,
            serviceProvider.GetRequiredService<IDrivingPermissionService>());
}

public sealed class DrivingPermissionFilter(
    string[] permissions,
    IDrivingPermissionService permissionService) : IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var granted = await permissionService.GetPermissionsAsync(
            context.HttpContext.User,
            context.HttpContext.RequestAborted);

        if (permissions.Any(granted.Contains))
        {
            return;
        }

        context.Result = new ObjectResult(new
        {
            message = "Bu işlem için yetkiniz bulunmuyor.",
            requiredPermissions = permissions,
        })
        {
            StatusCode = StatusCodes.Status403Forbidden,
        };
    }
}
