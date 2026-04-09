using CourseIntellect.Application.DTOs.Messages;

namespace CourseIntellect.Application.Interfaces;

public interface IMessageRealtimeNotifier
{
    Task NotifyThreadUpdatedAsync(
        Guid threadId,
        IReadOnlyCollection<string> participantKeys,
        MessageThreadDto thread,
        CancellationToken cancellationToken = default);

    Task NotifyMessageReceivedAsync(
        Guid threadId,
        IReadOnlyCollection<string> participantKeys,
        MessageItemDto message,
        CancellationToken cancellationToken = default);

    Task NotifyMessageStatusChangedAsync(
        Guid threadId,
        IReadOnlyCollection<string> participantKeys,
        MessageStatusChangedDto payload,
        CancellationToken cancellationToken = default);
}
