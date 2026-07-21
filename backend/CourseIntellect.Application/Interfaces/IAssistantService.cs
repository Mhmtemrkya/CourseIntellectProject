using CourseIntellect.Application.DTOs.Assistant;

namespace CourseIntellect.Application.Interfaces;

public interface IAssistantIntentResolver
{
    /// <summary>
    /// Kullanıcı mesajını niyet + varlıklara ayrıştırır. Uygulama yerel LLM ile
    /// desteklenebildiği için async'tir; kural tabanlı gerçekleştirme senkron
    /// çalışıp tamamlanmış görev döndürür.
    /// </summary>
    Task<ParsedAssistantQuery> ResolveAsync(string message, CancellationToken cancellationToken = default);
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
