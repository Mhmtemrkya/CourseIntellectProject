namespace CourseIntellect.Application.DTOs.Accounting;

public sealed record CreateInstallmentRequest(string Student, string Amount, string Due, string Note);
