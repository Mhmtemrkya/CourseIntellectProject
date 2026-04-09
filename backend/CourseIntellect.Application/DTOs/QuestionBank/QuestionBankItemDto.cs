namespace CourseIntellect.Application.DTOs.QuestionBank;

public sealed record QuestionBankItemDto(
    Guid Id,
    string Subject,
    string Topic,
    string Difficulty,
    string Type,
    string QuestionText,
    string Teacher,
    string CreatedAt,
    int UsageCount,
    string? ImagePath,
    string ImagePlacement,
    IReadOnlyList<string> Options,
    int? CorrectOptionIndex,
    IReadOnlyList<string> ClassTargets,
    string? SolutionAssetPath,
    string? SolutionAssetType,
    bool RevealCorrectAnswerToStudent,
    string? ExpectedAnswer);
