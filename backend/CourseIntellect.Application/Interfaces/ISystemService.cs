using CourseIntellect.Application.DTOs.System;

namespace CourseIntellect.Application.Interfaces;

public interface ISystemService
{
    Task<SystemStatusDto> GetStatusAsync(CancellationToken cancellationToken = default);
    Task<SystemStatusDto> SetMaintenanceAsync(UpdateMaintenanceRequest request, CancellationToken cancellationToken = default);
    Task<bool> IsMaintenanceActiveAsync(CancellationToken cancellationToken = default);
}
