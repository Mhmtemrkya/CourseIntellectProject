using System.Text.Json;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Administrative")]
[Route("api/schedule")]
public sealed class ScheduleController(CourseIntellectDbContext dbContext) : ControllerBase
{
    private const string LegacyConfigurationType = "class-schedule";
    private const string EntryConfigurationType = "class-schedule-entry";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var entries = await LoadEntriesAsync(cancellationToken);
        return Ok(entries
            .OrderBy(item => item.ClassName, StringComparer.Create(new System.Globalization.CultureInfo("tr-TR"), false))
            .ThenBy(item => DayOrder(item.Day))
            .ThenBy(item => item.Time)
            .ToList());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertScheduleEntryRequest request, CancellationToken cancellationToken)
    {
        var normalized = Normalize(request) with { Id = Guid.NewGuid().ToString("N"), IsReadOnly = false };
        var entries = await LoadEntriesAsync(cancellationToken);

        ValidateConflicts(normalized, entries, normalized.Id);

        var entity = new PlatformConfiguration
        {
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

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] UpsertScheduleEntryRequest request, CancellationToken cancellationToken)
    {
        var entity = await dbContext.PlatformConfigurations
            .FirstOrDefaultAsync(item => item.ConfigurationType == EntryConfigurationType && item.ScopeKey == id, cancellationToken);

        if (entity is null)
        {
            return NotFound(new { message = "Ders programı kaydı bulunamadı." });
        }

        var normalized = Normalize(request) with { Id = id.Trim(), IsReadOnly = false };
        var entries = await LoadEntriesAsync(cancellationToken);

        ValidateConflicts(normalized, entries, normalized.Id);

        entity.DisplayName = $"SCHEDULE::{normalized.ClassName}::{normalized.Day}::{normalized.Time}";
        entity.PayloadJson = JsonSerializer.Serialize(normalized, JsonOptions);
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(normalized);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken cancellationToken)
    {
        var entity = await dbContext.PlatformConfigurations
            .FirstOrDefaultAsync(item => item.ConfigurationType == EntryConfigurationType && item.ScopeKey == id, cancellationToken);

        if (entity is null)
        {
            return NotFound(new { message = "Silinecek ders programı kaydı bulunamadı." });
        }

        dbContext.PlatformConfigurations.Remove(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<List<ScheduleEntryDto>> LoadEntriesAsync(CancellationToken cancellationToken)
    {
        var items = await dbContext.PlatformConfigurations
            .AsNoTracking()
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

        return entries;
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
