using System.Text.Json;
using CourseIntellect.Application.DTOs.QuestionThreads;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class QuestionThreadService(CourseIntellectDbContext dbContext) : IQuestionThreadService
{
    public async Task<IReadOnlyList<QuestionThreadDto>> GetThreadsAsync(
        string requestorRole,
        Guid requestorUserId,
        string fullName,
        string username,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.StudentQuestionThreads.AsQueryable();
        var normalizedRole = requestorRole.Trim();

        if (normalizedRole.Equals("Student", StringComparison.OrdinalIgnoreCase))
        {
            query = requestorUserId != Guid.Empty
                ? query.Where(x => x.StudentUserId == requestorUserId || (x.StudentUserId == null && x.StudentUsername == username))
                : query.Where(x => x.StudentName == fullName);
        }
        else if (normalizedRole.Equals("Teacher", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(x => x.TeacherUserId == requestorUserId || (x.TeacherUserId == null && x.TeacherName == fullName));
        }
        else if (!IsManagementRole(normalizedRole))
        {
            query = query.Where(_ => false);
        }

        var threads = await query
            .OrderByDescending(x => x.Id)
            .ToListAsync(cancellationToken);

        var threadIds = threads.Select(x => x.Id).ToList();
        var replies = await dbContext.StudentQuestionReplies
            .Where(x => threadIds.Contains(x.ThreadId))
            .OrderBy(x => x.Id)
            .ToListAsync(cancellationToken);

        return threads
            .Select(thread => ToDto(thread, replies.Where(x => x.ThreadId == thread.Id).ToList()))
            .ToList();
    }

    public async Task<QuestionThreadDto> CreateThreadAsync(
        string studentName,
        Guid studentUserId,
        string studentUsername,
        CreateQuestionThreadRequest request,
        CancellationToken cancellationToken = default)
    {
        var attachments = request.Attachments?.Where(IsValidAttachment).ToList() ?? [];
        var teachers = await dbContext.Users.AsNoTracking()
            .Where(x => x.Status == CourseIntellect.Domain.Enums.UserStatus.Active
                && x.PrimaryRole == CourseIntellect.Domain.Enums.UserRole.Teacher
                && x.FullName.ToLower() == request.TeacherName.Trim().ToLower())
            .Select(x => x.Id).ToListAsync(cancellationToken);
        if (teachers.Count != 1) throw new InvalidOperationException("Öğretmen bulunamadı veya kurum içinde tekil değil.");
        var thread = new StudentQuestionThread
        {
            Title = request.Title.Trim(),
            Subject = request.Subject.Trim(),
            StudentName = studentName.Trim(),
            StudentUserId = studentUserId,
            StudentUsername = studentUsername.Trim(),
            TeacherName = request.TeacherName.Trim(),
            TeacherUserId = teachers[0],
            QuestionText = request.QuestionText.Trim(),
            Status = "Bekliyor",
            CreatedAtLabel = BuildDateLabel(),
            LastActivityLabel = BuildDateLabel(),
            AttachmentSummary = BuildAttachmentSummary(attachments),
            AttachmentsSerialized = JsonSerializer.Serialize(attachments)
        };

        await dbContext.StudentQuestionThreads.AddAsync(thread, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(thread, []);
    }

    public async Task<QuestionThreadDto?> AddReplyAsync(
        Guid threadId,
        Guid senderUserId,
        string senderName,
        string senderRole,
        string senderUsername,
        CreateQuestionThreadReplyRequest request,
        CancellationToken cancellationToken = default)
    {
        var thread = await dbContext.StudentQuestionThreads.FirstOrDefaultAsync(x => x.Id == threadId, cancellationToken);
        if (thread is null)
        {
            return null;
        }

        // Yetkilendirme: yanıt yolu LİSTELEME ile aynı kuralı uygular. Eskiden hiç
        // kontrol yoktu; aynı kurumdaki bir öğrenci, bildiği bir thread GUID'ine
        // yanıt yazıp dönen DTO üzerinden sorunun metnini, soruyu soran öğrencinin
        // adını, ekleri ve tüm yanıt geçmişini okuyabiliyordu. Yetkisizde null
        // döner — "bulunamadı" ile aynı sonuç, thread'in varlığı sızmaz.
        if (!CanAccessThread(thread, senderUserId, senderRole, senderName, senderUsername))
        {
            return null;
        }

        var attachments = request.Attachments?.Where(IsValidAttachment).ToList() ?? [];
        var reply = new StudentQuestionReply
        {
            TenantId = thread.TenantId,
            ThreadId = threadId,
            SenderUserId = senderUserId,
            SenderName = senderName.Trim(),
            SenderRole = senderRole.Trim(),
            MessageText = request.MessageText.Trim(),
            CreatedAtLabel = BuildDateLabel(),
            AttachmentsSerialized = JsonSerializer.Serialize(attachments)
        };

        await dbContext.StudentQuestionReplies.AddAsync(reply, cancellationToken);
        thread.LastActivityLabel = reply.CreatedAtLabel;
        thread.Status = senderRole.Equals("Teacher", StringComparison.OrdinalIgnoreCase) ? "Yanıtlandı" : "Bekliyor";
        await dbContext.SaveChangesAsync(cancellationToken);

        var replies = await dbContext.StudentQuestionReplies
            .Where(x => x.ThreadId == threadId)
            .OrderBy(x => x.Id)
            .ToListAsync(cancellationToken);

        return ToDto(thread, replies);
    }

    /// <summary>
    /// Thread erişim kuralı — <see cref="GetThreadsAsync"/> ile TEK kaynak olmalı:
    /// öğrenci yalnız kendi sorusunu, öğretmen yalnız kendisine yöneltilen soruyu,
    /// yönetim rolleri hepsini görür. Tanınmayan rol hiçbir şey göremez (fail-closed).
    /// </summary>
    private static bool CanAccessThread(StudentQuestionThread thread, Guid userId, string requestorRole, string fullName, string username)
    {
        var normalizedRole = requestorRole.Trim();

        if (normalizedRole.Equals("Student", StringComparison.OrdinalIgnoreCase))
        {
            return thread.StudentUserId is Guid ownerId
                ? ownerId == userId
                : !string.IsNullOrWhiteSpace(username)
                    ? thread.StudentUsername == username
                    : !string.IsNullOrWhiteSpace(fullName) && thread.StudentName == fullName;
        }

        if (normalizedRole.Equals("Teacher", StringComparison.OrdinalIgnoreCase))
        {
            return thread.TeacherUserId is Guid teacherId
                ? teacherId == userId
                : !string.IsNullOrWhiteSpace(fullName) && thread.TeacherName == fullName;
        }

        // Listeleme tarafında filtre uygulanmayan yönetim rolleri.
        return IsManagementRole(normalizedRole);
    }

    private static bool IsManagementRole(string normalizedRole)
        => normalizedRole.Equals("Admin", StringComparison.OrdinalIgnoreCase)
            || normalizedRole.Equals("Administrative", StringComparison.OrdinalIgnoreCase)
            || normalizedRole.Equals("InstitutionAdmin", StringComparison.OrdinalIgnoreCase)
            || normalizedRole.Equals("Idare", StringComparison.OrdinalIgnoreCase)
            || normalizedRole.Equals("Developer", StringComparison.OrdinalIgnoreCase);

    private static QuestionThreadDto ToDto(StudentQuestionThread thread, IReadOnlyList<StudentQuestionReply> replies)
    {
        var deserializedAttachments = DeserializeAttachments(thread.AttachmentsSerialized);
        var deserializedReplies = replies.Select(reply => new QuestionThreadReplyDto(
            reply.Id,
            reply.SenderName,
            reply.SenderRole,
            reply.MessageText,
            reply.CreatedAtLabel,
            DeserializeAttachments(reply.AttachmentsSerialized))).ToList();

        return new QuestionThreadDto(
            thread.Id,
            thread.Title,
            thread.Subject,
            thread.StudentName,
            thread.StudentUsername,
            thread.TeacherName,
            thread.QuestionText,
            thread.Status,
            thread.CreatedAtLabel,
            thread.LastActivityLabel,
            thread.AttachmentSummary,
            deserializedAttachments,
            deserializedReplies);
    }

    private static IReadOnlyList<QuestionThreadAttachmentDto> DeserializeAttachments(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return [];
        }

        return JsonSerializer.Deserialize<List<QuestionThreadAttachmentDto>>(value) ?? [];
    }

    private static string BuildAttachmentSummary(IReadOnlyList<QuestionThreadAttachmentDto> attachments)
    {
        if (attachments.Count == 0)
        {
            return "Eksiz";
        }

        var kinds = attachments.Select(x => x.FileType).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList();
        return $"{attachments.Count} ek • {string.Join(", ", kinds)}";
    }

    private static bool IsValidAttachment(QuestionThreadAttachmentDto item)
        => !string.IsNullOrWhiteSpace(item.FileName) && !string.IsNullOrWhiteSpace(item.FileUrl);

    private static string BuildDateLabel()
    {
        var now = DateTime.Now;
        var month = now.Month switch
        {
            1 => "Ocak",
            2 => "Subat",
            3 => "Mart",
            4 => "Nisan",
            5 => "Mayis",
            6 => "Haziran",
            7 => "Temmuz",
            8 => "Agustos",
            9 => "Eylul",
            10 => "Ekim",
            11 => "Kasim",
            _ => "Aralik"
        };
        return $"{now.Day} {month} {now.Year}";
    }
}
