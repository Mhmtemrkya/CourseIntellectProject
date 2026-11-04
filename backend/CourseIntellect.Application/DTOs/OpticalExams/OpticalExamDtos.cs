namespace CourseIntellect.Application.DTOs.OpticalExams;

/// <summary>Kolonlar 1'den başlar.</summary>
public sealed record OpticalSubjectBlockDto(string Name, int Start, int Count);

public sealed record OpticalTemplateDto(
    Guid Id,
    string Name,
    string Encoding,
    int StudentNoStart,
    int StudentNoLength,
    int NameStart,
    int NameLength,
    int ClassStart,
    int ClassLength,
    int BookletStart,
    int BookletLength,
    IReadOnlyList<OpticalSubjectBlockDto> Subjects,
    int LineLength);

public sealed record SaveOpticalTemplateRequest(
    string Name,
    string Encoding,
    int StudentNoStart,
    int StudentNoLength,
    int NameStart,
    int NameLength,
    int ClassStart,
    int ClassLength,
    int BookletStart,
    int BookletLength,
    IReadOnlyList<OpticalSubjectBlockDto> Subjects);

/// <summary>Bir kitapçıktaki bir dersin cevap anahtarı ve soru başına konu (sıra = soru no).</summary>
public sealed record OpticalAnswerKeySubjectDto(string Subject, string Answers, IReadOnlyList<string> Topics);

public sealed record OpticalAnswerKeyDto(string Booklet, IReadOnlyList<OpticalAnswerKeySubjectDto> Subjects);

public sealed record OpticalExamSummaryDto(
    Guid Id,
    string Title,
    DateTime ExamDateUtc,
    Guid TemplateId,
    string TemplateName,
    string Status,
    int ImportedStudentCount,
    DateTime? ImportedAtUtc,
    int QuestionCount,
    int TopicCoverage,
    string Level = "");

public sealed record OpticalExamDto(
    Guid Id,
    string Title,
    DateTime ExamDateUtc,
    Guid TemplateId,
    int WrongPenalty,
    bool MultiMarkAsWrong,
    string CancelledMode,
    IReadOnlyList<OpticalAnswerKeyDto> Keys,
    string Status,
    string FileName,
    int ImportedStudentCount,
    DateTime? ImportedAtUtc,
    string Level = "");

public sealed record SaveOpticalExamRequest(
    string Title,
    DateTime ExamDateUtc,
    Guid TemplateId,
    int WrongPenalty,
    bool MultiMarkAsWrong,
    string CancelledMode,
    IReadOnlyList<OpticalAnswerKeyDto> Keys,
    string? Level = null);

public sealed record OpticalSubjectScoreDto(string Subject, int Correct, int Wrong, int Blank, decimal Net);

public sealed record OpticalStudentCandidateDto(Guid StudentUserId, string FullName, string ClassName, string SchoolNumber);

/// <summary>MatchStatus: matched (okul no ya da tam ad), ambiguous (birden çok aday), unmatched.</summary>
public sealed record OpticalPreviewRowDto(
    int Line,
    string StudentNo,
    string Name,
    string ClassName,
    string Booklet,
    string MatchStatus,
    string? MatchedBy,
    Guid? StudentUserId,
    string? StudentName,
    IReadOnlyList<OpticalStudentCandidateDto> Candidates,
    IReadOnlyList<OpticalSubjectScoreDto> Scores,
    IReadOnlyList<string> Warnings);

public sealed record OpticalPreviewDto(
    string Encoding,
    IReadOnlyList<string> SampleLines,
    int RowCount,
    int MatchedCount,
    int AmbiguousCount,
    int UnmatchedCount,
    IReadOnlyList<OpticalPreviewRowDto> Rows,
    IReadOnlyList<string> Errors);

/// <summary>Önizlemedeki satır için öğretmenin seçimi; StudentUserId null ise satır atlanır.</summary>
public sealed record OpticalMatchOverrideDto(int Line, Guid? StudentUserId);

public sealed record OpticalImportResultDto(int ImportedStudents, int SkippedRows, int AnswerCount, int TopicAnswerCount);

/// <summary>Bir denemenin öğrenci sonuçları (sınıf/öğretmen görünümü).</summary>
public sealed record OpticalExamResultRowDto(
    Guid StudentUserId,
    string FullName,
    string ClassName,
    string Booklet,
    decimal TotalNet,
    IReadOnlyList<OpticalSubjectScoreDto> Scores);

public sealed record OpticalExamResultsDto(
    Guid ExamId,
    string Title,
    IReadOnlyList<string> Subjects,
    IReadOnlyList<OpticalExamResultRowDto> Rows,
    IReadOnlyList<OpticalSubjectScoreDto> Averages);

/// <summary>Dosyadan şablon önerisi: tek alan. Confidence: high | medium | low | none (algılanamadı).</summary>
public sealed record OpticalSuggestedFieldDto(string Key, string Label, int Start, int Length, string Confidence, string Reason);

/// <summary>Rakamdan oluşan aday alan; öğrenci numarası mı kurum/sınav kodu mu görünüşten kesinleşmez.</summary>
public sealed record OpticalNumberCandidateDto(string Id, int Start, int Length, int DistinctValues, bool Constant, bool LeadingZeros, string Note);

/// <summary>Cevap bloğu; ders adı ve soru dağılımı dosyada yoksa uydurulmaz ("Cevap bloğu 1").</summary>
public sealed record OpticalAnswerBlockDto(string Label, int Start, int Count, string Confidence, string Reason, bool CountNeedsConfirmation);

/// <summary>Kind: header | answer-key | length | other.</summary>
public sealed record OpticalFlaggedLineDto(int Line, string Kind, string Reason);

/// <summary>
/// Şablon önerisi. Hiçbir şey kaydetmez. AiStatus: used | not-needed | disabled | unavailable | timeout | invalid.
/// Supported=false ise (ör. ayraçlı dosya) Message nedenini söyler ve elle giriş önerilir.
/// </summary>
public sealed record OpticalTemplateSuggestionDto(
    bool Supported,
    string Message,
    string Encoding,
    string Format,
    int TotalLines,
    int SampledLines,
    int TypicalLineLength,
    int MinLineLength,
    int MaxLineLength,
    IReadOnlyList<OpticalSuggestedFieldDto> Fields,
    IReadOnlyList<OpticalNumberCandidateDto> NumberCandidates,
    IReadOnlyList<OpticalAnswerBlockDto> AnswerBlocks,
    IReadOnlyList<string> Booklets,
    IReadOnlyList<OpticalFlaggedLineDto> FlaggedLines,
    IReadOnlyList<string> Warnings,
    IReadOnlyList<string> Confirmations,
    string AiStatus,
    IReadOnlyList<string> AiNotes,
    bool ManualRecommended);

// ── Soru konusu listesi ──────────────────────────────────────────────────────

public sealed record OpticalTopicLevelDto(string Key, string Label);

/// <summary>Bir başlık (ünite / tema / alt test) altındaki hazır konular.</summary>
public sealed record OpticalTopicGroupDto(string Label, IReadOnlyList<string> Topics);

public sealed record OpticalCustomTopicDto(Guid Id, string Subject, string Level, string Name);

/// <summary>
/// Bir dersin seçilebilir konuları: hazır liste (Groups), kurumun eklediği konular (Custom) ve kurumun
/// denemelerinde daha önce yazılmış ama ikisinde de olmayan konular (Used; eski serbest kayıtlar).
/// </summary>
public sealed record OpticalSubjectTopicsDto(
    string Subject,
    IReadOnlyList<OpticalTopicGroupDto> Groups,
    IReadOnlyList<OpticalCustomTopicDto> Custom,
    IReadOnlyList<string> Used);

public sealed record OpticalTopicCatalogDto(
    string Level,
    IReadOnlyList<OpticalTopicLevelDto> Levels,
    IReadOnlyList<OpticalSubjectTopicsDto> Subjects);

public sealed record AddOpticalTopicRequest(string Subject, string? Level, string Name);

/// <summary>Status: created (listeye eklendi), exists-builtin (hazır listede zaten var), exists-custom (kurum listesinde zaten var).</summary>
public sealed record AddOpticalTopicResultDto(string Status, string Name, OpticalCustomTopicDto? Topic);

// ── Deneme sonrası çalışma planı ─────────────────────────────────────────────

/// <summary>Öğrencinin bu denemede zorlandığı konu (yanlış + boş sayısına göre).</summary>
public sealed record OpticalPlanTopicDto(string Subject, string Topic, int Correct, int Wrong, int Blank, int Total);

/// <summary>Plan görevi; Date yyyy-MM-dd (İstanbul günü).</summary>
public sealed record OpticalPlanTaskDto(string Title, string Subject, string Topic, string Date, int DurationMinutes);

/// <summary>SkipReason doluysa plan yazılamaz (ör. aynı adlı iki öğrenci, zayıf konu yok).</summary>
public sealed record OpticalStudyPlanRowDto(
    Guid StudentUserId,
    string StudentName,
    string ClassName,
    decimal Net,
    IReadOnlyList<OpticalPlanTopicDto> WeakTopics,
    IReadOnlyList<OpticalPlanTaskDto> Tasks,
    string ParentSummary,
    bool HasParent,
    string? SkipReason,
    bool AlreadyApplied);

/// <summary>Önizleme hiçbir şey yazmaz. StudyPlanEnabled=false ise öğrenciler planı göremez (paket).</summary>
public sealed record OpticalStudyPlanPreviewDto(
    Guid ExamId,
    string ExamTitle,
    bool HasTopics,
    bool StudyPlanEnabled,
    IReadOnlyList<OpticalStudyPlanRowDto> Students,
    string? Message);

public sealed record OpticalStudyPlanApplyItem(Guid StudentUserId, IReadOnlyList<OpticalPlanTaskDto> Tasks, bool SendParentSummary, string? ParentSummary);

public sealed record ApplyOpticalStudyPlansRequest(IReadOnlyList<OpticalStudyPlanApplyItem> Students);

public sealed record OpticalStudyPlanApplyResultDto(int Applied, int TasksWritten, int ParentsNotified, IReadOnlyList<string> Skipped);
