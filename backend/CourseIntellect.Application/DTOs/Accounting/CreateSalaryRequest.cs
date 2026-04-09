namespace CourseIntellect.Application.DTOs.Accounting;

public sealed record CreateSalaryRequest(string Employee, string Role, string Amount, string PayDate, string Reason);
