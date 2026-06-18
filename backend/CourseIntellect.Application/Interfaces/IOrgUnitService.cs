using CourseIntellect.Application.DTOs.Admin;

namespace CourseIntellect.Application.Interfaces;

public interface IOrgUnitService
{
    Task<IReadOnlyList<OrgUnitDto>> GetAsync(CancellationToken cancellationToken = default);

    Task<OrgUnitDto> CreateAsync(
        CreateOrgUnitRequest request,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default);

    Task<OrgUnitDto?> UpdateAsync(
        Guid id,
        UpdateOrgUnitRequest request,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
