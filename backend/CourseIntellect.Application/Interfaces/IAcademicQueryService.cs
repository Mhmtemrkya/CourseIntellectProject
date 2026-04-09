using CourseIntellect.Application.DTOs.ExamResults;
using CourseIntellect.Application.DTOs.Students;

namespace CourseIntellect.Application.Interfaces;

public interface IAcademicQueryService
{
    Task<IReadOnlyList<StudentSummaryDto>> GetStudentsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ExamResultDto>> GetExamResultsAsync(string? studentName, string? className, CancellationToken cancellationToken = default);
    Task<ExamResultDto> CreateExamResultAsync(CreateExamResultRequest request, CancellationToken cancellationToken = default);
    Task<StudentCredentialsDto> CreateStudentAsync(CreateStudentRequest request, CancellationToken cancellationToken = default);
}
