using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;

namespace CourseIntellect.Api;

public static class ForwardedHeadersConfiguration
{
    public static void Apply(ForwardedHeadersOptions options, IConfiguration configuration, IHostEnvironment environment)
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor
            | ForwardedHeaders.XForwardedProto
            | ForwardedHeaders.XForwardedHost;
        options.ForwardLimit = 1;
        options.RequireHeaderSymmetry = true;

        var configured = configuration["ReverseProxy:KnownProxies"]?
            .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            ?? [];
        foreach (var value in configured)
        {
            if (!IPAddress.TryParse(value, out var address))
            {
                if (environment.IsProduction())
                    throw new InvalidOperationException($"ReverseProxy:KnownProxies contains an invalid IP address: {value}");
                continue;
            }
            options.KnownProxies.Add(address);
        }
    }
}
