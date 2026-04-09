namespace CourseIntellect.Application.DTOs.Staff;

public sealed record CreateAccountingStaffRequest(
    string FullName,
    string TcNo,
    string Phone,
    string Email,
    string Education,
    string StartDate,
    string Campus,
    string MaritalStatus,
    int ChildCount,
    string Note
);
