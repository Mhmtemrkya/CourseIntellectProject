using System.Security.Claims;
using System.Collections.Concurrent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace CourseIntellect.Api.Hubs;

[Authorize]
public sealed class MessagesHub : Hub
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

    public Task JoinThread(string threadId)
    {
        return Groups.AddToGroupAsync(Context.ConnectionId, BuildThreadGroup(threadId));
    }

    public Task LeaveThread(string threadId)
    {
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, BuildThreadGroup(threadId));
    }

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

    public Task TypingStart(string threadId, string actorName)
    {
        return Clients.Group(BuildThreadGroup(threadId)).SendAsync("typingChanged", new
        {
            threadId = NormalizeKey(threadId),
            actorKey = NormalizeKey(actorName),
            actorName = actorName.Trim(),
            isTyping = true,
        });
    }

    public Task TypingStop(string threadId, string actorName)
    {
        return Clients.Group(BuildThreadGroup(threadId)).SendAsync("typingChanged", new
        {
            threadId = NormalizeKey(threadId),
            actorKey = NormalizeKey(actorName),
            actorName = actorName.Trim(),
            isTyping = false,
        });
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
