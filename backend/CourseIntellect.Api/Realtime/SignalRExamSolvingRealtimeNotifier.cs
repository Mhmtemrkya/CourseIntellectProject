using CourseIntellect.Api.Hubs;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace CourseIntellect.Api.Realtime;

public sealed class SignalRExamSolvingRealtimeNotifier(IHubContext<ExamSolvingHub> hubContext) : IExamSolvingRealtimeNotifier
{
    public Task NotifyAnswerSavedAsync(Guid sessionId, Guid questionAttemptId, CancellationToken cancellationToken = default)
    {
        return Send(sessionId, "AnswerSaved", new { sessionId, questionAttemptId }, cancellationToken);
    }

    public Task NotifyCanvasSavedAsync(Guid sessionId, Guid questionAttemptId, CancellationToken cancellationToken = default)
    {
        return Send(sessionId, "CanvasStrokeSaved", new { sessionId, questionAttemptId }, cancellationToken);
    }

    public Task NotifyExamCompletedAsync(Guid sessionId, CancellationToken cancellationToken = default)
    {
        return Send(sessionId, "ExamCompleted", new { sessionId }, cancellationToken);
    }

    public Task NotifyPdfQueuedAsync(Guid sessionId, Guid reportId, CancellationToken cancellationToken = default)
    {
        return Send(sessionId, "PdfReportQueued", new { sessionId, reportId }, cancellationToken);
    }

    public Task NotifyPdfReadyAsync(Guid sessionId, Guid reportId, string downloadUrl, CancellationToken cancellationToken = default)
    {
        return Send(sessionId, "PdfReportReady", new { sessionId, reportId, downloadUrl }, cancellationToken);
    }

    public Task NotifyTeacherReviewAddedAsync(Guid sessionId, Guid questionAttemptId, CancellationToken cancellationToken = default)
    {
        return Send(sessionId, "TeacherReviewAdded", new { sessionId, questionAttemptId }, cancellationToken);
    }

    private Task Send(Guid sessionId, string eventName, object payload, CancellationToken cancellationToken)
    {
        return hubContext.Clients.Group($"session-{sessionId}").SendAsync(eventName, payload, cancellationToken);
    }
}
