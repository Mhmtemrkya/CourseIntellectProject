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
            Status = "PendingAcceptance",
            CreatedByUserId = actorUserId,
            CreatedByName = string.IsNullOrWhiteSpace(actorName) ? "Bilinmiyor" : actorName.Trim(),
            DueDateUtc = request.DueDate.HasValue ? DateTime.SpecifyKind(request.DueDate.Value, DateTimeKind.Utc) : null,
            StartDateUtc = request.StartDate.HasValue ? DateTime.SpecifyKind(request.StartDate.Value, DateTimeKind.Utc) : null,
            EndDateUtc = request.EndDate.HasValue ? DateTime.SpecifyKind(request.EndDate.Value, DateTimeKind.Utc) : null,
            ResponseStatus = "Pending",
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

    public async Task<IReadOnlyList<AdminTaskDto>> GetMineAsync(
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var normalizedName = (actorName ?? string.Empty).Trim();
        var query = dbContext.AdminTasks.AsNoTracking().AsQueryable();
        if (actorUserId.HasValue)
        {
            query = query.Where(item => item.AssignedToUserId == actorUserId.Value
                || (!string.IsNullOrWhiteSpace(normalizedName) && item.AssignedToName == normalizedName));
        }
        else if (!string.IsNullOrWhiteSpace(normalizedName))
        {
            query = query.Where(item => item.AssignedToName == normalizedName);
        }
        else
        {
            return [];
        }

        return await query
            .OrderBy(item => item.Status == "Done" || item.Status == "Rejected")
            .ThenBy(item => item.StartDateUtc ?? item.DueDateUtc ?? item.CreatedAtUtc)
            .Select(item => Map(item))
            .ToListAsync(cancellationToken);
    }

    public async Task<AdminTaskDto?> UpdateStatusAsync(
        Guid id,
        TaskStatusRequest request,
        Guid? actorUserId,
        string actorName,
        bool canManageAllTasks,
        CancellationToken cancellationToken = default)
    {
        var task = await dbContext.AdminTasks.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (task is null) return null;

        var requestedStatus = request.Status.Trim();
        var normalizedActorName = string.IsNullOrWhiteSpace(actorName) ? "Bilinmiyor" : actorName.Trim();
        if (!canManageAllTasks)
        {
            var isAssignedUser = actorUserId.HasValue && task.AssignedToUserId == actorUserId.Value;
            var isAssignedByName = !string.IsNullOrWhiteSpace(normalizedActorName)
                && string.Equals(task.AssignedToName, normalizedActorName, StringComparison.OrdinalIgnoreCase);
            if (!isAssignedUser && !isAssignedByName)
            {
                throw new UnauthorizedAccessException("Bu görev size atanmamış.");
            }

            if (requestedStatus is not ("Accepted" or "Kabul" or "Kabul Edildi"
                or "Rejected" or "Reject" or "Reddedildi" or "Kabul Edilmedi"
                or "InProgress" or "Devam" or "Done" or "Tamamlandı"))
            {
                throw new UnauthorizedAccessException("Bu görev durumu için yetkiniz yok.");
            }
            if (task.ResponseStatus == "Pending"
                && requestedStatus is not ("Accepted" or "Kabul" or "Kabul Edildi"
                    or "Rejected" or "Reject" or "Reddedildi" or "Kabul Edilmedi"))
            {
                throw new InvalidOperationException("Göreve başlamadan önce kabul veya red yanıtı verilmelidir.");
            }
        }

        task.Status = requestedStatus switch
        {
            "Open" or "Açık" => "Open",
            "PendingAcceptance" or "Beklemede" => "PendingAcceptance",
            "Accepted" or "Kabul" or "Kabul Edildi" => "Accepted",
            "Rejected" or "Reject" or "Reddedildi" or "Kabul Edilmedi" => "Rejected",
            "InProgress" or "Devam" => "InProgress",
            "Done" or "Tamamlandı" => "Done",
            "Cancelled" or "İptal" => "Cancelled",
            _ => task.Status,
        };
        if (task.Status == "Accepted")
        {
            task.ResponseStatus = "Accepted";
            task.RejectionReason = string.Empty;
            task.RespondedAtUtc = DateTime.UtcNow;
        }
        else if (task.Status == "Rejected")
        {
            task.ResponseStatus = "Rejected";
            task.RejectionReason = request.Reason?.Trim() ?? string.Empty;
            task.RespondedAtUtc = DateTime.UtcNow;

            await dbContext.Notifications.AddAsync(new NotificationItem
            {
                Title = "Görev kabul edilmedi",
                Message = $"{task.AssignedToName} “{task.Title}” görevini kabul etmedi."
                    + (string.IsNullOrWhiteSpace(task.RejectionReason) ? string.Empty : $" Mazeret: {task.RejectionReason}"),
                TimeLabel = DateTime.UtcNow.ToString("dd.MM.yyyy HH:mm"),
                Audience = task.CreatedByName,
                TargetRole = "Admin",
                Category = "Görev Merkezi",
                IsRead = false,
            }, cancellationToken);
        }
        task.CompletedAtUtc = task.Status == "Done" ? DateTime.UtcNow : null;
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(actorUserId, normalizedActorName, $"Görev {task.Status}",
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
        item.StartDateUtc,
        item.EndDateUtc,
        item.ResponseStatus,
        item.RejectionReason,
        item.RespondedAtUtc,
        item.CreatedAtUtc,
        item.CompletedAtUtc);
}
