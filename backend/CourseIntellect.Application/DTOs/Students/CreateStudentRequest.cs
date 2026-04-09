namespace CourseIntellect.Application.DTOs.Students;

public sealed record CreateStudentRequest(
    string FullName,
    string TcNo,
    string ClassName,
    string CurrentSchool,
    string SchoolNumber,
    string BirthDate,
    string ProgramType,
    string ParentName,
    string ParentPhone,
    string ParentEmail,
    string Address,
    string Note
);
