using CourseIntellect.Application.DTOs.AppSettings;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AppSettingService(CourseIntellectDbContext dbContext) : IAppSettingService
{
    // Kurum kullanıcısı kurum filtresiyle yalnız kendi kurumunun ayarlarını görür
    // (yeni kayıtlar SaveChanges'te kuruma damgalanır). Kurum bağlamı olmayan
    // platform yöneticisi yalnız platform ayarlarıyla (TenantId null) çalışır;
    // kurumların aynı anahtarlı kayıtları ona karışmaz.
    private IQueryable<AppSetting> Scoped() => dbContext.CurrentTenantId is null
        ? dbContext.AppSettings.IgnoreQueryFilters().Where(x => x.TenantId == null)
        : dbContext.AppSettings;

    public async Task<IReadOnlyList<AppSettingDto>> GetAllAsync(string? category, CancellationToken cancellationToken = default)
    {
        var query = Scoped();

        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(x => x.Category == category.Trim());
        }

        return await query
            .OrderBy(x => x.Category)
            .ThenBy(x => x.Key)
            .Select(x => ToDto(x))
            .ToListAsync(cancellationToken);
    }

    public async Task<AppSettingDto?> GetByKeyAsync(string key, CancellationToken cancellationToken = default)
    {
        var entity = await Scoped()
            .FirstOrDefaultAsync(x => x.Key == key.Trim(), cancellationToken);

        return entity is null ? null : ToDto(entity);
    }

    public async Task<IReadOnlyList<AppSettingDto>> UpsertManyAsync(List<UpsertAppSettingRequest> items, CancellationToken cancellationToken = default)
    {
        var results = new List<AppSettingDto>();

        foreach (var item in items)
        {
            var key = item.Key.Trim();

            var entity = await Scoped()
                .FirstOrDefaultAsync(x => x.Key == key, cancellationToken);

            if (entity is null)
            {
                entity = new AppSetting
                {
                    Key = key
                };
                await dbContext.AppSettings.AddAsync(entity, cancellationToken);
            }

            entity.Value = item.Value;
            entity.Type = item.Type.Trim();
            entity.Category = item.Category.Trim();
            entity.Description = item.Description.Trim();
            entity.UpdatedAtUtc = DateTime.UtcNow;

            results.Add(ToDto(entity));
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return results;
    }

    private static AppSettingDto ToDto(AppSetting x) => new(
        x.Id,
        x.Key,
        x.Value,
        x.Type,
        x.Category,
        x.Description,
        x.UpdatedAtUtc
    );
}
