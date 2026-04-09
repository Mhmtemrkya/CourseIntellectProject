using CourseIntellect.Application.DTOs.ContactMessages;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class ContactMessageService(CourseIntellectDbContext dbContext) : IContactMessageService
{
    public async Task<IReadOnlyList<ContactMessageDto>> GetAllAsync(string? search, string? status, bool? starred, CancellationToken cancellationToken = default)
    {
        var query = dbContext.ContactMessages.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                EF.Functions.ILike(x.Name, $"%{search}%") ||
                EF.Functions.ILike(x.Email, $"%{search}%") ||
                EF.Functions.ILike(x.Subject, $"%{search}%"));
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(x => x.Status == status.Trim());
        }

        if (starred.HasValue)
        {
            query = query.Where(x => x.IsStarred == starred.Value);
        }

        return await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new ContactMessageDto(
                x.Id,
                x.Name,
                x.Email,
                x.Subject,
                x.Status,
                x.IsStarred,
                x.CreatedAtUtc,
                x.ReadAtUtc,
                x.RepliedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<ContactMessageDetailDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.ContactMessages.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        if (entity.Status == "Okunmadı")
        {
            entity.Status = "Okundu";
            entity.ReadAtUtc = DateTime.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return new ContactMessageDetailDto(
            entity.Id,
            entity.Name,
            entity.Email,
            entity.Subject,
            entity.Message,
            entity.Status,
            entity.IsStarred,
            entity.IpAddress,
            entity.CreatedAtUtc,
            entity.ReadAtUtc,
            entity.RepliedAtUtc);
    }

    public async Task<ContactMessageDto> CreateAsync(CreateContactMessageRequest request, string ipAddress, CancellationToken cancellationToken = default)
    {
        var entity = new ContactMessage
        {
            Name = request.Name.Trim(),
            Email = request.Email.Trim(),
            Subject = request.Subject.Trim(),
            Message = request.Message.Trim(),
            IpAddress = ipAddress,
            CreatedAtUtc = DateTime.UtcNow
        };

        await dbContext.ContactMessages.AddAsync(entity, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return ToDto(entity);
    }

    public async Task<ContactMessageDto?> UpdateStatusAsync(Guid id, UpdateContactMessageStatusRequest request, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.ContactMessages.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return null;
        }

        entity.Status = request.Status.Trim();
        entity.IsStarred = request.IsStarred;
        await dbContext.SaveChangesAsync(cancellationToken);

        return ToDto(entity);
    }

    public async Task<ContactMessageDetailDto?> MarkAsReadAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.ContactMessages.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return null;

        entity.Status = "Okundu";
        entity.ReadAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDetailDto(entity);
    }

    public async Task<ContactMessageDetailDto?> ToggleStarAsync(Guid id, bool isStarred, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.ContactMessages.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return null;

        entity.IsStarred = isStarred;
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDetailDto(entity);
    }

    public async Task<ContactMessageDetailDto?> MarkAsRepliedAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.ContactMessages.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return null;

        entity.Status = "Yanıtlandı";
        entity.RepliedAtUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDetailDto(entity);
    }

    public async Task<ContactMessageDetailDto?> ArchiveAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.ContactMessages.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return null;

        entity.Status = "Arşivlendi";
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDetailDto(entity);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.ContactMessages.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null)
        {
            return false;
        }

        dbContext.ContactMessages.Remove(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static ContactMessageDto ToDto(ContactMessage x) => new(
        x.Id,
        x.Name,
        x.Email,
        x.Subject,
        x.Status,
        x.IsStarred,
        x.CreatedAtUtc,
        x.ReadAtUtc,
        x.RepliedAtUtc
    );

    private static ContactMessageDetailDto ToDetailDto(ContactMessage x) => new(
        x.Id,
        x.Name,
        x.Email,
        x.Subject,
        x.Message,
        x.Status,
        x.IsStarred,
        x.IpAddress,
        x.CreatedAtUtc,
        x.ReadAtUtc,
        x.RepliedAtUtc
    );
}
