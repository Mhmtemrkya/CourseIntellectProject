using CourseIntellect.Application.DTOs.Announcements;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AnnouncementQueryService(CourseIntellectDbContext dbContext) : IAnnouncementQueryService
{
    public async Task<IReadOnlyList<AnnouncementDto>> GetAnnouncementsAsync(string? audience, CancellationToken cancellationToken = default)
    {
        var query = dbContext.Announcements.AsQueryable();

        if (!string.IsNullOrWhiteSpace(audience) && !audience.Equals("Tum Kurum", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(x =>
                x.Audience == "Tum Kurum" ||
                EF.Functions.ILike(x.Audience, $"%{audience}%"));
        }

        return await query
            .OrderByDescending(x => x.DateLabel)
            .Select(item => new AnnouncementDto(item.Id, item.Title, item.Detail, item.Audience, item.DateLabel))
            .ToListAsync(cancellationToken);
    }

    public async Task<AnnouncementDto> CreateAnnouncementAsync(CreateAnnouncementRequest request, CancellationToken cancellationToken = default)
    {
        var item = new AnnouncementItem
        {
            Title = request.Title.Trim(),
            Detail = request.Detail.Trim(),
            Audience = NormalizeAudience(request.Audience),
            DateLabel = DateTime.UtcNow.AddHours(3).ToString("dd MMMM yyyy")
        };

        await dbContext.Announcements.AddAsync(item, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new AnnouncementDto(item.Id, item.Title, item.Detail, item.Audience, item.DateLabel);
    }

    private static string NormalizeAudience(string audience)
    {
        return audience.Trim() switch
        {
            "Öğrenci" or "Ogrenci" => "Ogrenci",
            "Veli" => "Veli",
            "Öğretmen" or "Ogretmen" => "Ogretmen",
            "Tüm Kurum" or "Tum Kurum" => "Tum Kurum",
            _ => "Tum Kurum"
        };
    }
}
