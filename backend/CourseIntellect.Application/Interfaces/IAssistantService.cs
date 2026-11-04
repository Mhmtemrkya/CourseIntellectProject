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
    Task<IReadOnlyList<AssistantConversationDto>> GetConversationsAsync(AssistantRequestContext context, string? portal, CancellationToken cancellationToken);
    Task<IReadOnlyList<AssistantMessageDto>?> GetMessagesAsync(AssistantRequestContext context, Guid conversationId, CancellationToken cancellationToken);
    Task<bool> DeleteConversationAsync(AssistantRequestContext context, Guid conversationId, CancellationToken cancellationToken);
    Task<IReadOnlyList<AssistantSuggestionDto>> GetSuggestionsAsync(AssistantRequestContext context, CancellationToken cancellationToken);
    Task<AssistantResponseDto> SendAsync(AssistantRequestContext context, SendAssistantMessageRequest request, CancellationToken cancellationToken);
    Task<AssistantResponseDto> ExecuteActionAsync(AssistantRequestContext context, AssistantActionRequest request, CancellationToken cancellationToken);
    Task<AssistantBriefingDto> GetBriefingAsync(AssistantRequestContext context, CancellationToken cancellationToken);
    Task<bool> SetFeedbackAsync(AssistantRequestContext context, Guid messageId, bool helpful, CancellationToken cancellationToken);
    Task<IReadOnlyList<AssistantUnansweredDto>> GetUnansweredAsync(AssistantRequestContext context, int days, CancellationToken cancellationToken);
    /// <summary>Kullanıcının kendi rapor mesajının PDF'i; mesaj başkasınınsa ya da rapor değilse null.</summary>
    Task<(byte[] Content, string FileName)?> GetReportPdfAsync(AssistantRequestContext context, Guid messageId, CancellationToken cancellationToken);
    Task<(byte[] Content, string FileName)?> GetReportExcelAsync(AssistantRequestContext context, Guid messageId, CancellationToken cancellationToken);
    /// <summary>6 sayfalık Öğrenci Başarı Raporu; öğrenci kullanıcının kapsamında değilse null.</summary>
    Task<(byte[] Content, string FileName)?> GetStudentSuccessPdfAsync(AssistantRequestContext context, Guid studentId, CancellationToken cancellationToken);
}
