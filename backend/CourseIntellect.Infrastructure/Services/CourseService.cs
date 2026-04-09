using CourseIntellect.Application.DTOs.Courses;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class CourseService(CourseIntellectDbContext dbContext) : ICourseService
{
    public async Task<IReadOnlyList<CourseDto>> GetAllAsync(string? search, bool? isActive, CancellationToken cancellationToken = default)
    {
        var query = dbContext.CourseItems.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                EF.Functions.ILike(x.Name, $"%{search}%") ||
                EF.Functions.ILike(x.Description, $"%{search}%") ||
                EF.Functions.ILike(x.Category, $"%{search}%"));
        }

        if (isActive.HasValue)
        {
            query = query.Where(x => x.IsActive == isActive.Value);
        }

        return await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => ToDto(x))
            .ToListAsync(cancellationToken);
    }

    public async Task<CourseDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.CourseItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return entity is null ? null : ToDto(entity);
    }

    public async Task<CourseDto> CreateAsync(CreateCourseRequest request, CancellationToken cancellationToken = default)
    {
        var entity = new CourseItem();
        Apply(entity, request);
        entity.CreatedAtUtc = DateTime.UtcNow;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.CourseItems.AddAsync(entity, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return ToDto(entity);
    }

    public async Task<CourseDto?> UpdateAsync(Guid id, UpdateCourseRequest request, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.CourseItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        entity.Name = request.Name.Trim();
        entity.Description = request.Description.Trim();
        entity.Category = request.Category.Trim();
        entity.Price = request.Price;
        entity.Duration = request.Duration.Trim();
        entity.Level = request.Level.Trim();
        entity.IsActive = request.IsActive;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(entity);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.CourseItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return false;
        }

        dbContext.CourseItems.Remove(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static void Apply(CourseItem entity, CreateCourseRequest request)
    {
        entity.Name = request.Name.Trim();
        entity.Description = request.Description.Trim();
        entity.Category = request.Category.Trim();
        entity.Price = request.Price;
        entity.Duration = request.Duration.Trim();
        entity.Level = request.Level.Trim();
        entity.IsActive = request.IsActive;
    }

    private static CourseDto ToDto(CourseItem x) => new(
        x.Id,
        x.Name,
        x.Description,
        x.Category,
        x.Price,
        x.Duration,
        x.Level,
        x.IsActive,
        x.CreatedAtUtc,
        x.UpdatedAtUtc
    );
}
