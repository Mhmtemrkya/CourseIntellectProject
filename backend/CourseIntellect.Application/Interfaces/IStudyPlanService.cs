using CourseIntellect.Application.DTOs.StudyPlans;

namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Çalışma programı ve XP. Plan sahibinin KULLANICI KİMLİĞİYLE bulunur; ad yalnız gösterim içindir
/// (eskiden adla tutuluyordu ve aynı kurumdaki aynı adlı iki öğrenci aynı planı paylaşıyordu).
/// </summary>
public interface IStudyPlanService
{
    Task<StudyPlanStateDto> GetOrCreateAsync(Guid studentUserId, string displayName, CancellationToken cancellationToken = default);

    /// <summary>
    /// Yalnız program maddelerini yazar; XP/seri/son tamamlanma öğrenciye aittir
    /// ve korunur (öğrenci kendi programını ya da rehber/öğretmen düzenlerken kullanılır).
    /// </summary>
    Task<StudyPlanStateDto> UpdatePlanItemsAsync(Guid studentUserId, string displayName, string planItemsSerialized, CancellationToken cancellationToken = default);
    Task<StudyPlanStateDto> AddXpAsync(Guid studentUserId, string displayName, int amount, CancellationToken cancellationToken = default);
    Task<StudyPlanStateDto> AddItemAsync(Guid studentUserId, string displayName, StudyPlanItemRequest request, CancellationToken cancellationToken = default);
    Task<StudyPlanStateDto> SetItemDoneAsync(Guid studentUserId, string displayName, string itemId, bool done, CancellationToken cancellationToken = default);
    Task<StudyPlanStateDto> DeleteItemAsync(Guid studentUserId, string displayName, string itemId, CancellationToken cancellationToken = default);
}
