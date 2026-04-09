using CourseIntellect.Application.DTOs.Homework;

namespace CourseIntellect.Application.Interfaces;

public interface IHomeworkService
{
    Task<IReadOnlyList<HomeworkAssignmentDto>> GetAssignmentsAsync(CancellationToken cancellationToken = default);
    Task<HomeworkAssignmentDto> CreateAssignmentAsync(CreateHomeworkAssignmentRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAssignmentAsync(Guid id, CancellationToken cancellationToken = default);
    Task<HomeworkAssignmentDto?> SubmitAssignmentAsync(Guid id, CreateHomeworkSubmissionRequest request, CancellationToken cancellationToken = default);
}
