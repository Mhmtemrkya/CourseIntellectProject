namespace CourseIntellect.Application.DTOs.Insights;

/// <summary>
/// Konu bazlı başarı. Diagnosis: misconception (yanlışlar ağırlıkta), skipping (boş bırakma),
/// declining (son çalışmalarda düşüş), improving (zayıf ama toparlanıyor), class_wide (sınıfın
/// genelinde zorlanılan konu), stale (uzun süredir çalışılmamış); zayıf olmayan konuda null.
/// Trend: up, down, flat, unknown. Oranlar 0-100 arası yüzdedir.
/// Priority: zayıf konular arasında çalışma sırası (1 = önce); SuggestedQuestions: bu hafta için
/// önerilen soru sayısı; LastPracticedAtUtc: konuda son cevap. Üçü de zayıf olmayan konuda null.
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
    string? Diagnosis,
    int? Priority = null,
    int? SuggestedQuestions = null,
    DateTime? LastPracticedAtUtc = null);

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

/// <summary>
/// Daha önce gösterilen bir önerinin sonucu. Status: pending (henüz yeterli yeni cevap yok),
/// improved / steady / declined (sonraki başarı öncekine göre), not_practiced (28 günde konu çalışılmadı).
/// Sonuç öneriye bağlanmaz; yalnız "o konuda sonrasında ne oldu" gösterilir.
/// </summary>
public sealed record RecommendationFollowupDto(
    string Subject,
    string Topic,
    string Diagnosis,
    DateTime IssuedAtUtc,
    decimal BaselineSuccessRate,
    int AfterSolved,
    decimal? AfterSuccessRate,
    string Status);

/// <summary>Sınıftaki öneri sonuçlarının sayımı (son 8 hafta).</summary>
public sealed record FollowupSummaryDto(int Improved, int Steady, int Declined, int Pending, int NotPracticed);

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
    int MinSample,
    IReadOnlyList<RecommendationFollowupDto>? Followups = null);

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

/// <summary>
/// Öğretmene sınıf düzeyinde öneri. Kind: class_review (sınıfın önemli bir kısmı zorlanıyor →
/// derste tekrar) ya da study_group (birkaç öğrenci zorlanıyor → etüt grubu; adlar yalnız personele).
/// StudentCount: konuda soru çözen öğrenci sayısı; SuggestedQuestions: tekrar/etüt için soru sayısı.
/// </summary>
public sealed record ClassActionDto(
    string Kind,
    string Subject,
    string Topic,
    int StrugglingStudentCount,
    int StudentCount,
    decimal SuccessRate,
    IReadOnlyList<string> StudentNames,
    int SuggestedQuestions);

public sealed record ClassInsightDto(
    string ClassName,
    int StudentCount,
    int ActiveStudentCount,
    int Solved,
    decimal SuccessRate,
    IReadOnlyList<ClassStudentInsightDto> Students,
    IReadOnlyList<ClassTopicInsightDto> Topics,
    int MinSample,
    IReadOnlyList<ClassActionDto>? Actions = null,
    FollowupSummaryDto? Followups = null);

public sealed record InsightClassSummaryDto(string ClassName, int StudentCount);

public sealed record InsightOverviewDto(
    IReadOnlyList<InsightClassSummaryDto> Classes,
    bool AiEnabled,
    string? AiModel,
    IReadOnlyList<string> Sources);
