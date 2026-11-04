using System.Text.Json;
using CourseIntellect.Infrastructure.Auth;

namespace CourseIntellect.Api.Middleware;

/// <summary>
/// Web (tarayıcı) kökeninden gelen KİMLİKLİ isteklerde yalnız demo kurumunun demo hesapları
/// geçer. Uygulama dışından elde edilmiş gerçek bir hesap token'ı web arayüzünde kullanılamaz.
/// Kimliksiz herkese açık uçlar (iletişim, destek, site içeriği, PKCE yetkilendirme) etkilenmez.
/// </summary>
public sealed class WebDemoChannelMiddleware(RequestDelegate next, WebDemoAccessPolicy policy)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated == true && policy.IsWebRequest(context))
        {
            var username = context.User.FindFirst("unique_name")?.Value;
            var tenantId = Guid.TryParse(context.User.FindFirst("tenant_id")?.Value, out var parsed) ? parsed : (Guid?)null;
            if (!policy.IsAllowedOnWeb(username, tenantId))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = "application/json; charset=utf-8";
                await context.Response.WriteAsync(JsonSerializer.Serialize(new
                {
                    code = "WEB_DEMO_ONLY",
                    message = new CourseIntellect.Application.Exceptions.WebDemoOnlyException().Message,
                }));
                return;
            }
        }

        await next(context);
    }
}
