using CourseIntellect.Application.DTOs.Translations;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class TranslationService(CourseIntellectDbContext dbContext) : ITranslationService
{
    public async Task<IReadOnlyList<TranslationDto>> GetAllAsync(string? language, string? category, string? search, CancellationToken cancellationToken = default)
    {
        var query = dbContext.TranslationItems.AsQueryable();

        if (!string.IsNullOrWhiteSpace(language))
        {
            query = query.Where(x => x.Language == language.Trim());
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(x => x.Category == category.Trim());
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                EF.Functions.ILike(x.Key, $"%{search}%") ||
                EF.Functions.ILike(x.Value, $"%{search}%"));
        }

        return await query
            .OrderBy(x => x.Category)
            .ThenBy(x => x.Key)
            .Select(x => ToDto(x))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<TranslationDto>> UpsertManyAsync(List<UpsertTranslationRequest> items, CancellationToken cancellationToken = default)
    {
        var results = new List<TranslationDto>();

        foreach (var item in items)
        {
            var key = item.Key.Trim();
            var lang = item.Language.Trim();

            var entity = await dbContext.TranslationItems
                .FirstOrDefaultAsync(x => x.Key == key && x.Language == lang, cancellationToken);

            if (entity is null)
            {
                entity = new TranslationItem
                {
                    Key = key,
                    Language = lang
                };
                await dbContext.TranslationItems.AddAsync(entity, cancellationToken);
            }

            entity.Value = item.Value;
            entity.Category = item.Category.Trim();
            entity.UpdatedAtUtc = DateTime.UtcNow;

            results.Add(ToDto(entity));
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return results;
    }

    public async Task<IReadOnlyList<TranslationDto>> ExportAsync(string language, CancellationToken cancellationToken = default)
    {
        return await dbContext.TranslationItems
            .Where(x => x.Language == language.Trim())
            .OrderBy(x => x.Category)
            .ThenBy(x => x.Key)
            .Select(x => ToDto(x))
            .ToListAsync(cancellationToken);
    }

    private static TranslationDto ToDto(TranslationItem x) => new(
        x.Id,
        x.Key,
        x.Language,
        x.Value,
        x.Category,
        x.UpdatedAtUtc
    );
}
