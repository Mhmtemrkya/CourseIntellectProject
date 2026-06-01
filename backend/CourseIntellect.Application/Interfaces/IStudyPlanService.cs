using CourseIntellect.Application.DTOs.StudyPlans;

namespace CourseIntellect.Application.Interfaces;

public interface IStudyPlanService
{
    Task<StudyPlanStateDto> GetOrCreateAsync(string studentName, CancellationToken cancellationToken = default);
    Task<StudyPlanStateDto> UpdateAsync(UpdateStudyPlanStateRequest request, CancellationToken cancellationToken = default);
    Task<StudyPlanStateDto> AddXpAsync(string studentName, int amount, CancellationToken cancellationToken = default);
    Task<StudyPlanStateDto> AddItemAsync(string studentName, StudyPlanItemRequest request, CancellationToken cancellationToken = default);
    Task<StudyPlanStateDto> SetItemDoneAsync(string studentName, string itemId, bool done, CancellationToken cancellationToken = default);
    Task<StudyPlanStateDto> DeleteItemAsync(string studentName, string itemId, CancellationToken cancellationToken = default);
}
