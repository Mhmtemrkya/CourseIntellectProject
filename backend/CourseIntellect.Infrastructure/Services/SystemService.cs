using CourseIntellect.Application.DTOs.System;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class SystemService(CourseIntellectDbContext dbContext) : ISystemService
{
    private const string MaintenanceModeKey = "system.maintenance_mode";
    private const string MaintenanceMessageKey = "system.maintenance_message";
    private const string MaintenanceSinceKey = "system.maintenance_since_utc";

    public async Task<SystemStatusDto> GetStatusAsync(CancellationToken cancellationToken = default)
    {
        var settings = await GetSettingsAsync(cancellationToken);
        var enabled = ParseBool(settings.GetValueOrDefault(MaintenanceModeKey));
        var message = settings.GetValueOrDefault(MaintenanceMessageKey);
        var since = ParseDate(settings.GetValueOrDefault(MaintenanceSinceKey));
        return new SystemStatusDto(enabled, message, since, DateTime.UtcNow);
    }

    public async Task<SystemStatusDto> SetMaintenanceAsync(UpdateMaintenanceRequest request, CancellationToken cancellationToken = default)
    {
        await UpsertAsync(MaintenanceModeKey, request.Enabled ? "true" : "false", "bool", "system", "Bakım modu açık/kapalı", cancellationToken);
        await UpsertAsync(MaintenanceMessageKey, request.Message ?? string.Empty, "string", "system", "Bakım modu mesajı", cancellationToken);

        if (request.Enabled)
        {
            await UpsertAsync(MaintenanceSinceKey, DateTime.UtcNow.ToString("o"), "datetime", "system", "Bakım modu başlama zamanı (UTC)", cancellationToken);
        }
        else
        {
            // Clear since timestamp when maintenance is turned off
            await UpsertAsync(MaintenanceSinceKey, string.Empty, "datetime", "system", "Bakım modu başlama zamanı (UTC)", cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return await GetStatusAsync(cancellationToken);
    }

    public async Task<bool> IsMaintenanceActiveAsync(CancellationToken cancellationToken = default)
    {
        var setting = await dbContext.AppSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Key == MaintenanceModeKey, cancellationToken);
        return ParseBool(setting?.Value);
    }

    private async Task<Dictionary<string, string>> GetSettingsAsync(CancellationToken cancellationToken)
    {
        var keys = new[] { MaintenanceModeKey, MaintenanceMessageKey, MaintenanceSinceKey };
        var rows = await dbContext.AppSettings
            .AsNoTracking()
            .Where(s => keys.Contains(s.Key))
            .ToListAsync(cancellationToken);
        return rows.ToDictionary(s => s.Key, s => s.Value);
    }

    private async Task UpsertAsync(string key, string value, string type, string category, string description, CancellationToken cancellationToken)
    {
        var existing = await dbContext.AppSettings.FirstOrDefaultAsync(s => s.Key == key, cancellationToken);
        if (existing is null)
        {
            dbContext.AppSettings.Add(new AppSetting
            {
                Key = key,
                Value = value,
                Type = type,
                Category = category,
                Description = description,
                UpdatedAtUtc = DateTime.UtcNow,
            });
        }
        else
        {
            existing.Value = value;
            existing.Type = type;
            existing.Category = category;
            existing.Description = description;
            existing.UpdatedAtUtc = DateTime.UtcNow;
        }
    }

    private static bool ParseBool(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return false;
        return string.Equals(raw, "true", StringComparison.OrdinalIgnoreCase) || raw == "1";
    }

    private static DateTime? ParseDate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        return DateTime.TryParse(raw, null, System.Globalization.DateTimeStyles.RoundtripKind, out var dt) ? dt : null;
    }
}
