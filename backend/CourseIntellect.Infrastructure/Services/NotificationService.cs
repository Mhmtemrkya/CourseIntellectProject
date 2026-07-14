using System.Security.Claims;
using CourseIntellect.Application.DTOs.Notifications;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class NotificationService(
    CourseIntellectDbContext dbContext,
    IHttpContextAccessor httpContextAccessor) : INotificationService
{
    public async Task<IReadOnlyList<NotificationDto>> GetNotificationsAsync(
        string? targetRole,
        string? audience,
        CancellationToken cancellationToken = default)
    {
        var currentUserId = CurrentUserId();
        var currentRoles = CurrentRoles();

        // İki kural birden:
        //   • Kişiye özel bildirim YALNIZCA sahibine görünür.
        //   • Rol yayını yalnızca o roldeki kullanıcıya görünür — aksi hâlde öğrenci,
        //     yönetime giden filo/operasyon uyarılarını okurdu.
        // Rolü boş bırakılmış eski yayınlar herkese açıktır (geriye dönük uyum).
        var query = dbContext.Notifications
            .Where(x => x.TargetUserId == currentUserId
                || (x.TargetUserId == null && (x.TargetRole == "" || currentRoles.Contains(x.TargetRole))));

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
            .ThenByDescending(x => x.CreatedAtUtc)
            .Take(300)
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

    private Guid? CurrentUserId()
    {
        var user = httpContextAccessor.HttpContext?.User;
        var raw = user?.FindFirstValue("nameid") ?? user?.FindFirstValue("sub") ?? user?.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var parsed) ? parsed : null;
    }

    /// <summary>Kullanıcının tüm rolleri (BranchManager gibi roller Admin alias'ı da taşır).</summary>
    private List<string> CurrentRoles()
    {
        var user = httpContextAccessor.HttpContext?.User;
        return user?.FindAll("role").Select(x => x.Value).Distinct().ToList() ?? [];
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
        var currentUserId = CurrentUserId();
        var currentRoles = CurrentRoles();

        // Görülemeyen bildirim okundu da işaretlenemez (aynı görünürlük kuralı).
        var item = await dbContext.Notifications
            .SingleOrDefaultAsync(x => x.Id == id
                && (x.TargetUserId == currentUserId
                    || (x.TargetUserId == null && (x.TargetRole == "" || currentRoles.Contains(x.TargetRole)))), cancellationToken)
            ?? throw new InvalidOperationException("Bildirim bulunamadi.");

        item.IsRead = true;
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
