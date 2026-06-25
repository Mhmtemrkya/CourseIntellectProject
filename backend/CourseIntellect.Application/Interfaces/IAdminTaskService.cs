using CourseIntellect.Application.DTOs.Admin;

namespace CourseIntellect.Application.Interfaces;

public interface IAdminTaskService
{
    Task<AdminTaskDto> CreateAsync(
        CreateTaskRequest request,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AdminTaskDto>> GetAsync(
        string? status,
        string? assignee,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AdminTaskDto>> GetMineAsync(
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default);

    Task<AdminTaskDto?> UpdateStatusAsync(
        Guid id,
        TaskStatusRequest request,
        Guid? actorUserId,
        string actorName,
        bool canManageAllTasks,
        CancellationToken cancellationToken = default);
}
