using CourseIntellect.Application.DTOs.ExamResults;
using CourseIntellect.Application.DTOs.Parents;
using CourseIntellect.Application.DTOs.Students;

namespace CourseIntellect.Application.Interfaces;

public interface IAcademicQueryService
{
    Task<IReadOnlyList<StudentSummaryDto>> GetStudentsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ExamResultDto>> GetExamResultsAsync(string? studentName, string? className, CancellationToken cancellationToken = default);
    Task<ExamResultDto> CreateExamResultAsync(CreateExamResultRequest request, CancellationToken cancellationToken = default);
    Task<StudentCredentialsDto> CreateStudentAsync(CreateStudentRequest request, CancellationToken cancellationToken = default);
    Task<StudentSummaryDto?> UpdateStudentAsync(Guid studentId, UpdateStudentRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteStudentAsync(Guid studentId, CancellationToken cancellationToken = default);
    Task<ParentCredentialsDto> CreateParentAsync(CreateParentRequest request, CancellationToken cancellationToken = default);
}
