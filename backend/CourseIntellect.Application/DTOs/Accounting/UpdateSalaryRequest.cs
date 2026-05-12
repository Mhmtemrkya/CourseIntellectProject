namespace CourseIntellect.Application.DTOs.Accounting;

public sealed record UpdateSalaryRequest(string Employee, string Role, string Amount, string PayDate, string Status);
