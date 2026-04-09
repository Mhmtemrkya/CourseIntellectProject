using CourseIntellect.Api.Hubs;
using CourseIntellect.Application.DTOs.Messages;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace CourseIntellect.Api.Realtime;

public sealed class SignalRMessageRealtimeNotifier(IHubContext<MessagesHub> hubContext) : IMessageRealtimeNotifier
{
    public async Task NotifyThreadUpdatedAsync(
        Guid threadId,
        IReadOnlyCollection<string> participantKeys,
        MessageThreadDto thread,
        CancellationToken cancellationToken = default)
    {
        var targets = BuildTargets(threadId, participantKeys);
        foreach (var target in targets)
        {
            await hubContext.Clients.Group(target).SendAsync("threadUpdated", thread, cancellationToken);
        }
    }

    public async Task NotifyMessageReceivedAsync(
        Guid threadId,
        IReadOnlyCollection<string> participantKeys,
        MessageItemDto message,
        CancellationToken cancellationToken = default)
    {
        var targets = BuildTargets(threadId, participantKeys);
        foreach (var target in targets)
        {
            await hubContext.Clients.Group(target).SendAsync("messageReceived", message, cancellationToken);
        }
    }

    public async Task NotifyMessageStatusChangedAsync(
        Guid threadId,
        IReadOnlyCollection<string> participantKeys,
        MessageStatusChangedDto payload,
        CancellationToken cancellationToken = default)
    {
        var targets = BuildTargets(threadId, participantKeys);
        foreach (var target in targets)
        {
            await hubContext.Clients.Group(target).SendAsync("messageStatusChanged", payload, cancellationToken);
        }
    }

    private static IReadOnlyCollection<string> BuildTargets(Guid threadId, IReadOnlyCollection<string> participantKeys)
    {
        var groups = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            MessagesHub.BuildThreadGroup(threadId)
        };

        foreach (var participantKey in participantKeys)
        {
            if (string.IsNullOrWhiteSpace(participantKey))
            {
                continue;
            }

            groups.Add(MessagesHub.BuildUserGroup(participantKey));
        }

        return groups.ToArray();
    }
}
