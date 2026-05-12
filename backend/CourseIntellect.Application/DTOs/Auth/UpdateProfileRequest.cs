namespace CourseIntellect.Application.DTOs.Auth;

public sealed record UpdateProfileRequest(
    string FullName,
    string Campus,
    string DepartmentOrBranch
);
