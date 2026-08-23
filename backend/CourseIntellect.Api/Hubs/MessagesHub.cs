using System.Security.Claims;
using System.Collections.Concurrent;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Hubs;

[Authorize]
public sealed class MessagesHub(CourseIntellectDbContext dbContext) : Hub
{
    private static readonly ConcurrentDictionary<string, int> PresenceCounts = new(StringComparer.OrdinalIgnoreCase);

    public override async Task OnConnectedAsync()
    {
        var actorKeys = BuildActorKeys(Context.User);
        foreach (var actorKey in actorKeys)
        {
            PresenceCounts.AddOrUpdate(actorKey, 1, (_, count) => count + 1);
        }

        var userGroups = BuildUserGroups(Context.User, actorKeys);
        foreach (var group in userGroups)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, group);
        }

        foreach (var actorKey in actorKeys)
        {
            await Clients.Group(BuildPresenceGroup(actorKey)).SendAsync("presenceChanged", new
            {
                actorKey,
                isOnline = true,
            });
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var actorKeys = BuildActorKeys(Context.User);
        foreach (var actorKey in actorKeys)
        {
            var next = PresenceCounts.AddOrUpdate(actorKey, 0, (_, count) => Math.Max(0, count - 1));
            if (next == 0)
            {
                PresenceCounts.TryRemove(actorKey, out _);
                await Clients.Group(BuildPresenceGroup(actorKey)).SendAsync("presenceChanged", new
                {
                    actorKey,
                    isOnline = false,
                });
            }
        }

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Thread grubuna KATILIMCIYSA katılır. Eskiden herhangi bir kimlik doğrulanmış
    /// kullanıcı, bildiği bir thread GUID'i ile gruba girip sonraki mesajları ve ek
    /// dosya URL'lerini dinleyebiliyordu.
    /// </summary>
    public async Task JoinThread(string threadId)
    {
        if (!await IsThreadParticipantAsync(threadId))
        {
            // Sessizce yok sayılır: yabancı bir thread'in var olup olmadığı bilgisi
            // de sızmamalı. İstemci zaten yalnız kendi thread'lerine katılır.
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, BuildThreadGroup(threadId));
    }

    public Task LeaveThread(string threadId)
    {
        // Ayrılmak için yetki aranmaz — gruptan çıkmak zararsızdır.
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, BuildThreadGroup(threadId));
    }

    /// <summary>
    /// Çağıran, verilen thread'in katılımcılarından biri mi? Kimlik yalnızca
    /// tokendan okunur. Tenant, SignalR akışında global query filter'a güvenilemediği
    /// için AÇIKÇA süzülür (hub'da HttpContext güvenilir değildir).
    /// </summary>
    private async Task<bool> IsThreadParticipantAsync(string threadId)
    {
        if (!Guid.TryParse(threadId?.Trim(), out var parsedThreadId)) return false;

        var tenantId = ResolveTenantId();
        if (tenantId is null) return false;

        var thread = await dbContext.MessageThreads
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.Id == parsedThreadId && x.TenantId == tenantId)
            .Select(x => new { x.ParticipantOneName, x.ParticipantTwoName })
            .FirstOrDefaultAsync();
        if (thread is null) return false;

        // Kullanıcının ad/e-posta/kullanıcı adı adaylarından herhangi biri
        // katılımcı adıyla eşleşmeli. Karşılaştırma servisle AYNI normalizasyonu
        // kullanır (MessageParticipantKey) — aksi hâlde kapı yanlış yerde açılır.
        return BuildActorKeys(Context.User).Any(actorKey =>
            MessageParticipantKey.IsParticipant(actorKey, thread.ParticipantOneName, thread.ParticipantTwoName));
    }

    private Guid? ResolveTenantId()
        => Guid.TryParse(Context.User?.FindFirstValue("tenant_id"), out var tenantId) ? tenantId : null;

    public async Task SubscribePresence(string actorKey)
    {
        if (string.IsNullOrWhiteSpace(actorKey))
        {
            return;
        }

        var normalized = NormalizeKey(actorKey);
        await Groups.AddToGroupAsync(Context.ConnectionId, BuildPresenceGroup(normalized));
        await Clients.Caller.SendAsync("presenceChanged", new
        {
            actorKey = normalized,
            isOnline = PresenceCounts.TryGetValue(normalized, out var count) && count > 0,
        });
    }

    public Task UnsubscribePresence(string actorKey)
    {
        if (string.IsNullOrWhiteSpace(actorKey))
        {
            return Task.CompletedTask;
        }

        return Groups.RemoveFromGroupAsync(Context.ConnectionId, BuildPresenceGroup(actorKey));
    }

    // actorName parametresi geriye uyumluluk için imzada DURUR ama KULLANILMAZ:
    // aktör kimliği tokendan türetilir. Eskiden istemci istediği adı yazabildiği
    // için kullanıcı başkası adına "yazıyor..." yayınlayabiliyordu. Ayrıca artık
    // yalnız thread'in katılımcısı typing yayınlayabilir.
    public Task TypingStart(string threadId, string? actorName = null) => PublishTypingAsync(threadId, isTyping: true);

    public Task TypingStop(string threadId, string? actorName = null) => PublishTypingAsync(threadId, isTyping: false);

    private async Task PublishTypingAsync(string threadId, bool isTyping)
    {
        if (!await IsThreadParticipantAsync(threadId)) return;

        var displayName = ResolveActorDisplayName();
        if (string.IsNullOrWhiteSpace(displayName)) return;

        await Clients.Group(BuildThreadGroup(threadId)).SendAsync("typingChanged", new
        {
            threadId = NormalizeKey(threadId),
            actorKey = NormalizeKey(displayName),
            actorName = displayName,
            isTyping,
        });
    }

    /// <summary>Görünen ad yalnız tokendan okunur; istemciden gelen ada güvenilmez.</summary>
    private string ResolveActorDisplayName()
    {
        var user = Context.User;
        return (user?.FindFirstValue("name")
            ?? user?.FindFirstValue(ClaimTypes.Name)
            ?? user?.FindFirstValue("preferred_username")
            ?? user?.FindFirstValue("username")
            ?? string.Empty).Trim();
    }

    public static string BuildThreadGroup(Guid threadId) => BuildThreadGroup(threadId.ToString());

    public static string BuildThreadGroup(string threadId) => $"messages:thread:{threadId.Trim().ToLowerInvariant()}";

    public static string BuildUserGroup(string actorKey) => $"messages:user:{NormalizeKey(actorKey)}";

    public static string BuildPresenceGroup(string actorKey) => $"messages:presence:{NormalizeKey(actorKey)}";

    public static IReadOnlyCollection<string> BuildUserGroups(ClaimsPrincipal? user, IReadOnlyCollection<string>? actorKeys = null)
    {
        var groups = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var resolvedActorKeys = actorKeys ?? BuildActorKeys(user);
        foreach (var actorKey in resolvedActorKeys)
        {
            groups.Add(BuildUserGroup(actorKey));
        }

        return groups.ToArray();
    }

    public static IReadOnlyCollection<string> BuildActorKeys(ClaimsPrincipal? user)
    {
        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (user is null)
        {
            return keys.ToArray();
        }

        var claimCandidates = new[]
        {
            user.FindFirstValue("name"),
            user.FindFirstValue(ClaimTypes.Name),
            user.FindFirstValue("preferred_username"),
            user.FindFirstValue("username"),
            user.FindFirstValue(ClaimTypes.Email),
        };

        foreach (var candidate in claimCandidates)
        {
            if (string.IsNullOrWhiteSpace(candidate))
            {
                continue;
            }

            keys.Add(NormalizeKey(candidate));
        }

        return keys.ToArray();
    }

    private static string NormalizeKey(string value)
    {
        return value.Trim().ToLowerInvariant();
    }
}
