namespace CourseIntellect.Application.DTOs.Insights;

/// <summary>
/// Konu bazlı başarı. Diagnosis: misconception (yanlışlar ağırlıkta), skipping (boş bırakma),
/// declining (son çalışmalarda düşüş); zayıf olmayan konuda null. Trend: up, down, flat, unknown.
/// Oranlar 0-100 arası yüzdedir.
/// </summary>
public sealed record TopicInsightDto(
    string Subject,
    string Topic,
    int Solved,
    int Correct,
    int Wrong,
    int Blank,
    decimal SuccessRate,
    decimal? ClassSuccessRate,
    decimal? PreviousSuccessRate,
    decimal? RecentSuccessRate,
    string Trend,
    bool HasEnoughData,
    bool IsWeak,
    bool IsStrong,
    string? Diagnosis);

public sealed record SubjectInsightDto(string Subject, int Solved, decimal SuccessRate, int WeakTopicCount);

/// <summary>Status: disabled (yapay zekâ kapalı), none, pending, ready, failed. Source: llm ya da template.</summary>
public sealed record InsightNoteDto(
    Guid? Id,
    string Status,
    string? Source,
    string? Model,
    string? Text,
    DateTime? GeneratedAtUtc,
    bool IsCurrent,
    string ReviewStatus,
    string? ReviewedText);

/// <summary>Öğretmen değerlendirmesi: approve (aynen doğru), edit (düzeltilmiş metin), reject.</summary>
public sealed record ReviewInsightNoteRequest(string Action, string? EditedText);

public sealed record StudentInsightDto(
    Guid StudentUserId,
    string FullName,
    string ClassName,
    int Solved,
    decimal SuccessRate,
    DateTime? FirstAnswerAtUtc,
    DateTime? LastAnswerAtUtc,
    IReadOnlyList<SubjectInsightDto> Subjects,
    IReadOnlyList<TopicInsightDto> Topics,
    IReadOnlyList<TopicInsightDto> WeakTopics,
    IReadOnlyList<TopicInsightDto> StrongTopics,
    InsightNoteDto Note,
    int MinSample);

public sealed record ClassStudentInsightDto(
    Guid StudentUserId,
    string FullName,
    int Solved,
    decimal SuccessRate,
    int WeakTopicCount,
    string? TopWeakSubject,
    string? TopWeakTopic);

public sealed record ClassTopicInsightDto(
    string Subject,
    string Topic,
    int Solved,
    decimal SuccessRate,
    int StudentCount,
    int StrugglingStudentCount);

public sealed record ClassInsightDto(
    string ClassName,
    int StudentCount,
    int ActiveStudentCount,
    int Solved,
    decimal SuccessRate,
    IReadOnlyList<ClassStudentInsightDto> Students,
    IReadOnlyList<ClassTopicInsightDto> Topics,
    int MinSample);

public sealed record InsightClassSummaryDto(string ClassName, int StudentCount);

public sealed record InsightOverviewDto(
    IReadOnlyList<InsightClassSummaryDto> Classes,
    bool AiEnabled,
    string? AiModel,
    IReadOnlyList<string> Sources);
