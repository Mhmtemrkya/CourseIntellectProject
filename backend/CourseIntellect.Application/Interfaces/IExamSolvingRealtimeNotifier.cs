namespace CourseIntellect.Application.Interfaces;

public interface IExamSolvingRealtimeNotifier
{
    Task NotifyAnswerSavedAsync(Guid sessionId, Guid questionAttemptId, CancellationToken cancellationToken = default);
    Task NotifyCanvasSavedAsync(Guid sessionId, Guid questionAttemptId, CancellationToken cancellationToken = default);
    Task NotifyExamCompletedAsync(Guid sessionId, CancellationToken cancellationToken = default);
    Task NotifyPdfQueuedAsync(Guid sessionId, Guid reportId, CancellationToken cancellationToken = default);
    Task NotifyPdfReadyAsync(Guid sessionId, Guid reportId, string downloadUrl, CancellationToken cancellationToken = default);
    Task NotifyTeacherReviewAddedAsync(Guid sessionId, Guid questionAttemptId, CancellationToken cancellationToken = default);
}
