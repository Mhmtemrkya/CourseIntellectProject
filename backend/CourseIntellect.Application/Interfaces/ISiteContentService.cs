using CourseIntellect.Application.DTOs.SiteContent;

namespace CourseIntellect.Application.Interfaces;

public interface ISiteContentService
{
    Task<SiteContentDto?> GetPublishedAsync(string sectionKey, string language, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SiteContentDto>> GetHistoryAsync(string sectionKey, string language, CancellationToken cancellationToken = default);
    Task<SiteContentDto> CreateOrUpdateAsync(string sectionKey, UpdateSiteContentRequest request, CancellationToken cancellationToken = default);
    Task<SiteContentDto?> PublishLatestAsync(string sectionKey, string language, CancellationToken cancellationToken = default);
}
