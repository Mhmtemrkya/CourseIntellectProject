using System.Text.Json;
using CourseIntellect.Application.DTOs.SiteContent;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class SiteContentService(CourseIntellectDbContext dbContext) : ISiteContentService
{
    private static readonly JsonDocumentOptions DocumentOptions = new()
    {
        AllowTrailingCommas = true,
        CommentHandling = JsonCommentHandling.Skip
    };

    public async Task<SiteContentDto?> GetPublishedAsync(string sectionKey, string language, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.SiteContentItems
            .Where(x => x.SectionKey == sectionKey.Trim() && x.Language == language.Trim() && x.IsPublished)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(cancellationToken);

        return entity is null ? null : ToDto(entity);
    }

    public async Task<IReadOnlyList<SiteContentDto>> GetHistoryAsync(string sectionKey, string language, CancellationToken cancellationToken = default)
    {
        var entities = await dbContext.SiteContentItems
            .Where(x => x.SectionKey == sectionKey.Trim() && x.Language == language.Trim())
            .OrderByDescending(x => x.Version)
            .ToListAsync(cancellationToken);

        return entities.Select(ToDto).ToList();
    }

    public async Task<SiteContentDto> CreateOrUpdateAsync(string sectionKey, UpdateSiteContentRequest request, CancellationToken cancellationToken = default)
    {
        var key = sectionKey.Trim();
        var lang = request.Language.Trim();

        var latestVersion = await dbContext.SiteContentItems
            .Where(x => x.SectionKey == key && x.Language == lang)
            .MaxAsync(x => (int?)x.Version, cancellationToken) ?? 0;

        if (request.Publish)
        {
            var previouslyPublished = await dbContext.SiteContentItems
                .Where(x => x.SectionKey == key && x.Language == lang && x.IsPublished)
                .ToListAsync(cancellationToken);
            foreach (var item in previouslyPublished)
            {
                item.IsPublished = false;
            }
        }

        var entity = new SiteContentItem
        {
            SectionKey = key,
            ContentJson = request.Content.GetRawText(),
            Language = lang,
            Version = latestVersion + 1,
            IsPublished = request.Publish,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        await dbContext.SiteContentItems.AddAsync(entity, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return ToDto(entity);
    }

    public async Task<SiteContentDto?> PublishLatestAsync(string sectionKey, string language, CancellationToken cancellationToken = default)
    {
        var key = sectionKey.Trim();
        var lang = language.Trim();

        var latest = await dbContext.SiteContentItems
            .Where(x => x.SectionKey == key && x.Language == lang)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(cancellationToken);

        if (latest is null)
        {
            return null;
        }

        var allVersions = await dbContext.SiteContentItems
            .Where(x => x.SectionKey == key && x.Language == lang && x.IsPublished)
            .ToListAsync(cancellationToken);

        foreach (var v in allVersions)
        {
            v.IsPublished = false;
        }

        latest.IsPublished = true;
        latest.UpdatedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return ToDto(latest);
    }

    private static SiteContentDto ToDto(SiteContentItem x)
    {
        JsonElement content;
        if (string.IsNullOrWhiteSpace(x.ContentJson))
        {
            using var empty = JsonDocument.Parse("{}");
            content = empty.RootElement.Clone();
        }
        else
        {
            try
            {
                using var doc = JsonDocument.Parse(x.ContentJson, DocumentOptions);
                content = doc.RootElement.Clone();
            }
            catch (JsonException)
            {
                using var fallback = JsonDocument.Parse("{}");
                content = fallback.RootElement.Clone();
            }
        }

        return new SiteContentDto(
            x.Id,
            x.SectionKey,
            content,
            x.Language,
            x.Version,
            x.IsPublished,
            x.CreatedAtUtc,
            x.UpdatedAtUtc,
            string.IsNullOrWhiteSpace(x.UpdatedBy) ? null : x.UpdatedBy
        );
    }
}
