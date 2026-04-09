namespace CourseIntellect.Application.DTOs.Accounting;

public sealed record AccountingInvoiceDto(string Id, string Title, string Category, string Subtitle, string Amount, string Status);
