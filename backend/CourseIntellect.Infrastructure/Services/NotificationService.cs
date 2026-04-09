using CourseIntellect.Application.DTOs.Notifications;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class NotificationService(CourseIntellectDbContext dbContext) : INotificationService
{
    public async Task<IReadOnlyList<NotificationDto>> GetNotificationsAsync(
        string? targetRole,
        string? audience,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.Notifications.AsQueryable();

        if (!string.IsNullOrWhiteSpace(targetRole))
        {
            query = query.Where(x => x.TargetRole == targetRole);
        }

        if (!string.IsNullOrWhiteSpace(audience))
        {
            query = query.Where(x => x.Audience == audience);
        }

        return await query
            .OrderBy(x => x.IsRead)
            .ThenByDescending(x => x.TimeLabel)
            .Select(x => new NotificationDto(
                x.Id,
                x.Title,
                x.Message,
                x.TimeLabel,
                x.Audience,
                x.TargetRole,
                x.Category,
                x.IsRead))
            .ToListAsync(cancellationToken);
    }

    public async Task<NotificationDto> CreateNotificationAsync(CreateNotificationRequest request, CancellationToken cancellationToken = default)
    {
        var item = new NotificationItem
        {
            Title = request.Title,
            Message = request.Message,
            TimeLabel = request.TimeLabel,
            Audience = request.Audience,
            TargetRole = request.TargetRole,
            Category = request.Category,
            IsRead = false
        };

        await dbContext.Notifications.AddAsync(item, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new NotificationDto(
            item.Id,
            item.Title,
            item.Message,
            item.TimeLabel,
            item.Audience,
            item.TargetRole,
            item.Category,
            item.IsRead);
    }

    public async Task MarkAsReadAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var item = await dbContext.Notifications.SingleOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new InvalidOperationException("Bildirim bulunamadi.");
        item.IsRead = true;
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
