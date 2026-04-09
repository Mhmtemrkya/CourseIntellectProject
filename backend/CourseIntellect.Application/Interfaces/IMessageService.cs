using CourseIntellect.Application.DTOs.Messages;

namespace CourseIntellect.Application.Interfaces;

public interface IMessageService
{
    Task<IReadOnlyList<MessageThreadDto>> GetThreadsAsync(Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<MessageItemDto>> GetMessagesAsync(Guid currentUserId, string currentUserName, Guid threadId, CancellationToken cancellationToken = default);
    Task<MessageThreadDto> CreateOrGetThreadAsync(Guid currentUserId, string currentUserName, string currentUserRole, CreateThreadRequest request, CancellationToken cancellationToken = default);
    Task<MessageItemDto> SendMessageAsync(Guid currentUserId, string currentUserName, string currentUserRole, Guid threadId, SendMessageRequest request, CancellationToken cancellationToken = default);
    Task JoinRealtimeAsync(Guid currentUserId, string currentUserName, Guid threadId, CancellationToken cancellationToken = default);
}
