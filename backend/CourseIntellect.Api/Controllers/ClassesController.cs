using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/classes")]
public sealed class ClassesController(
    CourseIntellectDbContext dbContext,
    ILogger<ClassesController> logger) : ControllerBase
{
    private const string ClassRegistryConfigurationType = "class-registry";
    private const string ClassManagementConfigurationType = "class-management";
    private static readonly StringComparer ClassNameComparer = CreateClassNameComparer();

    [HttpGet]
    public async Task<ActionResult<List<string>>> GetList(CancellationToken cancellationToken)
    {
        var tenantId = await ResolveTenantIdAsync(cancellationToken);
        if (!tenantId.HasValue)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Kurum bağlamı bulunamadı. Lütfen kurum hesabıyla tekrar giriş yapın." });
        }

        var classes = await LoadClassListAsync(tenantId.Value, cancellationToken);
        return Ok(classes);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<ActionResult<object>> Create([FromBody] CreateClassRequest request, CancellationToken cancellationToken)
    {
        var tenantId = await ResolveTenantIdAsync(cancellationToken);
        if (!tenantId.HasValue)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Kurum bağlamı bulunamadı. Lütfen kurum hesabıyla tekrar giriş yapın." });
        }

        var normalized = CompatibilitySnapshotStore.NormalizeClassName(request.Name);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return BadRequest(new { message = "Sınıf adı zorunludur." });
        }

        var existingClasses = await LoadClassListAsync(tenantId.Value, cancellationToken);
        if (existingClasses.Any(item => string.Equals(item, normalized, StringComparison.OrdinalIgnoreCase)))
        {
            return Conflict(new { message = "Bu sınıf zaten kayıtlı." });
        }

        var entity = new CourseIntellect.Domain.Entities.PlatformConfiguration
        {
            TenantId = tenantId.Value,
            ConfigurationType = ClassRegistryConfigurationType,
            ScopeKey = Guid.NewGuid().ToString("N"),
            DisplayName = normalized,
            PayloadJson = JsonSerializer.Serialize(new { name = normalized }),
            UpdatedAtUtc = DateTime.UtcNow,
        };

        await dbContext.PlatformConfigurations.AddAsync(entity, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { name = normalized });
    }

    private async Task<List<string>> LoadClassListAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var classes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void AddMany(IEnumerable<string?> values)
        {
            foreach (var value in values)
            {
                var normalized = CompatibilitySnapshotStore.NormalizeClassName(value);
                if (!string.IsNullOrWhiteSpace(normalized) && !IsAllClassesLabel(normalized))
                {
                    classes.Add(normalized);
                }
            }
        }

        var savedClassConfigs = await dbContext.PlatformConfigurations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId)
            .Where(item => item.ConfigurationType == ClassManagementConfigurationType || item.ConfigurationType == ClassRegistryConfigurationType)
            .OrderBy(item => item.ConfigurationType)
            .ThenBy(item => item.ScopeKey)
            .ToListAsync(cancellationToken);

        foreach (var item in savedClassConfigs)
        {
            AddMany([ReadSavedClassName(item)]);
        }

        AddMany(await dbContext.Students
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId)
            .Select(item => (string?)item.ClassName)
            .ToListAsync(cancellationToken));

        if (classes.Count == 0)
        {
            logger.LogInformation("Class list returned empty for tenant {TenantId}.", tenantId);
        }

        return classes
            .OrderBy(item => item, ClassNameComparer)
            .ToList();
    }

    private async Task<Guid?> ResolveTenantIdAsync(CancellationToken cancellationToken)
    {
        var tenantRaw = User.FindFirstValue("tenant_id");
        if (Guid.TryParse(tenantRaw, out var tenantId))
        {
            return tenantId;
        }

        var userRaw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userRaw, out var userId))
        {
            return null;
        }

        return await dbContext.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => user.TenantId)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static string? ReadSavedClassName(CourseIntellect.Domain.Entities.PlatformConfiguration item)
    {
        if (string.Equals(item.ConfigurationType, ClassRegistryConfigurationType, StringComparison.OrdinalIgnoreCase))
        {
            return item.DisplayName;
        }

        try
        {
            using var document = JsonDocument.Parse(item.PayloadJson);
            if (document.RootElement.TryGetProperty("name", out var nameProperty))
            {
                return nameProperty.GetString();
            }
        }
        catch
        {
            // Fall back to DisplayName parsing below.
        }

        const string prefix = "CLASS_MANAGEMENT::";
        return item.DisplayName.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
            ? item.DisplayName[prefix.Length..]
            : item.ScopeKey;
    }

    private static StringComparer CreateClassNameComparer()
    {
        try
        {
            return StringComparer.Create(CultureInfo.GetCultureInfo("tr-TR"), false);
        }
        catch (CultureNotFoundException)
        {
            return StringComparer.InvariantCultureIgnoreCase;
        }
    }

    private static bool IsAllClassesLabel(string value)
    {
        var folded = value
            .Normalize(NormalizationForm.FormD)
            .Where(ch => CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
            .Select(ch => ch is '\u0131' or '\u0130' ? 'i' : char.ToLowerInvariant(ch));

        var compact = string.Concat(folded)
            .Replace(" ", string.Empty, StringComparison.Ordinal)
            .Replace("-", string.Empty, StringComparison.Ordinal);

        return string.Equals(compact, "tumsiniflar", StringComparison.OrdinalIgnoreCase);
    }

    public sealed record CreateClassRequest(string Name);
}
