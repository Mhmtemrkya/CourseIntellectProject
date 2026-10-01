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

    private static long? TokenSecurityVersion(HubCallerContext context)
        => long.TryParse(context.User?.FindFirstValue("security_version"), out var v) ? v : null;

    // Aktif kullanıcı + aktif kurum koşulunu geçen kullanıcıların güncel
    // SecurityVersion'ını döndürür. SecurityVersion'ı burada süzmeyiz: bağlantı
    // başına token claim'iyle karşılaştırılır (bir kullanıcının farklı
    // sürümlerde birden çok açık soketi olabilir).
    private static IQueryable<(Guid Id, long SecurityVersion)> AllowedUsers(CourseIntellectDbContext db, Guid[] userIds)
        => db.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(u => userIds.Contains(u.Id) && u.Status == UserStatus.Active
                && (u.TenantId == null || db.TenantWorkspaces.IgnoreQueryFilters()
                    .Any(t => t.Id == u.TenantId && t.Status == "active")))
            .Select(u => new ValueTuple<Guid, long>(u.Id, u.SecurityVersion));

    private async Task<bool> Allowed(HubCallerContext context, CancellationToken ct)
    {
        if (UserId(context) is not Guid userId) return false;
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CourseIntellectDbContext>();
        var row = await AllowedUsers(db, [userId]).FirstOrDefaultAsync(ct);
        if (row.Id == Guid.Empty) return false;
        // Parola reseti / oturum iptali SecurityVersion'ı artırır; açık soketin
        // token'ındaki sürüm eskiyse bağlantı artık geçerli değildir. Eskiden
        // yalnız Status/kurum aktifliğine bakılıyor, iptal edilmiş oturumun soketi
        // mesaj almayı sürdürebiliyordu.
        return TokenSecurityVersion(context) is long tokenVersion && tokenVersion == row.SecurityVersion;
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
                    // Kullanıcı başına GÜNCEL SecurityVersion. Her socket için ayrı
                    // sorgu yerine toplu okunur; sürüm karşılaştırması bağlantı başına.
                    var current = new Dictionary<Guid, long>();
                    foreach (var batch in ids.Chunk(1000))
                        foreach (var row in await AllowedUsers(db, batch).ToListAsync(stoppingToken))
                            current[row.Id] = row.SecurityVersion;
                    foreach (var (connectionId, context) in snapshot)
                    {
                        if (context.ConnectionAborted.IsCancellationRequested)
                            connections.TryRemove(connectionId, out _);
                        else if (UserId(context) is not Guid userId
                            || !current.TryGetValue(userId, out var version)
                            || TokenSecurityVersion(context) != version)
                        {
                            // Status/kurum geçersiz VEYA token'ın SecurityVersion'ı
                            // artık eski (parola reseti / oturum iptali) → soket düşer.
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
