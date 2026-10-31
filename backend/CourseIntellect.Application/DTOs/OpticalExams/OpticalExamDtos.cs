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
    int TopicCoverage);

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
    DateTime? ImportedAtUtc);

public sealed record SaveOpticalExamRequest(
    string Title,
    DateTime ExamDateUtc,
    Guid TemplateId,
    int WrongPenalty,
    bool MultiMarkAsWrong,
    string CancelledMode,
    IReadOnlyList<OpticalAnswerKeyDto> Keys);

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
