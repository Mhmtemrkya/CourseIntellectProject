namespace CourseIntellect.Application.DTOs.Accounting;

public sealed record UpdateInstallmentRequest(
    string Amount,
    string Due,
    string Status,
    string Note
);
