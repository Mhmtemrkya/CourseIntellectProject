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
        await EnsureContentEngagementColumnsAsync(cancellationToken);

        var tenantId = dbContext.CurrentTenantId;
        var query = dbContext.ContentItems.IgnoreQueryFilters().AsQueryable();

        // Güvenlik: aktif kurum varsa kendi içeriği + global; kurum bağlamı yoksa YALNIZCA
        // global içerik (TenantId == null) döner — önceki "hepsini dök" davranışı cross-tenant sızıntısıydı.
        query = tenantId.HasValue
            ? query.Where(x => x.TenantId == tenantId.Value || x.TenantId == null)
            : query.Where(x => x.TenantId == null);

        if (visibleOnly)
        {
            query = query.Where(x =>
                x.PublishStatus == "Aktif"
                || x.PublishStatus == "Yayinda"
                || x.PublishStatus == "Yayında"
                || x.PublishStatus == "Published"
                || x.PublishStatus == "Active");
        }

        return await query
            .OrderByDescending(x => x.Id)
            .Select(x => ToDto(x))
            .ToListAsync(cancellationToken);
    }

    public async Task<ContentDto> CreateContentAsync(CreateContentRequest request, CancellationToken cancellationToken = default)
    {
        await EnsureContentEngagementColumnsAsync(cancellationToken);

        var item = new ContentItem();
        Apply(item, request);
        await dbContext.ContentItems.AddAsync(item, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(item);
    }

    public async Task<ContentDto?> UpdateContentAsync(Guid id, CreateContentRequest request, CancellationToken cancellationToken = default)
    {
        await EnsureContentEngagementColumnsAsync(cancellationToken);

        var item = await dbContext.ContentItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null) return null;
        Apply(item, request);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(item);
    }

    public async Task<ContentDto?> UpdateStatusAsync(Guid id, UpdateContentStatusRequest request, CancellationToken cancellationToken = default)
    {
        await EnsureContentEngagementColumnsAsync(cancellationToken);

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
        item.CoverImageUrl = string.IsNullOrWhiteSpace(request.CoverImageUrl) ? null : request.CoverImageUrl.Trim();
        item.PlaylistKey = string.IsNullOrWhiteSpace(request.PlaylistKey) ? null : request.PlaylistKey.Trim();
        item.PlaylistTitle = string.IsNullOrWhiteSpace(request.PlaylistTitle) ? null : request.PlaylistTitle.Trim();
        item.PlaylistOrder = request.PlaylistOrder;
        item.AllowDownload = request.AllowDownload;
        item.AllowNotes = request.AllowNotes;
        item.CompletionCertificate = request.CompletionCertificate;
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
        x.CoverImageUrl,
        x.PlaylistKey,
        x.PlaylistTitle,
        x.PlaylistOrder,
        x.AllowDownload,
        x.AllowNotes,
        x.CompletionCertificate,
        x.PublishStatus);

    private async Task EnsureContentEngagementColumnsAsync(CancellationToken cancellationToken)
    {
        await dbContext.Database.ExecuteSqlRawAsync(
            """
            ALTER TABLE content_items ADD COLUMN IF NOT EXISTS "AllowDownload" boolean NOT NULL DEFAULT TRUE;
            ALTER TABLE content_items ADD COLUMN IF NOT EXISTS "AllowNotes" boolean NOT NULL DEFAULT TRUE;
            ALTER TABLE content_items ADD COLUMN IF NOT EXISTS "CompletionCertificate" boolean NOT NULL DEFAULT FALSE;
            ALTER TABLE content_items ADD COLUMN IF NOT EXISTS "CoverImageUrl" character varying(600) NULL;
            ALTER TABLE content_items ADD COLUMN IF NOT EXISTS "PlaylistKey" character varying(120) NULL;
            ALTER TABLE content_items ADD COLUMN IF NOT EXISTS "PlaylistOrder" integer NULL;
            ALTER TABLE content_items ADD COLUMN IF NOT EXISTS "PlaylistTitle" character varying(180) NULL;
            """,
            cancellationToken);
    }
}
