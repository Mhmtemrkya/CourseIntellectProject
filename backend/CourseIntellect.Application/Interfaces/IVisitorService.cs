using CourseIntellect.Application.DTOs.Visitors;

namespace CourseIntellect.Application.Interfaces;

/// <summary>
/// Ziyaretçi takibi (danışma/sekreterlik). Bulunamazsa KeyNotFoundException,
/// kural ihlalinde InvalidOperationException, geçersiz girdide ArgumentException.
/// </summary>
public interface IVisitorService
{
    Task<VisitorListDto> ListAsync(DateTime? fromUtc, DateTime? toUtc, string? search, string? status, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<VisitorHostOptionDto>> GetHostsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<VisitorStudentOptionDto>> SearchStudentsAsync(string? search, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<VisitorLookupDto>> LookupAsync(string? query, CancellationToken cancellationToken = default);
    Task<VisitorDto> CheckInAsync(CheckInVisitorRequest request, Guid? actorUserId, string actorName, CancellationToken cancellationToken = default);
    Task<VisitorDto> CheckOutAsync(Guid id, Guid? actorUserId, CancellationToken cancellationToken = default);
    Task<VisitorDto> UpdateAsync(Guid id, UpdateVisitorRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
    /// <summary>Saklama süresi dolan kayıtları siler; silinen sayıyı döndürür.</summary>
    Task<int> PurgeExpiredAsync(DateTime nowUtc, CancellationToken cancellationToken = default);
}
