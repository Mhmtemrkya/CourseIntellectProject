namespace CourseIntellect.Application.DTOs.Parents;

public sealed record CreateParentRequest(
    string FullName,
    string Phone,
    string Email
);
