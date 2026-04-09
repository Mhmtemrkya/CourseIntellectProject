using CourseIntellect.Application.DTOs.Staff;

namespace CourseIntellect.Application.Interfaces;

public interface IStaffManagementService
{
    Task<IReadOnlyList<StaffSummaryDto>> GetStaffAsync(string? role, CancellationToken cancellationToken = default);
    Task<StaffCredentialsDto> CreateStaffAsync(CreateStaffRequest request, CancellationToken cancellationToken = default);
    Task<StaffCredentialsDto> CreateAccountingStaffAsync(CreateAccountingStaffRequest request, CancellationToken cancellationToken = default);
}
