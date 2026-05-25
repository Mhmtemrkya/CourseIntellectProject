using CourseIntellect.Application.DTOs.ExamSolving;

namespace CourseIntellect.Application.Interfaces;

public interface IExamSolvingService
{
    Task<SolutionSessionResponse> StartAsync(StartSolutionSessionRequest request, CancellationToken cancellationToken);
    Task<SolutionSessionResponse?> GetAsync(Guid sessionId, CancellationToken cancellationToken);
    Task<SolutionSessionResponse> SaveAnswerAsync(Guid sessionId, SaveSolutionAnswerRequest request, CancellationToken cancellationToken);
    Task<SolutionSessionResponse> SaveFlagAsync(Guid sessionId, SaveQuestionFlagRequest request, CancellationToken cancellationToken);
    Task<SolutionSessionResponse> SaveNoteAsync(Guid sessionId, SaveStudentNoteRequest request, CancellationToken cancellationToken);
    Task SaveStrokeAsync(Guid sessionId, SaveCanvasStrokeRequest request, CancellationToken cancellationToken);
    Task<CanvasSnapshotSavedResult> SaveSnapshotAsync(Guid sessionId, SaveCanvasSnapshotRequest request, string baseUrl, CancellationToken cancellationToken);
    Task<SolutionSummaryResponse> CompleteAsync(Guid sessionId, string baseUrl, CancellationToken cancellationToken);
    Task<PdfReportResponse> QueuePdfAsync(Guid sessionId, string baseUrl, CancellationToken cancellationToken);
    Task<IReadOnlyList<PdfReportResponse>> GetTeacherReportsAsync(CancellationToken cancellationToken);
    Task<SolutionSessionResponse> AddTeacherReviewAsync(Guid sessionId, AddTeacherReviewRequest request, string teacherName, Guid? teacherUserId, CancellationToken cancellationToken);
}

public sealed record CanvasSnapshotSavedResult(Guid Id, string Url);
