using CourseIntellect.Application.DTOs.Meetings;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class MeetingRequestService(CourseIntellectDbContext dbContext) : IMeetingRequestService
{
    public async Task<IReadOnlyList<MeetingRequestDto>> GetRequestsAsync(
        string? advisor,
        string? parentName,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.MeetingRequests.AsQueryable();

        if (!string.IsNullOrWhiteSpace(advisor))
        {
            query = query.Where(x => EF.Functions.ILike(x.Advisor, $"%{Normalize(advisor)}%"));
        }

        if (!string.IsNullOrWhiteSpace(parentName))
        {
            query = query.Where(x => EF.Functions.ILike(x.ParentName, $"%{Normalize(parentName)}%"));
        }

        return await query
            .OrderBy(x => x.Status == "Bekliyor" ? 0 : x.Status == "Onaylandı" ? 1 : 2)
            .ThenByDescending(x => x.Slot)
            .Select(x => new MeetingRequestDto(
                x.Id,
                x.ParentName,
                x.StudentName,
                x.Advisor,
                x.Topic,
                x.Slot,
                x.OnlineMeeting,
                x.Note,
                x.Status))
            .ToListAsync(cancellationToken);
    }

    public async Task<MeetingRequestDto> CreateRequestAsync(CreateMeetingRequestRequest request, CancellationToken cancellationToken = default)
    {
        var item = new MeetingRequest
        {
            ParentName = Normalize(request.ParentName),
            StudentName = Normalize(request.StudentName),
            Advisor = Normalize(request.Advisor),
            Topic = request.Topic.Trim(),
            Slot = request.Slot.Trim(),
            OnlineMeeting = request.OnlineMeeting,
            Note = request.Note.Trim(),
            Status = "Bekliyor"
        };

        await dbContext.MeetingRequests.AddAsync(item, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return ToDto(item);
    }

    public async Task<MeetingRequestDto?> UpdateStatusAsync(Guid id, UpdateMeetingRequestStatusRequest request, CancellationToken cancellationToken = default)
    {
        var item = await dbContext.MeetingRequests.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return null;
        }

        item.Status = request.Status.Trim();
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(item);
    }

    private static MeetingRequestDto ToDto(MeetingRequest item)
    {
        return new MeetingRequestDto(
            item.Id,
            item.ParentName,
            item.StudentName,
            item.Advisor,
            item.Topic,
            item.Slot,
            item.OnlineMeeting,
            item.Note,
            item.Status);
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
