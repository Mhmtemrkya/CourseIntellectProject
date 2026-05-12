using CourseIntellect.Application.DTOs.Announcements;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AnnouncementQueryService(CourseIntellectDbContext dbContext) : IAnnouncementQueryService
{
    public async Task<IReadOnlyList<AnnouncementDto>> GetAnnouncementsAsync(
        string? audience,
        string? className = null,
        string? teacherName = null,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.Announcements.AsQueryable();

        if (!string.IsNullOrWhiteSpace(audience) && !audience.Equals("Tum Kurum", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(x =>
                x.Audience == "Tum Kurum" ||
                EF.Functions.ILike(x.Audience, $"%{audience}%"));
        }

        if (!string.IsNullOrWhiteSpace(className))
        {
            var c = className.Trim();
            query = query.Where(x => x.ClassName == null || x.ClassName == string.Empty || x.ClassName == c);
        }

        if (!string.IsNullOrWhiteSpace(teacherName))
        {
            var t = teacherName.Trim();
            query = query.Where(x => x.TeacherName == null || x.TeacherName == string.Empty || x.TeacherName == t);
        }

        return await query
            .OrderByDescending(x => x.DateLabel)
            .Select(item => new AnnouncementDto(item.Id, item.Title, item.Detail, item.Audience, item.DateLabel, item.ClassName, item.TeacherName))
            .ToListAsync(cancellationToken);
    }

    public async Task<AnnouncementDto> CreateAnnouncementAsync(CreateAnnouncementRequest request, CancellationToken cancellationToken = default)
    {
        var item = new AnnouncementItem
        {
            Title = request.Title.Trim(),
            Detail = request.Detail.Trim(),
            Audience = NormalizeAudience(request.Audience),
            DateLabel = DateTime.UtcNow.AddHours(3).ToString("dd MMMM yyyy"),
            ClassName = string.IsNullOrWhiteSpace(request.ClassName) ? null : request.ClassName.Trim(),
            TeacherName = string.IsNullOrWhiteSpace(request.TeacherName) ? null : request.TeacherName.Trim(),
        };

        await dbContext.Announcements.AddAsync(item, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new AnnouncementDto(item.Id, item.Title, item.Detail, item.Audience, item.DateLabel, item.ClassName, item.TeacherName);
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
