using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class OrgUnitService(
    CourseIntellectDbContext dbContext,
    IAuditLogService auditLogService) : IOrgUnitService
{
    public async Task<IReadOnlyList<OrgUnitDto>> GetAsync(CancellationToken cancellationToken = default)
    {
        return await dbContext.OrgUnits.AsNoTracking()
            .OrderBy(item => item.UnitType)
            .ThenBy(item => item.Name)
            .Select(item => Map(item))
            .ToListAsync(cancellationToken);
    }

    public async Task<OrgUnitDto> CreateAsync(
        CreateOrgUnitRequest request,
        Guid? actorUserId,
        string actorName,
        CancellationToken cancellationToken = default)
    {
        var unit = new OrgUnit
        {
            Name = request.Name.Trim(),
            UnitType = string.IsNullOrWhiteSpace(request.UnitType) ? "Birim" : request.UnitType.Trim(),
            ParentUnitId = request.ParentUnitId,
            ManagerName = request.ManagerName?.Trim() ?? string.Empty,
            Note = request.Note?.Trim() ?? string.Empty,
            CreatedAtUtc = DateTime.UtcNow,
        };
        await dbContext.OrgUnits.AddAsync(unit, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(actorUserId, actorName, "Birim eklendi",
            "OrgUnit", nameof(OrgUnit), unit.Id.ToString(), $"{unit.UnitType}: {unit.Name}", cancellationToken);

        return Map(unit);
    }

    public async Task<OrgUnitDto?> UpdateAsync(
        Guid id,
        UpdateOrgUnitRequest request,
        CancellationToken cancellationToken = default)
    {
        var unit = await dbContext.OrgUnits.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (unit is null) return null;

        unit.Name = request.Name.Trim();
        unit.UnitType = string.IsNullOrWhiteSpace(request.UnitType) ? unit.UnitType : request.UnitType.Trim();
        // Kendini parent yapmayı engelle.
        unit.ParentUnitId = request.ParentUnitId == id ? null : request.ParentUnitId;
        unit.ManagerName = request.ManagerName?.Trim() ?? string.Empty;
        unit.Note = request.Note?.Trim() ?? string.Empty;
        await dbContext.SaveChangesAsync(cancellationToken);
        return Map(unit);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var unit = await dbContext.OrgUnits.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (unit is null) return false;

        // Alt birimleri köke taşı (yetim bırakma).
        var children = await dbContext.OrgUnits.Where(item => item.ParentUnitId == id).ToListAsync(cancellationToken);
        foreach (var child in children) child.ParentUnitId = null;

        dbContext.OrgUnits.Remove(unit);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static OrgUnitDto Map(OrgUnit item) => new(
        item.Id,
        item.Name,
        item.UnitType,
        item.ParentUnitId,
        item.ManagerName,
        item.Note,
        item.CreatedAtUtc);
}
