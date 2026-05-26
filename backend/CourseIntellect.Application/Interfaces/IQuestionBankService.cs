using CourseIntellect.Application.DTOs.QuestionBank;

namespace CourseIntellect.Application.Interfaces;

public interface IQuestionBankService
{
    Task<IReadOnlyList<QuestionBankItemDto>> GetQuestionsAsync(string? className, bool includeDrafts = false, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<QuestionPracticeAttemptDto>> GetAttemptsAsync(string? studentUsername, CancellationToken cancellationToken = default);
    Task<QuestionBankItemDto> CreateQuestionAsync(CreateQuestionBankItemRequest request, CancellationToken cancellationToken = default);
    Task<QuestionBankItemDto?> UpdateQuestionAsync(Guid id, CreateQuestionBankItemRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteQuestionAsync(Guid id, CancellationToken cancellationToken = default);
    Task<QuestionBankItemDto?> IncrementUsageAsync(Guid id, CancellationToken cancellationToken = default);
    Task<QuestionPracticeAttemptDto?> SubmitAttemptAsync(Guid id, SubmitQuestionPracticeAttemptRequest request, CancellationToken cancellationToken = default);
}
