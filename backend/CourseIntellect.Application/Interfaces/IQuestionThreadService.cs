using CourseIntellect.Application.DTOs.QuestionThreads;

namespace CourseIntellect.Application.Interfaces;

public interface IQuestionThreadService
{
    Task<IReadOnlyList<QuestionThreadDto>> GetThreadsAsync(
        string requestorRole,
        string fullName,
        string username,
        CancellationToken cancellationToken = default);

    Task<QuestionThreadDto> CreateThreadAsync(
        string studentName,
        string studentUsername,
        CreateQuestionThreadRequest request,
        CancellationToken cancellationToken = default);

    Task<QuestionThreadDto?> AddReplyAsync(
        Guid threadId,
        string senderName,
        string senderRole,
        CreateQuestionThreadReplyRequest request,
        CancellationToken cancellationToken = default);
}
