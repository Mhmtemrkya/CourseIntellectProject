using CourseIntellect.Application.DTOs.Announcements;

namespace CourseIntellect.Application.Interfaces;

public interface IAnnouncementQueryService
{
    Task<IReadOnlyList<AnnouncementDto>> GetAnnouncementsAsync(
        string? audience,
        string? className = null,
        string? teacherName = null,
        CancellationToken cancellationToken = default);

    Task<AnnouncementDto> CreateAnnouncementAsync(CreateAnnouncementRequest request, CancellationToken cancellationToken = default);
}
