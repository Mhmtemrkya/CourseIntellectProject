using System.Text.Json;
using CourseIntellect.Application.DTOs.Messages;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class MessageService(
    CourseIntellectDbContext dbContext,
    IMessageRealtimeNotifier realtimeNotifier,
    IPushNotificationService pushNotificationService) : IMessageService
{
    public async Task<IReadOnlyList<MessageThreadDto>> GetThreadsAsync(Guid currentUserId, string currentUserName, CancellationToken cancellationToken = default)
    {
        var normalizedName = Normalize(currentUserName);
        var threads = await dbContext.MessageThreads
            .Where(x => x.ParticipantOneUserId == currentUserId || x.ParticipantTwoUserId == currentUserId
                || (x.ParticipantOneUserId == null && x.ParticipantTwoUserId == null
                    && (x.ParticipantOneName == Normalize(currentUserName) || x.ParticipantTwoName == Normalize(currentUserName))))
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
        if (!IsParticipant(thread, currentUserId, normalizedCurrentName))
        {
            return Array.Empty<MessageItemDto>();
        }

        var items = await dbContext.MessageItems
            .Where(x => x.ThreadId == threadId)
            .OrderBy(x => x.SentAtUtc)
            .ToListAsync(cancellationToken);

        var participantKeys = new[]
        {
            MessageParticipantKey.RealtimeParticipantKey(thread.TenantId, thread.ParticipantOneUserId, thread.ParticipantOneName),
            MessageParticipantKey.RealtimeParticipantKey(thread.TenantId, thread.ParticipantTwoUserId, thread.ParticipantTwoName),
        };
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
        // Türkçe "İ"/"I" tuzağı: .NET ToLower ile SQL LOWER aynı karakteri farklı küçültür
        // (örn. "İ" → .NET "i" vs PG "i̇"), bu yüzden tek-taraf-SQL/tek-taraf-.NET karşılaştırması
        // adları eşleştiremiyordu. İki tarafı da PostgreSQL ILIKE ile karşılaştırıyoruz; böylece
        // case-folding tek motorda (PG) ve tutarlı. Ad tam eşleşmesi için joker karakterler kaçırılır.
        var contactNameQuery = request.ContactName.Trim();
        var contactNamePattern = contactNameQuery
            .Replace("\\", "\\\\")
            .Replace("%", "\\%")
            .Replace("_", "\\_");
        var contacts = await dbContext.Users.AsNoTracking()
            .Where(x => x.Status == CourseIntellect.Domain.Enums.UserStatus.Active
                && EF.Functions.ILike(x.FullName, contactNamePattern, "\\"))
            .ToListAsync(cancellationToken);
        var matchingContacts = contacts.Where(x => x.PrimaryRole.ToString().Equals(request.ContactRole.Trim(), StringComparison.OrdinalIgnoreCase)).ToList();
        if (matchingContacts.Count != 1) throw new InvalidOperationException("Kişi bulunamadı veya kurum içinde tekil değil.");
        var contact = matchingContacts[0];
        var contactName = Normalize(contact.FullName);
        var existing = await dbContext.MessageThreads.FirstOrDefaultAsync(
            x => (x.ParticipantOneUserId == currentUserId && x.ParticipantTwoUserId == contact.Id) ||
                 (x.ParticipantOneUserId == contact.Id && x.ParticipantTwoUserId == currentUserId),
            cancellationToken);

        if (existing is null)
        {
            existing = new MessageThread
            {
                ParticipantOneName = currentName,
                ParticipantOneUserId = currentUserId,
                ParticipantOneRole = currentUserRole,
                ParticipantTwoName = contactName,
                ParticipantTwoUserId = contact.Id,
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

        // Yetkilendirme: yalnız thread'in katılımcıları mesaj yazabilir. Okuma
        // tarafında (GetMessagesAsync) bu kontrol vardı, yazma tarafında yoktu:
        // aynı kurumdaki bir kullanıcı, bildiği bir thread GUID'ine mesaj
        // gönderebiliyordu. Bulunamadı ile aynı mesaj döner — yabancı bir
        // thread'in VAR olduğu bilgisi de sızmamalı.
        if (!IsParticipant(thread, currentUserId, Normalize(currentUserName)))
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
            SenderUserId = currentUserId,
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
            MessageParticipantKey.RealtimeParticipantKey(thread.TenantId, thread.ParticipantOneUserId, thread.ParticipantOneName),
            MessageParticipantKey.RealtimeParticipantKey(thread.TenantId, thread.ParticipantTwoUserId, thread.ParticipantTwoName),
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

        // Alıcıya (thread'in diğer katılımcısı) telefon push'u — uygulama kapalıyken
        // de mesajı görsün. Gönderenin kendisine gönderilmez.
        var recipientId = currentUserId == thread.ParticipantOneUserId ? thread.ParticipantTwoUserId : thread.ParticipantOneUserId;
        if (recipientId is Guid targetUserId)
        {
            var pushBody = previewText.Length > 120 ? previewText[..120] + "…" : previewText;
            await pushNotificationService.SendToUserAsync(
                targetUserId,
                currentUserName,
                pushBody,
                new Dictionary<string, string> { ["category"] = "message", ["threadId"] = thread.Id.ToString(), ["senderName"] = currentUserName },
                cancellationToken);
        }

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

    // Normalizasyon tek kaynaktan gelir; hub'daki yetki kontrolü ile servisin
    // katılımcı kontrolü ASLA ayrışmamalı (bkz. MessageParticipantKey).
    private static string Normalize(string value) => MessageParticipantKey.Normalize(value);

    private static bool IsParticipant(MessageThread thread, Guid userId, string normalizedName)
        => thread.ParticipantOneUserId == userId || thread.ParticipantTwoUserId == userId
            || (thread.ParticipantOneUserId is null && thread.ParticipantTwoUserId is null
                && MessageParticipantKey.IsParticipant(normalizedName, thread.ParticipantOneName, thread.ParticipantTwoName));
}
