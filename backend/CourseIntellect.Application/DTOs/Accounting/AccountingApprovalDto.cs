namespace CourseIntellect.Application.DTOs.Accounting;

public sealed record AccountingApprovalDto(string Id, string Title, string Reason, string Category, string Status, string SourceType, string SourceKey);
