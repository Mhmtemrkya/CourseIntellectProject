using CourseIntellect.Application.DTOs.OpticalExams;

namespace CourseIntellect.Application.Interfaces;

/// <summary>Ders konusu listesi: hazır katalog + kurumun eklediği konular + kurumda daha önce yazılmış konular.</summary>
public interface ITopicCatalogService
{
    Task<OpticalTopicCatalogDto> GetTopicsAsync(string? level, IReadOnlyList<string> subjects, CancellationToken cancellationToken = default);
    Task<AddOpticalTopicResultDto> AddTopicAsync(AddOpticalTopicRequest request, Guid? userId, CancellationToken cancellationToken = default);
    Task DeleteTopicAsync(Guid id, CancellationToken cancellationToken = default);
}
