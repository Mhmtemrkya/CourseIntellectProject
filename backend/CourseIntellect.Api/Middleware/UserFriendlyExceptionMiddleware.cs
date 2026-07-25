using System.Text.Json;

namespace CourseIntellect.Api.Middleware;

/// <summary>
/// Beklenmeyen teknik ayrıntıların son kullanıcıya sızmasını engeller. Ayrıntı logda
/// tutulur; kullanıcıya ne olduğu, ne yapabileceği ve destek için takip kodu verilir.
/// </summary>
public sealed class UserFriendlyExceptionMiddleware(
    RequestDelegate next,
    ILogger<UserFriendlyExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            logger.LogInformation(
                "İstemci isteği iptal etti. {Method} {Path} TraceId={TraceId}",
                context.Request.Method,
                context.Request.Path,
                context.TraceIdentifier);
        }
        catch (Exception exception)
        {
            var traceId = context.TraceIdentifier;
            logger.LogError(
                exception,
                "Beklenmeyen API hatası. {Method} {Path} TraceId={TraceId}",
                context.Request.Method,
                context.Request.Path,
                traceId);

            if (context.Response.HasStarted) throw;

            context.Response.Clear();
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json; charset=utf-8";
            await context.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                code = "UNEXPECTED_ERROR",
                message = "İşlem şu anda tamamlanamadı.",
                reason = "Sunucuda beklenmeyen bir sorun oluştu.",
                action = "Kısa bir süre sonra tekrar deneyin. Sorun devam ederse takip kodunu destek ekibine iletin.",
                traceId,
            }));
        }
    }
}
