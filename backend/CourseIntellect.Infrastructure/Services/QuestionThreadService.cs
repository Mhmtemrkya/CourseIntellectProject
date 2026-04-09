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
        string fullName,
        string username,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.StudentQuestionThreads.AsQueryable();
        var normalizedRole = requestorRole.Trim();

        if (normalizedRole.Equals("Student", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(x => x.StudentUsername == username || x.StudentName == fullName);
        }
        else if (normalizedRole.Equals("Teacher", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(x => x.TeacherName == fullName);
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
        string studentUsername,
        CreateQuestionThreadRequest request,
        CancellationToken cancellationToken = default)
    {
        var attachments = request.Attachments?.Where(IsValidAttachment).ToList() ?? [];
        var thread = new StudentQuestionThread
        {
            Title = request.Title.Trim(),
            Subject = request.Subject.Trim(),
            StudentName = studentName.Trim(),
            StudentUsername = studentUsername.Trim(),
            TeacherName = request.TeacherName.Trim(),
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
        string senderName,
        string senderRole,
        CreateQuestionThreadReplyRequest request,
        CancellationToken cancellationToken = default)
    {
        var thread = await dbContext.StudentQuestionThreads.FirstOrDefaultAsync(x => x.Id == threadId, cancellationToken);
        if (thread is null)
        {
            return null;
        }

        var attachments = request.Attachments?.Where(IsValidAttachment).ToList() ?? [];
        var reply = new StudentQuestionReply
        {
            ThreadId = threadId,
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
