using System.Text;
using System.Text.Json;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/schedule")]
public sealed class ScheduleController(CourseIntellectDbContext dbContext) : ControllerBase
{
    // Controller seviyesinde sadece [Authorize] (tüm authenticated roller).
    // Yazma (POST/PUT/DELETE) sadece Admin/Administrative; okuma (GET) tüm
    // roller (Teacher/Student dahil) — ders programı tek doğruluk kaynağı.
    private const string ClassManagementConfigurationType = "class-management";
    private const string ClassRegistryConfigurationType = "class-registry";
    private const string LegacyConfigurationType = "class-schedule";
    private const string EntryConfigurationType = "class-schedule-entry";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly StringComparer ClassNameComparer = CreateClassNameComparer();
    private static readonly IReadOnlyDictionary<string, string[]> SubjectBranchAliases = new Dictionary<string, string[]>
    {
        ["matematik"] = new[] { "matematik" },
        ["fizik"] = new[] { "fizik" },
        ["kimya"] = new[] { "kimya" },
        ["biyoloji"] = new[] { "biyoloji" },
        ["turkce"] = new[] { "turkce", "edebiyat" },
        ["ingilizce"] = new[] { "ingilizce" },
        ["tarih"] = new[] { "tarih" },
        ["cografya"] = new[] { "cografya" },
    };

    [HttpGet]
    [Authorize(Roles = "Admin,Administrative,Teacher,Student")]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var tenantId = await ResolveTenantIdAsync(cancellationToken);
        if (!tenantId.HasValue)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Kurum bağlamı bulunamadı. Lütfen kurum hesabıyla tekrar giriş yapın." });
        }

        var entries = await LoadEntriesAsync(tenantId.Value, cancellationToken);
        return Ok(entries
            .OrderBy(item => item.ClassName, ClassNameComparer)
            .ThenBy(item => DayOrder(item.Day))
            .ThenBy(item => item.Time)
            .ToList());
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> Create([FromBody] UpsertScheduleEntryRequest request, CancellationToken cancellationToken)
    {
        var tenantId = await ResolveTenantIdAsync(cancellationToken);
        if (!tenantId.HasValue)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Kurum bağlamı bulunamadı. Lütfen kurum hesabıyla tekrar giriş yapın." });
        }

        try
        {
            var normalized = Normalize(request) with { Id = Guid.NewGuid().ToString("N"), IsReadOnly = false };
            var entries = await LoadEntriesAsync(tenantId.Value, cancellationToken);

            await ValidateTeacherBranchAsync(tenantId.Value, normalized, cancellationToken);
            ValidateConflicts(normalized, entries, normalized.Id);

            var entity = new PlatformConfiguration
            {
                TenantId = tenantId.Value,
                ConfigurationType = EntryConfigurationType,
                ScopeKey = normalized.Id,
                DisplayName = $"SCHEDULE::{normalized.ClassName}::{normalized.Day}::{normalized.Time}",
                PayloadJson = JsonSerializer.Serialize(normalized, JsonOptions),
                UpdatedAtUtc = DateTime.UtcNow,
            };

            await dbContext.PlatformConfigurations.AddAsync(entity, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Ok(normalized);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> Update(string id, [FromBody] UpsertScheduleEntryRequest request, CancellationToken cancellationToken)
    {
        var tenantId = await ResolveTenantIdAsync(cancellationToken);
        if (!tenantId.HasValue)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Kurum bağlamı bulunamadı. Lütfen kurum hesabıyla tekrar giriş yapın." });
        }

        var entity = await dbContext.PlatformConfigurations
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(item => item.TenantId == tenantId.Value && item.ConfigurationType == EntryConfigurationType && item.ScopeKey == id, cancellationToken);

        if (entity is null)
        {
            return NotFound(new { message = "Ders programı kaydı bulunamadı." });
        }

        try
        {
            var normalized = Normalize(request) with { Id = id.Trim(), IsReadOnly = false };
            var entries = await LoadEntriesAsync(tenantId.Value, cancellationToken);

            await ValidateTeacherBranchAsync(tenantId.Value, normalized, cancellationToken);
            ValidateConflicts(normalized, entries, normalized.Id);

            entity.TenantId = tenantId.Value;
            entity.DisplayName = $"SCHEDULE::{normalized.ClassName}::{normalized.Day}::{normalized.Time}";
            entity.PayloadJson = JsonSerializer.Serialize(normalized, JsonOptions);
            entity.UpdatedAtUtc = DateTime.UtcNow;

            await dbContext.SaveChangesAsync(cancellationToken);
            return Ok(normalized);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var tenantId = await ResolveTenantIdAsync(cancellationToken);
        if (!tenantId.HasValue)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Kurum bağlamı bulunamadı. Lütfen kurum hesabıyla tekrar giriş yapın." });
        }

        var entity = await dbContext.PlatformConfigurations
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(item => item.TenantId == tenantId.Value && item.ConfigurationType == EntryConfigurationType && item.ScopeKey == id, cancellationToken);

        if (entity is null)
        {
            return NotFound(new { message = "Silinecek ders programı kaydı bulunamadı." });
        }

        dbContext.PlatformConfigurations.Remove(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<List<ScheduleEntryDto>> LoadEntriesAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var validClasses = await LoadValidClassKeysAsync(tenantId, cancellationToken);
        if (validClasses.Count == 0)
        {
            return [];
        }

        var items = await dbContext.PlatformConfigurations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId)
            .Where(item => item.ConfigurationType == LegacyConfigurationType || item.ConfigurationType == EntryConfigurationType)
            .OrderBy(item => item.ConfigurationType)
            .ThenBy(item => item.ScopeKey)
            .ToListAsync(cancellationToken);

        var entries = new List<ScheduleEntryDto>();
        foreach (var item in items)
        {
            if (item.ConfigurationType == EntryConfigurationType)
            {
                var parsed = DeserializeEntry(item.PayloadJson);
                if (parsed is not null)
                {
                    entries.Add(parsed with { Id = item.ScopeKey.Trim(), IsReadOnly = false });
                }

                continue;
            }

            var legacyEntries = DeserializeLegacyEntries(item.PayloadJson);
            foreach (var legacyEntry in legacyEntries.Select((entry, index) => entry with
                     {
                         Id = $"legacy-{item.Id:N}-{index}",
                         IsReadOnly = true,
                     }))
            {
                entries.Add(legacyEntry);
            }
        }

        return entries
            .Where(item => validClasses.Contains(NormalizeText(item.ClassName)))
            .ToList();
    }

    private async Task<HashSet<string>> LoadValidClassKeysAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        var classes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void AddClass(string? value)
        {
            var normalized = CompatibilitySnapshotStore.NormalizeClassName(value);
            if (!string.IsNullOrWhiteSpace(normalized))
            {
                classes.Add(NormalizeText(normalized));
            }
        }

        var classConfigs = await dbContext.PlatformConfigurations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId)
            .Where(item => item.ConfigurationType == ClassManagementConfigurationType || item.ConfigurationType == ClassRegistryConfigurationType)
            .ToListAsync(cancellationToken);

        foreach (var item in classConfigs)
        {
            AddClass(ReadSavedClassName(item));
        }

        var studentClasses = await dbContext.Students
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId)
            .Select(item => item.ClassName)
            .ToListAsync(cancellationToken);

        foreach (var className in studentClasses)
        {
            AddClass(className);
        }

        return classes;
    }

    private static string? ReadSavedClassName(PlatformConfiguration item)
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

    private async Task ValidateTeacherBranchAsync(Guid tenantId, ScheduleEntryDto candidate, CancellationToken cancellationToken)
    {
        var teachers = await dbContext.Staff
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId && item.Role == UserRole.Teacher)
            .Select(item => new { item.FullName, item.DepartmentOrBranch })
            .ToListAsync(cancellationToken);

        var teacher = teachers.FirstOrDefault(item => NormalizeBranchText(item.FullName) == NormalizeBranchText(candidate.Teacher));
        if (teacher is null)
        {
            throw new InvalidOperationException("Seçilen öğretmen kurum öğretmenleri arasında bulunamadı.");
        }

        if (!BranchMatchesSubject(teacher.DepartmentOrBranch, candidate.Subject))
        {
            throw new InvalidOperationException($"{teacher.FullName} öğretmeninin branşı {teacher.DepartmentOrBranch}; {candidate.Subject} dersine atanamaz.");
        }
    }

    private static bool BranchMatchesSubject(string? branch, string? subject)
    {
        var normalizedBranch = NormalizeBranchText(branch);
        var normalizedSubject = NormalizeBranchText(subject);
        if (string.IsNullOrWhiteSpace(normalizedBranch) || string.IsNullOrWhiteSpace(normalizedSubject))
        {
            return false;
        }

        if (!SubjectBranchAliases.TryGetValue(normalizedSubject, out var aliases))
        {
            aliases = new[] { normalizedSubject };
        }

        return aliases.Any(alias => normalizedBranch.Contains(alias, StringComparison.OrdinalIgnoreCase));
    }

    private static string NormalizeBranchText(string? value)
    {
        var normalized = (value ?? string.Empty).Normalize(NormalizationForm.FormD);
        return string.Concat(normalized
            .Where(ch => CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
            .Select(ch => ch switch
            {
                '\u0130' => 'i',
                '\u0131' => 'i',
                _ => char.ToLowerInvariant(ch),
            })
            .Where(char.IsLetterOrDigit));
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

    private static ScheduleEntryDto? DeserializeEntry(string payloadJson)
    {
        try
        {
            return JsonSerializer.Deserialize<ScheduleEntryDto>(payloadJson, JsonOptions);
        }
        catch
        {
            return null;
        }
    }

    private static IReadOnlyList<ScheduleEntryDto> DeserializeLegacyEntries(string payloadJson)
    {
        try
        {
            var document = JsonDocument.Parse(payloadJson);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            var results = new List<ScheduleEntryDto>();
            foreach (var item in document.RootElement.EnumerateArray())
            {
                var className = item.TryGetProperty("className", out var classNameProp) ? classNameProp.GetString() : null;
                var day = item.TryGetProperty("day", out var dayProp) ? dayProp.GetString() : null;
                var time = item.TryGetProperty("time", out var timeProp) ? timeProp.GetString() : null;
                var subject = item.TryGetProperty("subject", out var subjectProp) ? subjectProp.GetString() : null;
                var teacher = item.TryGetProperty("teacher", out var teacherProp) ? teacherProp.GetString() : null;
                var room = item.TryGetProperty("room", out var roomProp) ? roomProp.GetString() : null;

                if (string.IsNullOrWhiteSpace(className) || string.IsNullOrWhiteSpace(day) || string.IsNullOrWhiteSpace(time))
                {
                    continue;
                }

                results.Add(new ScheduleEntryDto(
                    Id: string.Empty,
                    ClassName: className.Trim(),
                    Day: day.Trim(),
                    Time: time.Trim(),
                    Subject: string.IsNullOrWhiteSpace(subject) ? "Ders" : subject.Trim(),
                    Teacher: string.IsNullOrWhiteSpace(teacher) ? "Öğretmen" : teacher.Trim(),
                    Room: string.IsNullOrWhiteSpace(room) ? "Derslik" : room.Trim(),
                    IsReadOnly: true
                ));
            }

            return results;
        }
        catch
        {
            return [];
        }
    }

    private static ScheduleEntryDto Normalize(UpsertScheduleEntryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ClassName) ||
            string.IsNullOrWhiteSpace(request.Day) ||
            string.IsNullOrWhiteSpace(request.Time) ||
            string.IsNullOrWhiteSpace(request.Subject) ||
            string.IsNullOrWhiteSpace(request.Teacher))
        {
            throw new InvalidOperationException("Sınıf, gün, saat, ders ve öğretmen alanları zorunludur.");
        }

        return new ScheduleEntryDto(
            Id: string.Empty,
            ClassName: request.ClassName.Trim(),
            Day: request.Day.Trim(),
            Time: request.Time.Trim(),
            Subject: request.Subject.Trim(),
            Teacher: request.Teacher.Trim(),
            Room: string.IsNullOrWhiteSpace(request.Room) ? "Derslik" : request.Room.Trim(),
            IsReadOnly: false
        );
    }

    private static void ValidateConflicts(ScheduleEntryDto candidate, IReadOnlyList<ScheduleEntryDto> entries, string currentId)
    {
        foreach (var item in entries.Where(item => !string.Equals(item.Id, currentId, StringComparison.OrdinalIgnoreCase)))
        {
            var sameSlot = string.Equals(item.Day, candidate.Day, StringComparison.OrdinalIgnoreCase)
                           && string.Equals(item.Time, candidate.Time, StringComparison.OrdinalIgnoreCase);

            if (!sameSlot)
            {
                continue;
            }

            if (NormalizeText(item.ClassName) == NormalizeText(candidate.ClassName))
            {
                throw new InvalidOperationException($"{candidate.ClassName} sınıfı için {candidate.Day} {candidate.Time} saatinde zaten başka bir ders var.");
            }

            if (NormalizeText(item.Teacher) == NormalizeText(candidate.Teacher))
            {
                throw new InvalidOperationException($"{candidate.Teacher} öğretmeni {candidate.Day} {candidate.Time} saatinde başka bir sınıfa atanmış.");
            }
        }
    }

    private static string NormalizeText(string? value)
    {
        return string.Concat((value ?? string.Empty)
            .Trim()
            .ToLowerInvariant()
            .Where(ch => !char.IsWhiteSpace(ch) && ch != '-'));
    }

    private static int DayOrder(string day) => day switch
    {
        "Pazartesi" => 1,
        "Salı" => 2,
        "Çarşamba" => 3,
        "Perşembe" => 4,
        "Cuma" => 5,
        "Cumartesi" => 6,
        "Pazar" => 7,
        _ => 99,
    };

    public sealed record UpsertScheduleEntryRequest(
        string ClassName,
        string Day,
        string Time,
        string Subject,
        string Teacher,
        string? Room
    );

    public sealed record ScheduleEntryDto(
        string Id,
        string ClassName,
        string Day,
        string Time,
        string Subject,
        string Teacher,
        string Room,
        bool IsReadOnly
    );
}
