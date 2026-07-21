using CourseIntellect.Application.DTOs.ExamResults;
using CourseIntellect.Application.DTOs.Parents;
using CourseIntellect.Application.DTOs.Students;

namespace CourseIntellect.Application.Interfaces;

public interface IAcademicQueryService
{
    Task<IReadOnlyList<StudentSummaryDto>> GetStudentsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ExamResultDto>> GetExamResultsAsync(string? studentName, string? className, CancellationToken cancellationToken = default);
    Task<ExamResultDto> CreateExamResultAsync(CreateExamResultRequest request, CancellationToken cancellationToken = default);
    // requireTcNo/linkExistingParent/validateParentPhone yalnız okul kayıt akışında açılır;
    // sürücü kursu (yabancı kimlik, acil durum kişisi) varsayılan gevşek davranışı kullanır.
    Task<StudentCredentialsDto> CreateStudentAsync(
        CreateStudentRequest request,
        CancellationToken cancellationToken = default,
        bool requireTcNo = false,
        bool linkExistingParent = false,
        bool validateParentPhone = false);
    Task<StudentSummaryDto?> UpdateStudentAsync(Guid studentId, UpdateStudentRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteStudentAsync(Guid studentId, CancellationToken cancellationToken = default);
    Task<ParentCredentialsDto> CreateParentAsync(CreateParentRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ParentAccountDto>> GetParentAccountsAsync(CancellationToken cancellationToken = default);
}
