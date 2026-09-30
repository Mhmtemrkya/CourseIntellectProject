using System.Collections.Concurrent;
using System.Security.Claims;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Hubs;

/// <summary>Checks hub operations and closes disabled institutions' existing connections.</summary>
public sealed class TenantAccessHubFilter(IServiceScopeFactory scopes, ILogger<TenantAccessHubFilter> logger)
    : BackgroundService, IHubFilter
{
    private readonly ConcurrentDictionary<string, HubCallerContext> connections = new();

    private static Guid? UserId(HubCallerContext context)
    {
        var raw = context.User?.FindFirstValue("sub") ?? context.User?.FindFirstValue("nameid")
            ?? context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var userId) ? userId : null;
    }

    private static IQueryable<Guid> AllowedUsers(CourseIntellectDbContext db, Guid[] userIds)
        => db.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(u => userIds.Contains(u.Id) && u.Status == UserStatus.Active
                && (u.TenantId == null || db.TenantWorkspaces.IgnoreQueryFilters()
                    .Any(t => t.Id == u.TenantId && t.Status == "active")))
            .Select(u => u.Id);

    private async Task<bool> Allowed(HubCallerContext context, CancellationToken ct)
    {
        if (UserId(context) is not Guid userId) return false;
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CourseIntellectDbContext>();
        return await AllowedUsers(db, [userId]).AnyAsync(ct);
    }

    public async ValueTask<object?> InvokeMethodAsync(HubInvocationContext invocation, Func<HubInvocationContext, ValueTask<object?>> next)
    {
        if (!await Allowed(invocation.Context, invocation.Context.ConnectionAborted))
        {
            invocation.Context.Abort();
            throw new HubException("Kurum erişimi kapalı.");
        }
        return await next(invocation);
    }

    public async Task OnConnectedAsync(HubLifetimeContext context, Func<HubLifetimeContext, Task> next)
    {
        if (!await Allowed(context.Context, context.Context.ConnectionAborted))
        {
            context.Context.Abort();
            return;
        }
        await next(context);
        if (!context.Context.ConnectionAborted.IsCancellationRequested)
            connections[context.Context.ConnectionId] = context.Context;
    }

    public async Task OnDisconnectedAsync(HubLifetimeContext context, Exception? exception, Func<HubLifetimeContext, Exception?, Task> next)
    {
        connections.TryRemove(context.Context.ConnectionId, out _);
        await next(context, exception);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                var snapshot = connections.ToArray();
                if (snapshot.Length == 0) continue;
                try
                {
                    using var scope = scopes.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<CourseIntellectDbContext>();
                    var ids = snapshot.Select(c => UserId(c.Value)).OfType<Guid>().Distinct().ToArray();
                    var allowed = new HashSet<Guid>();
                    // Share checks across all hubs and connections instead of polling for every socket.
                    foreach (var batch in ids.Chunk(1000))
                        allowed.UnionWith(await AllowedUsers(db, batch).ToListAsync(stoppingToken));
                    foreach (var (connectionId, context) in snapshot)
                    {
                        if (context.ConnectionAborted.IsCancellationRequested)
                            connections.TryRemove(connectionId, out _);
                        else if (UserId(context) is not Guid userId || !allowed.Contains(userId))
                        {
                            context.Abort();
                            connections.TryRemove(connectionId, out _);
                        }
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogWarning(ex, "Canlı bağlantı erişimi doğrulanamadı");
                    foreach (var (connectionId, context) in snapshot)
                    {
                        context.Abort();
                        connections.TryRemove(connectionId, out _);
                    }
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    }
}
