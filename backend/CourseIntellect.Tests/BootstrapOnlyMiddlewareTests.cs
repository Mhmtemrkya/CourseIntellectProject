using System.Security.Claims;
using CourseIntellect.Api.Middleware;
using Microsoft.AspNetCore.Http;

namespace CourseIntellect.Tests;

public sealed class BootstrapOnlyMiddlewareTests
{
    [Theory]
    [InlineData("POST", "/api/auth/change-password", 204)]
    [InlineData("POST", "/api/auth/logout", 204)]
    [InlineData("GET", "/api/auth/me", 403)]
    [InlineData("PUT", "/api/auth/me", 403)]
    [InlineData("GET", "/api/students", 403)]
    [InlineData("GET", "/hubs/messages", 403)]
    public async Task Bootstrap_token_is_restricted_to_credential_exit_endpoints(string method, string path, int expected)
    {
        var nextCalled = false;
        var middleware = new BootstrapOnlyMiddleware(_ =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });
        var context = new DefaultHttpContext();
        context.Request.Method = method;
        context.Request.Path = path;
        context.User = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim("sub", Guid.NewGuid().ToString()),
            new Claim("bootstrap_only", "true")
        ], "test"));
        context.Response.StatusCode = StatusCodes.Status204NoContent;

        await middleware.InvokeAsync(context);

        Assert.Equal(expected, context.Response.StatusCode);
        Assert.Equal(expected == 204, nextCalled);
    }
}
