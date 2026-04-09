namespace CourseIntellect.Application.DTOs.Accounting;

public sealed record AccountingInstallmentDto(string Id, string Student, string Status, string Amount, string Due, string Note);
