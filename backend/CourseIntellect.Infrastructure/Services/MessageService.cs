using System.Text.Json;
using CourseIntellect.Application.DTOs.Messages;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class MessageService(
    CourseIntellectDbContext dbContext,
    IMessageRealtimeNotifier realtimeNotifier) : IMessageService
{
    public async Task<IReadOnlyList<MessageThreadDto>> GetThreadsAsync(Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        var normalizedName = Normalize(currentUserName);
        var threads = await dbContext.MessageThreads
            .Where(x => x.ParticipantOneName == normalizedName || x.ParticipantTwoName == normalizedName)
            .OrderByDescending(x => x.LastMessageAtUtc)
            .ToListAsync(cancellationToken);

        var threadIds = threads.Select(t => t.Id).ToList();

        var latestMessages = await dbContext.MessageItems
            .Where(x => threadIds.Contains(x.ThreadId))
            .GroupBy(x => x.ThreadId)
            .Select(group => group.OrderByDescending(item => item.SentAtUtc).First())
            .ToDictionaryAsync(x => x.ThreadId, x => x, cancellationToken);

        // unread count sadece kullanıcının kendi thread'leri kapsamında hesaplanır.
        // Önceki hâli tüm tenant unread'lerini groupBy ediyordu — gereksiz veri taraması.
        var unreadGroups = await dbContext.MessageItems
            .Where(x => threadIds.Contains(x.ThreadId) && !x.IsRead && x.SenderName != normalizedName)
            .GroupBy(x => x.ThreadId)
            .Select(group => new { ThreadId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(x => x.ThreadId, x => x.Count, cancellationToken);

        return threads
            .Select(thread => BuildThreadDto(thread, normalizedName, unreadGroups.GetValueOrDefault(thread.Id), latestMessages.GetValueOrDefault(thread.Id)))
            .ToList();
    }

    public async Task<IReadOnlyList<MessageItemDto>> GetMessagesAsync(Guid currentUserId, string currentUserName, Guid threadId, CancellationToken cancellationToken = default)
    {
        var thread = await dbContext.MessageThreads.FirstOrDefaultAsync(x => x.Id == threadId, cancellationToken);
        if (thread is null)
        {
            return Array.Empty<MessageItemDto>();
        }

        var normalizedCurrentName = Normalize(currentUserName);

        // Yetkilendirme: yalnızca thread'in katılımcıları içeriği görebilir.
        // Tenant query filter'ı zaten cross-tenant erişimi engelliyor; bu kontrol
        // aynı tenant içindeki başka kullanıcıların thread içeriğini sızdırmasını önler.
        if (thread.ParticipantOneName != normalizedCurrentName &&
            thread.ParticipantTwoName != normalizedCurrentName)
        {
            return Array.Empty<MessageItemDto>();
        }

        var items = await dbContext.MessageItems
            .Where(x => x.ThreadId == threadId)
            .OrderBy(x => x.SentAtUtc)
            .ToListAsync(cancellationToken);

        var participantKeys = new[] { thread.ParticipantOneName, thread.ParticipantTwoName };
        var updatedAny = false;
        foreach (var item in items.Where(x => !x.IsRead && x.SenderName != normalizedCurrentName))
        {
            item.IsRead = true;
            updatedAny = true;
            await realtimeNotifier.NotifyMessageStatusChangedAsync(
                threadId,
                participantKeys,
                new MessageStatusChangedDto(threadId, item.Id, "read", DateTime.UtcNow),
                cancellationToken);
        }

        if (updatedAny)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return items
            .Select(x => new MessageItemDto(
                x.Id,
                x.ThreadId,
                x.SenderName,
                x.SenderRole,
                x.Text,
                x.IsRead,
                x.SentAtUtc,
                x.SenderName == normalizedCurrentName,
                x.IsRead ? "read" : "delivered",
                x.IsRead ? DateTime.UtcNow : null,
                DeserializeAttachments(x.Attachments)))
            .ToList();
    }

    public async Task<MessageThreadDto> CreateOrGetThreadAsync(
        Guid currentUserId,
        string currentUserName,
        string currentUserRole,
        CreateThreadRequest request,
        CancellationToken cancellationToken = default)
    {
        var currentName = Normalize(currentUserName);
        var contactName = Normalize(request.ContactName);
        var existing = await dbContext.MessageThreads.FirstOrDefaultAsync(
            x => (x.ParticipantOneName == currentName && x.ParticipantTwoName == contactName) ||
                 (x.ParticipantOneName == contactName && x.ParticipantTwoName == currentName),
            cancellationToken);

        if (existing is null)
        {
            existing = new MessageThread
            {
                ParticipantOneName = currentName,
                ParticipantOneRole = currentUserRole,
                ParticipantTwoName = contactName,
                ParticipantTwoRole = request.ContactRole.Trim(),
                LastMessagePreview = string.IsNullOrWhiteSpace(request.InitialMessage) ? "Yeni sohbet oluşturuldu." : request.InitialMessage!.Trim(),
                LastMessageAtUtc = DateTime.UtcNow
            };
            await dbContext.MessageThreads.AddAsync(existing, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        if (!string.IsNullOrWhiteSpace(request.InitialMessage))
        {
            await SendMessageAsync(
                currentUserId,
                currentUserName,
                currentUserRole,
                existing.Id,
                new SendMessageRequest(request.InitialMessage!, null),
                cancellationToken);
        }

        return BuildThreadDto(existing, currentName, 0, null);
    }

    public async Task<MessageItemDto> SendMessageAsync(
        Guid currentUserId,
        string currentUserName,
        string currentUserRole,
        Guid threadId,
        SendMessageRequest request,
        CancellationToken cancellationToken = default)
    {
        var thread = await dbContext.MessageThreads.FirstOrDefaultAsync(x => x.Id == threadId, cancellationToken);
        if (thread is null)
        {
            throw new InvalidOperationException("Thread bulunamadı.");
        }

        var attachments = (request.Attachments ?? Array.Empty<MessageAttachmentDto>())
            .Where(a => !string.IsNullOrWhiteSpace(a.FileUrl))
            .ToList();

        var item = new MessageItem
        {
            TenantId = thread.TenantId,
            ThreadId = threadId,
            SenderName = Normalize(currentUserName),
            SenderRole = currentUserRole,
            Text = request.Text.Trim(),
            IsRead = false,
            SentAtUtc = DateTime.UtcNow,
            Attachments = attachments.Count == 0 ? "[]" : JsonSerializer.Serialize(attachments)
        };

        await dbContext.MessageItems.AddAsync(item, cancellationToken);
        var previewText = item.Text;
        if (string.IsNullOrWhiteSpace(previewText) && attachments.Count > 0)
        {
            previewText = attachments.Count == 1 ? "📎 Ek dosya" : $"📎 {attachments.Count} ek dosya";
        }
        thread.LastMessagePreview = previewText;
        thread.LastMessageAtUtc = item.SentAtUtc;
        await dbContext.SaveChangesAsync(cancellationToken);

        var messageDto = new MessageItemDto(
            item.Id,
            item.ThreadId,
            item.SenderName,
            item.SenderRole,
            item.Text,
            item.IsRead,
            item.SentAtUtc,
            true,
            "delivered",
            null,
            attachments);
        var participantKeys = new[]
        {
            thread.ParticipantOneName,
            thread.ParticipantTwoName,
        };

        await realtimeNotifier.NotifyMessageReceivedAsync(thread.Id, participantKeys, messageDto, cancellationToken);
        await realtimeNotifier.NotifyThreadUpdatedAsync(
            thread.Id,
            participantKeys,
            BuildThreadDto(thread, thread.ParticipantOneName, 0, item),
            cancellationToken);
        await realtimeNotifier.NotifyThreadUpdatedAsync(
            thread.Id,
            participantKeys,
            BuildThreadDto(thread, thread.ParticipantTwoName, 0, item),
            cancellationToken);

        return messageDto;
    }

    public Task JoinRealtimeAsync(Guid currentUserId, string currentUserName, Guid threadId, CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }

    private static MessageThreadDto BuildThreadDto(MessageThread thread, string normalizedCurrentName, int unreadCount, MessageItem? latestMessage)
    {
        var isFirst = thread.ParticipantOneName == normalizedCurrentName;
        var lastMessageFromMe = latestMessage?.SenderName == normalizedCurrentName;
        var lastMessageStatus = latestMessage?.IsRead == true ? "read" : latestMessage is null ? "sent" : "delivered";
        return new MessageThreadDto(
            thread.Id,
            isFirst ? thread.ParticipantTwoName : thread.ParticipantOneName,
            isFirst ? thread.ParticipantTwoRole : thread.ParticipantOneRole,
            thread.LastMessagePreview,
            thread.LastMessageAtUtc,
            unreadCount,
            lastMessageFromMe,
            lastMessageStatus);
    }

    private static IReadOnlyList<MessageAttachmentDto> DeserializeAttachments(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return Array.Empty<MessageAttachmentDto>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<MessageAttachmentDto>>(json) ?? new List<MessageAttachmentDto>();
        }
        catch
        {
            return Array.Empty<MessageAttachmentDto>();
        }
    }

    private static string Normalize(string value)
    {
        return value.Trim()
            .Replace('ç', 'c')
            .Replace('Ç', 'C')
            .Replace('ğ', 'g')
            .Replace('Ğ', 'G')
            .Replace('ı', 'i')
            .Replace('İ', 'I')
            .Replace('ö', 'o')
            .Replace('Ö', 'O')
            .Replace('ş', 's')
            .Replace('Ş', 'S')
            .Replace('ü', 'u')
            .Replace('Ü', 'U');
    }
}
