namespace CourseIntellect.Application.DTOs.ExamSolving;

public sealed record StartSolutionSessionRequest(
    string Title,
    string Subject,
    string StudentUsername,
    string? StudentName,
    string? ClassName,
    int DurationSeconds,
    bool IsTeacherPreview,
    Guid? PlannedExamId,
    IReadOnlyList<Guid>? QuestionIds,
    int QuestionCount = 10);

public sealed record SaveSolutionAnswerRequest(
    Guid QuestionAttemptId,
    int SelectedOptionIndex,
    string? OpenAnswer,
    int TimeSpentSeconds);

public sealed record SaveQuestionFlagRequest(
    Guid QuestionAttemptId,
    bool IsFlagged,
    string? FlagType);

public sealed record SaveStudentNoteRequest(Guid QuestionAttemptId, string Note);

public sealed record SaveCanvasStrokeRequest(
    Guid QuestionAttemptId,
    string Tool,
    string Color,
    decimal Width,
    decimal Opacity,
    decimal? Pressure,
    string PointsJson);

public sealed record SaveCanvasSnapshotRequest(
    Guid QuestionAttemptId,
    string DataUrl);

public sealed record AddTeacherReviewRequest(Guid QuestionAttemptId, string Comment);

public sealed record SolutionSessionResponse(
    Guid Id,
    string Title,
    string Subject,
    string StudentName,
    string StudentUsername,
    string ClassName,
    int DurationSeconds,
    bool IsTeacherPreview,
    string Status,
    DateTime StartedAtUtc,
    DateTime? CompletedAtUtc,
    IReadOnlyList<SolutionQuestionResponse> Questions,
    PdfReportResponse? LatestReport);

public sealed record SolutionQuestionResponse(
    Guid AttemptId,
    Guid QuestionBankItemId,
    int SortOrder,
    string Subject,
    string Topic,
    string Difficulty,
    string Type,
    string QuestionText,
    string? ImagePath,
    string ImagePlacement,
    IReadOnlyList<string> Options,
    int? CorrectOptionIndex,
    string Status,
    bool IsFlagged,
    string FlagType,
    int TimeSpentSeconds,
    AnswerSelectionResponse? Answer,
    string? Note,
    string? SnapshotUrl,
    IReadOnlyList<TeacherReviewResponse> TeacherReviews);

public sealed record AnswerSelectionResponse(
    Guid Id,
    int SelectedOptionIndex,
    string? OpenAnswer,
    bool IsCorrect,
    DateTime SavedAtUtc);

public sealed record PdfReportResponse(
    Guid Id,
    Guid ExamSessionId,
    string Status,
    string? DownloadUrl,
    string? ErrorMessage,
    DateTime CreatedAtUtc,
    DateTime? ReadyAtUtc);

public sealed record TeacherReviewResponse(
    Guid Id,
    string TeacherName,
    string Comment,
    DateTime CreatedAtUtc);

public sealed record SolutionSummaryResponse(
    Guid SessionId,
    int Total,
    int Correct,
    int Wrong,
    int Empty,
    decimal Net,
    int SuccessPercent,
    PdfReportResponse? Report);
