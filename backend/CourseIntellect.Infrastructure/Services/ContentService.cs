using CourseIntellect.Application.DTOs.Contents;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class ContentService(CourseIntellectDbContext dbContext) : IContentService
{
    public async Task<IReadOnlyList<ContentDto>> GetContentsAsync(bool visibleOnly, CancellationToken cancellationToken = default)
    {
        var query = dbContext.ContentItems.AsQueryable();
        if (visibleOnly)
        {
            query = query.Where(x => x.PublishStatus == "Aktif");
        }

        return await query
            .OrderByDescending(x => x.Id)
            .Select(x => ToDto(x))
            .ToListAsync(cancellationToken);
    }

    public async Task<ContentDto> CreateContentAsync(CreateContentRequest request, CancellationToken cancellationToken = default)
    {
        var item = new ContentItem();
        Apply(item, request);
        await dbContext.ContentItems.AddAsync(item, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(item);
    }

    public async Task<ContentDto?> UpdateContentAsync(Guid id, CreateContentRequest request, CancellationToken cancellationToken = default)
    {
        var item = await dbContext.ContentItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return null;
        Apply(item, request);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(item);
    }

    public async Task<ContentDto?> UpdateStatusAsync(Guid id, UpdateContentStatusRequest request, CancellationToken cancellationToken = default)
    {
        var item = await dbContext.ContentItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return null;
        item.PublishStatus = request.PublishStatus.Trim();
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(item);
    }

    private static void Apply(ContentItem item, CreateContentRequest request)
    {
        item.Subject = request.Subject.Trim();
        item.Title = request.Title.Trim();
        item.Teacher = request.Teacher.Trim();
        item.Info = request.Info.Trim();
        item.Progress = request.Progress;
        item.FileType = request.FileType.Trim();
        item.Grade = request.Grade.Trim();
        item.Views = request.Views.Trim();
        item.Size = request.Size.Trim();
        item.Description = request.Description.Trim();
        item.FileName = string.IsNullOrWhiteSpace(request.FileName) ? null : request.FileName.Trim();
        item.FileUrl = string.IsNullOrWhiteSpace(request.FileUrl) ? null : request.FileUrl.Trim();
        item.PublishStatus = request.PublishStatus.Trim();
    }

    private static ContentDto ToDto(ContentItem x) => new(
        x.Id,
        x.Subject,
        x.Title,
        x.Teacher,
        x.Info,
        x.Progress,
        x.FileType,
        x.Grade,
        x.Views,
        x.Size,
        x.Description,
        x.FileName,
        x.FileUrl,
        x.PublishStatus);
}
