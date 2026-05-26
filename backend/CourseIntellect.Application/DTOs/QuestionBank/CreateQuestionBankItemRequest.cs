namespace CourseIntellect.Application.DTOs.QuestionBank;

public sealed record CreateQuestionBankItemRequest(
    string Subject,
    string Topic,
    string Difficulty,
    string Type,
    string QuestionText,
    string Teacher,
    string? ImagePath,
    string ImagePlacement,
    IReadOnlyList<string>? Options,
    int? CorrectOptionIndex,
    IReadOnlyList<string>? ClassTargets,
    string? SolutionAssetPath,
    string? SolutionAssetType,
    bool RevealCorrectAnswerToStudent,
    string? ExpectedAnswer,
    string? RichTextHtml = null,
    string? SolutionTextHtml = null,
    string? EditorMetadataJson = null,
    string? PublicationStatus = null);
