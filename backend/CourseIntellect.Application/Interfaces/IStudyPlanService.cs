using CourseIntellect.Application.DTOs.StudyPlans;

namespace CourseIntellect.Application.Interfaces;

public interface IStudyPlanService
{
    Task<StudyPlanStateDto> GetOrCreateAsync(string studentName, CancellationToken cancellationToken = default);
    Task<StudyPlanStateDto> UpdateAsync(UpdateStudyPlanStateRequest request, CancellationToken cancellationToken = default);
}
