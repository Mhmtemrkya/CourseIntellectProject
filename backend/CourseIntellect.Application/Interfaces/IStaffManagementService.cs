using CourseIntellect.Application.DTOs.Staff;

namespace CourseIntellect.Application.Interfaces;

public interface IStaffManagementService
{
    Task<IReadOnlyList<StaffSummaryDto>> GetStaffAsync(string? role, CancellationToken cancellationToken = default);
    Task<StaffCredentialsDto> CreateStaffAsync(CreateStaffRequest request, CancellationToken cancellationToken = default);
    Task<StaffCredentialsDto> CreateAccountingStaffAsync(CreateAccountingStaffRequest request, CancellationToken cancellationToken = default);
    Task<StaffSummaryDto> UpdateStaffAsync(Guid staffId, UpdateStaffRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteStaffByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Var olan kullanıcının rol/şube/özel rol atamasını günceller ve ev grant'ını yeniler.</summary>
    Task<bool> UpdateAssignmentAsync(Guid userId, UpdateStaffAssignmentRequest request, CancellationToken cancellationToken = default);
}
