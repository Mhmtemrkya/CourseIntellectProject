namespace CourseIntellect.Api.Middleware;

/// <summary>Restricts temporary credentials to replacing or abandoning them.</summary>
public sealed class BootstrapOnlyMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated == true
            && string.Equals(context.User.FindFirst("bootstrap_only")?.Value, "true", StringComparison.OrdinalIgnoreCase)
            && !IsExitEndpoint(context.Request))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        await next(context);
    }

    private static bool IsExitEndpoint(HttpRequest request)
        => HttpMethods.IsPost(request.Method)
           && (request.Path.Equals("/api/auth/change-password", StringComparison.OrdinalIgnoreCase)
               || request.Path.Equals("/api/auth/logout", StringComparison.OrdinalIgnoreCase));
}
