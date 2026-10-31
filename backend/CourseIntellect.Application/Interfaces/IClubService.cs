using CourseIntellect.Application.DTOs.Clubs;

namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Öğrenci kulüpleri. Yetki kuralları burada uygulanır (yönetici = kulüp açar,
/// danışman öğretmen = üye/etkinlik yönetir, öğrenci = katılma isteği, veli =
/// çocuğunun kulüpleri). Bulunamazsa KeyNotFoundException, yetkisizse
/// UnauthorizedAccessException, kural ihlalinde InvalidOperationException,
/// geçersiz girdide ArgumentException.
/// </summary>
public interface IClubService
{
    Task<ClubOverviewDto> GetOverviewAsync(ClubViewer viewer, string? academicYear, CancellationToken cancellationToken = default);
    Task<ClubDetailDto> GetDetailAsync(ClubViewer viewer, Guid clubId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ClubSummaryDto>> GetMineAsync(ClubViewer viewer, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ClubActivityDto>> GetUpcomingActivitiesAsync(ClubViewer viewer, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ClubPersonOptionDto>> GetTeacherOptionsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ClubPersonOptionDto>> SearchStudentsAsync(ClubViewer viewer, Guid clubId, string? search, CancellationToken cancellationToken = default);

    Task<ClubSummaryDto> CreateAsync(ClubViewer viewer, SaveClubRequest request, CancellationToken cancellationToken = default);
    Task<ClubSummaryDto> UpdateAsync(ClubViewer viewer, Guid clubId, SaveClubRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(ClubViewer viewer, Guid clubId, CancellationToken cancellationToken = default);

    Task<ClubMemberDto> AddMemberAsync(ClubViewer viewer, Guid clubId, AddClubMemberRequest request, CancellationToken cancellationToken = default);
    Task<ClubMemberDto?> UpdateMemberAsync(ClubViewer viewer, Guid clubId, Guid memberId, UpdateClubMemberRequest request, CancellationToken cancellationToken = default);
    Task<ClubMemberDto> RequestJoinAsync(ClubViewer viewer, Guid clubId, JoinClubRequest request, CancellationToken cancellationToken = default);
    Task LeaveAsync(ClubViewer viewer, Guid clubId, CancellationToken cancellationToken = default);

    Task<ClubActivityDto> SaveActivityAsync(ClubViewer viewer, Guid clubId, Guid? activityId, SaveClubActivityRequest request, CancellationToken cancellationToken = default);
    Task DeleteActivityAsync(ClubViewer viewer, Guid clubId, Guid activityId, CancellationToken cancellationToken = default);
}
