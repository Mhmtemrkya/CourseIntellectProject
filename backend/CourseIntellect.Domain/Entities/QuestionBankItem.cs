namespace CourseIntellect.Domain.Entities;

public sealed class QuestionBankItem : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
    public string Difficulty { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string QuestionText { get; set; } = string.Empty;
    public string Teacher { get; set; } = string.Empty;
    public string CreatedAtLabel { get; set; } = string.Empty;
    public int UsageCount { get; set; }
    public string? ImagePath { get; set; }
    public string ImagePlacement { get; set; } = "Top";
    public string OptionsSerialized { get; set; } = "[]";
    public int? CorrectOptionIndex { get; set; }
    public string ClassTargetsSerialized { get; set; } = "[\"Tum Siniflar\"]";
    public string? SolutionAssetPath { get; set; }
    public string? SolutionAssetType { get; set; }
    public bool RevealCorrectAnswerToStudent { get; set; }
    public string? ExpectedAnswer { get; set; }
}
