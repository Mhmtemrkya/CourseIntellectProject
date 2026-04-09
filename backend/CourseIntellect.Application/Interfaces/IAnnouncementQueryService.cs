using CourseIntellect.Application.DTOs.Announcements;

namespace CourseIntellect.Application.Interfaces;

public interface IAnnouncementQueryService
{
    Task<IReadOnlyList<AnnouncementDto>> GetAnnouncementsAsync(string? audience, CancellationToken cancellationToken = default);
    Task<AnnouncementDto> CreateAnnouncementAsync(CreateAnnouncementRequest request, CancellationToken cancellationToken = default);
}
