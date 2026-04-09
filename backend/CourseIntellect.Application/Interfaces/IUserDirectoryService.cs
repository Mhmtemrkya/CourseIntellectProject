using CourseIntellect.Application.DTOs.Common;
using CourseIntellect.Application.DTOs.Users;

namespace CourseIntellect.Application.Interfaces;

public interface IUserDirectoryService
{
    Task<IReadOnlyList<UserSummaryDto>> GetUsersAsync(CancellationToken cancellationToken = default);
    Task<PagedResult<AdminUserListItemDto>> GetUsersPagedAsync(int page, int pageSize, CancellationToken cancellationToken = default);
    Task<AdminUserListItemDto> CreateUserAsync(AdminCreateUserRequest request, CancellationToken cancellationToken = default);
    Task<AdminUserListItemDto?> UpdateUserAsync(Guid id, AdminUpdateUserRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteUserAsync(Guid id, CancellationToken cancellationToken = default);
    Task<PagedResult<RegistrationListItemDto>> GetRegistrationsAsync(int page, int pageSize, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<RoleSummaryDto>> GetRolesAsync(CancellationToken cancellationToken = default);
    Task UpdateRolePolicyAsync(string roleName, RolePolicyUpdateRequest request, CancellationToken cancellationToken = default);
    Task UpdateUserStatusAsync(string username, UserStatusUpdateRequest request, CancellationToken cancellationToken = default);
    Task AssignPrimaryRoleAsync(string username, UserRoleAssignmentRequest request, CancellationToken cancellationToken = default);
    Task AddExtraRoleAsync(string username, UserExtraRoleRequest request, CancellationToken cancellationToken = default);
    Task<bool> UndoLastRoleAssignmentAsync(string username, CancellationToken cancellationToken = default);
}
