using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class AdminDocumentService(
    CourseIntellectDbContext dbContext,
    IAuditLogService auditLogService) : IAdminDocumentService
{
    public async Task<AdminDocumentDto> CreateAsync(
        CreateDocumentRequest request,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var document = new AdminDocument
        {
            Title = request.Title.Trim(),
            Category = string.IsNullOrWhiteSpace(request.Category) ? "Genel" : request.Category.Trim(),
            Direction = string.IsNullOrWhiteSpace(request.Direction) ? "Internal" : request.Direction.Trim(),
            DocumentNo = request.DocumentNo?.Trim() ?? string.Empty,
            RelatedParty = request.RelatedParty?.Trim() ?? string.Empty,
            FileUrl = request.FileUrl?.Trim() ?? string.Empty,
            ContentType = request.ContentType?.Trim() ?? string.Empty,
            Status = "Active",
            Note = request.Note?.Trim() ?? string.Empty,
            UploadedByUserId = actorUserId,
            UploadedByName = string.IsNullOrWhiteSpace(actorName) ? "Bilinmiyor" : actorName.Trim(),
            ExpiryDateUtc = request.ExpiryDate.HasValue
                ? DateTime.SpecifyKind(request.ExpiryDate.Value, DateTimeKind.Utc)
                : null,
            CreatedAtUtc = DateTime.UtcNow,
        };
        await dbContext.AdminDocuments.AddAsync(document, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(actorUserId, document.UploadedByName, "Evrak eklendi",
            "Document", nameof(AdminDocument), document.Id.ToString(),
            $"{document.Category}: {document.Title}", cancellationToken);

        return Map(document);
    }

    public async Task<IReadOnlyList<AdminDocumentDto>> GetAsync(
        string? category,
        string? direction,
        string? status,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.AdminDocuments.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(category))
        {
            var normalized = category.Trim();
            query = query.Where(item => item.Category == normalized);
        }

        if (!string.IsNullOrWhiteSpace(direction))
        {
            var normalized = direction.Trim();
            query = query.Where(item => item.Direction == normalized);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalized = status.Trim();
            query = query.Where(item => item.Status == normalized);
        }

        return await query
            .OrderByDescending(item => item.CreatedAtUtc)
            .Select(item => Map(item))
            .ToListAsync(cancellationToken);
    }

    public async Task<AdminDocumentDto?> ArchiveAsync(
        Guid id,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var document = await dbContext.AdminDocuments.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (document is null) return null;

        document.Status = "Archived";
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(actorUserId, actorName, "Evrak arşivlendi",
            "Document", nameof(AdminDocument), document.Id.ToString(), document.Title, cancellationToken);

        return Map(document);
    }

    private static AdminDocumentDto Map(AdminDocument item) => new(
        item.Id,
        item.Title,
        item.Category,
        item.Direction,
        item.DocumentNo,
        item.RelatedParty,
        item.FileUrl,
        item.ContentType,
        item.Status,
        item.Note,
        item.UploadedByName,
        item.ExpiryDateUtc,
        item.CreatedAtUtc);
}
