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

    /// <summary>
    /// Thread'e yanıt ekler. Çağıranın o thread'e ERİŞİM HAKKI listeleme ile aynı
    /// kurala göre doğrulanır; hakkı yoksa <c>null</c> döner (thread'in varlığı da
    /// sızmaz). <paramref name="senderUsername"/> öğrenci eşleşmesi için gereklidir.
    /// </summary>
    Task<QuestionThreadDto?> AddReplyAsync(
        Guid threadId,
        string senderName,
        string senderRole,
        string senderUsername,
        CreateQuestionThreadReplyRequest request,
        CancellationToken cancellationToken = default);
}
