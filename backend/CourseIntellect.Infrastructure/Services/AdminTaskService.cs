using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AdminTaskService(
    CourseIntellectDbContext dbContext,
    IAuditLogService auditLogService) : IAdminTaskService
{
    public async Task<AdminTaskDto> CreateAsync(
        CreateTaskRequest request,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var task = new AdminTask
        {
            Title = request.Title.Trim(),
            Description = request.Description?.Trim() ?? string.Empty,
            Category = string.IsNullOrWhiteSpace(request.Category) ? "Genel" : request.Category.Trim(),
            AssignedToUserId = request.AssignedToUserId,
            AssignedToName = request.AssignedToName?.Trim() ?? string.Empty,
            Priority = string.IsNullOrWhiteSpace(request.Priority) ? "Normal" : request.Priority.Trim(),
            Status = "Open",
            CreatedByUserId = actorUserId,
            CreatedByName = string.IsNullOrWhiteSpace(actorName) ? "Bilinmiyor" : actorName.Trim(),
            DueDateUtc = request.DueDate.HasValue ? DateTime.SpecifyKind(request.DueDate.Value, DateTimeKind.Utc) : null,
            CreatedAtUtc = DateTime.UtcNow,
        };
        await dbContext.AdminTasks.AddAsync(task, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(actorUserId, task.CreatedByName, "Görev oluşturuldu",
            "Task", nameof(AdminTask), task.Id.ToString(), task.Title, cancellationToken);

        return Map(task);
    }

    public async Task<IReadOnlyList<AdminTaskDto>> GetAsync(
        string? status,
        string? assignee,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.AdminTasks.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalized = status.Trim();
            query = query.Where(item => item.Status == normalized);
        }

        if (!string.IsNullOrWhiteSpace(assignee))
        {
            var normalized = assignee.Trim();
            query = query.Where(item => item.AssignedToName == normalized);
        }

        return await query
            .OrderBy(item => item.Status == "Done")
            .ThenByDescending(item => item.CreatedAtUtc)
            .Select(item => Map(item))
            .ToListAsync(cancellationToken);
    }

    public async Task<AdminTaskDto?> UpdateStatusAsync(
        Guid id,
        TaskStatusRequest request,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var task = await dbContext.AdminTasks.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (task is null) return null;

        task.Status = request.Status.Trim() switch
        {
            "Open" or "Açık" => "Open",
            "InProgress" or "Devam" => "InProgress",
            "Done" or "Tamamlandı" => "Done",
            "Cancelled" or "İptal" => "Cancelled",
            _ => task.Status,
        };
        task.CompletedAtUtc = task.Status == "Done" ? DateTime.UtcNow : null;
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(actorUserId, actorName, $"Görev {task.Status}",
            "Task", nameof(AdminTask), task.Id.ToString(), task.Title, cancellationToken);

        return Map(task);
    }

    private static AdminTaskDto Map(AdminTask item) => new(
        item.Id,
        item.Title,
        item.Description,
        item.Category,
        item.AssignedToName,
        item.Priority,
        item.Status,
        item.CreatedByName,
        item.DueDateUtc,
        item.CreatedAtUtc,
        item.CompletedAtUtc);
}
