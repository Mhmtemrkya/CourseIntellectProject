namespace CourseIntellect.Application.DTOs.Accounting;

public sealed record CreateInvoiceRequest(string Title, string Category, string Amount, string Date, string Reason);
