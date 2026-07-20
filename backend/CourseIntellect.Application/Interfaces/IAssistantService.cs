using CourseIntellect.Application.DTOs.Assistant;

namespace CourseIntellect.Application.Interfaces;

public interface IAssistantIntentResolver
{
    ParsedAssistantQuery Resolve(string message);
}

public interface IAssistantService
{
    Task<AssistantConversationDto> CreateConversationAsync(AssistantRequestContext context, string? title, CancellationToken cancellationToken);
    Task<IReadOnlyList<AssistantConversationDto>> GetConversationsAsync(AssistantRequestContext context, CancellationToken cancellationToken);
    Task<IReadOnlyList<AssistantMessageDto>?> GetMessagesAsync(AssistantRequestContext context, Guid conversationId, CancellationToken cancellationToken);
    Task<bool> DeleteConversationAsync(AssistantRequestContext context, Guid conversationId, CancellationToken cancellationToken);
    Task<IReadOnlyList<AssistantSuggestionDto>> GetSuggestionsAsync(AssistantRequestContext context, CancellationToken cancellationToken);
    Task<AssistantResponseDto> SendAsync(AssistantRequestContext context, SendAssistantMessageRequest request, CancellationToken cancellationToken);
    Task<AssistantResponseDto> ExecuteActionAsync(AssistantRequestContext context, AssistantActionRequest request, CancellationToken cancellationToken);
}
