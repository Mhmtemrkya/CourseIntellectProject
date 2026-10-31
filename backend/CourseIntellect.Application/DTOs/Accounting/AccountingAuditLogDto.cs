namespace CourseIntellect.Application.DTOs.Accounting;

public sealed record AccountingAuditLogDto(string Id, string Title, string Detail, string Time, DateTime? CreatedAtUtc = null, string? ActorName = null);
