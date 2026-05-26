using System.Security.Claims;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/cafeteria")]
public sealed class CafeteriaController(CourseIntellectDbContext dbContext) : ControllerBase
{
    private const string SectionKey = "cafeteria-weekly-menus";
    private const string ViewRoles = "Cafeteria,Admin,Administrative,Student,Parent";
    private const string EditRoles = "Cafeteria,Admin,Administrative";
    private static readonly string[] MealTypes = ["Breakfast", "Lunch"];

    [HttpGet("week")]
    [Authorize(Roles = ViewRoles)]
    public async Task<IActionResult> GetWeek([FromQuery] DateOnly? weekStart, CancellationToken cancellationToken)
    {
        var monday = NormalizeMonday(weekStart ?? DateOnly.FromDateTime(DateTime.Today));
        var weeks = await CompatibilitySnapshotStore.LoadListAsync<CafeteriaWeekSnapshot>(
            dbContext,
            SectionKey,
            cancellationToken);
        var result = weeks.FirstOrDefault(item => item.WeekStart == monday) ?? CreateEmptyWeek(monday);
        return Ok(result);
    }

    [HttpGet("weeks")]
    [Authorize(Roles = EditRoles)]
    public async Task<IActionResult> GetWeeks(CancellationToken cancellationToken)
    {
        var weeks = await CompatibilitySnapshotStore.LoadListAsync<CafeteriaWeekSnapshot>(
            dbContext,
            SectionKey,
            cancellationToken);
        return Ok(weeks.OrderByDescending(item => item.WeekStart).Take(52).ToList());
    }

    [HttpPost("weeks")]
    [Authorize(Roles = EditRoles)]
    public async Task<IActionResult> SaveWeek(
        [FromBody] CafeteriaWeekRequest request,
        CancellationToken cancellationToken)
    {
        var error = Validate(request);
        if (error is not null)
        {
            return BadRequest(new { message = error });
        }

        var monday = NormalizeMonday(request.WeekStart);
        var weeks = await CompatibilitySnapshotStore.LoadListAsync<CafeteriaWeekSnapshot>(
            dbContext,
            SectionKey,
            cancellationToken);
        var week = weeks.FirstOrDefault(item => item.WeekStart == monday);
        if (week is null)
        {
            week = CreateEmptyWeek(monday);
            weeks.Add(week);
        }

        week.Note = (request.Note ?? string.Empty).Trim();
        week.Meals = BuildMeals(monday, request.Meals);
        week.UpdatedAtUtc = DateTime.UtcNow;
        week.UpdatedBy = ResolveUsername();

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, weeks, week.UpdatedBy, cancellationToken);
        return Ok(week);
    }

    private static string? Validate(CafeteriaWeekRequest request)
    {
        if (request.WeekStart == default)
        {
            return "Hafta başlangıcı zorunludur.";
        }

        foreach (var meal in request.Meals ?? [])
        {
            if (!MealTypes.Contains(meal.MealType, StringComparer.OrdinalIgnoreCase))
            {
                return "Öğün türü Breakfast veya Lunch olmalıdır.";
            }

            if (meal.Calories < 0 ||
                meal.ProteinGrams < 0 ||
                meal.CarbohydrateGrams < 0 ||
                meal.FatGrams < 0 ||
                meal.FiberGrams < 0)
            {
                return "Besin değerleri negatif olamaz.";
            }
        }

        return null;
    }

    private static CafeteriaWeekSnapshot CreateEmptyWeek(DateOnly monday)
    {
        return new CafeteriaWeekSnapshot
        {
            Id = Guid.NewGuid(),
            WeekStart = monday,
            WeekEnd = monday.AddDays(6),
            Meals = BuildMeals(monday, []),
        };
    }

    private static List<CafeteriaMealEntry> BuildMeals(DateOnly monday, IEnumerable<CafeteriaMealEntryRequest> submitted)
    {
        var byCell = submitted
            .Where(item => item.Date >= monday && item.Date <= monday.AddDays(6))
            .GroupBy(item => $"{item.Date:yyyy-MM-dd}|{item.MealType}", StringComparer.OrdinalIgnoreCase)
            .ToDictionary(item => item.Key, item => item.Last(), StringComparer.OrdinalIgnoreCase);
        var result = new List<CafeteriaMealEntry>();

        for (var offset = 0; offset < 7; offset++)
        {
            var date = monday.AddDays(offset);
            foreach (var mealType in MealTypes)
            {
                byCell.TryGetValue($"{date:yyyy-MM-dd}|{mealType}", out var meal);
                result.Add(new CafeteriaMealEntry
                {
                    Date = date,
                    MealType = mealType,
                    StartTime = string.IsNullOrWhiteSpace(meal?.StartTime)
                        ? mealType == "Breakfast" ? "07:30" : "12:30"
                        : meal.StartTime.Trim(),
                    EndTime = string.IsNullOrWhiteSpace(meal?.EndTime)
                        ? mealType == "Breakfast" ? "09:30" : "14:00"
                        : meal.EndTime.Trim(),
                    Items = meal?.Items?
                        .Where(item => !string.IsNullOrWhiteSpace(item))
                        .Select(item => item.Trim())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList() ?? [],
                    Calories = meal?.Calories ?? 0,
                    ProteinGrams = meal?.ProteinGrams ?? 0,
                    CarbohydrateGrams = meal?.CarbohydrateGrams ?? 0,
                    FatGrams = meal?.FatGrams ?? 0,
                    FiberGrams = meal?.FiberGrams ?? 0,
                    Allergens = meal?.Allergens?
                        .Where(item => !string.IsNullOrWhiteSpace(item))
                        .Select(item => item.Trim())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList() ?? [],
                    Description = (meal?.Description ?? string.Empty).Trim(),
                });
            }
        }

        return result;
    }

    private static DateOnly NormalizeMonday(DateOnly date)
    {
        var offset = ((int)date.DayOfWeek + 6) % 7;
        return date.AddDays(-offset);
    }

    private string ResolveUsername() =>
        User.FindFirstValue("unique_name")
        ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.Identity?.Name
        ?? "cafeteria";
}

public sealed class CafeteriaWeekRequest
{
    public DateOnly WeekStart { get; set; }
    public string? Note { get; set; }
    public List<CafeteriaMealEntryRequest> Meals { get; set; } = [];
}

public sealed class CafeteriaMealEntryRequest
{
    public DateOnly Date { get; set; }
    public string MealType { get; set; } = string.Empty;
    public string StartTime { get; set; } = string.Empty;
    public string EndTime { get; set; } = string.Empty;
    public List<string> Items { get; set; } = [];
    public int Calories { get; set; }
    public decimal ProteinGrams { get; set; }
    public decimal CarbohydrateGrams { get; set; }
    public decimal FatGrams { get; set; }
    public decimal FiberGrams { get; set; }
    public List<string> Allergens { get; set; } = [];
    public string? Description { get; set; }
}

public sealed class CafeteriaMealEntry
{
    public DateOnly Date { get; set; }
    public string MealType { get; set; } = string.Empty;
    public string StartTime { get; set; } = string.Empty;
    public string EndTime { get; set; } = string.Empty;
    public List<string> Items { get; set; } = [];
    public int Calories { get; set; }
    public decimal ProteinGrams { get; set; }
    public decimal CarbohydrateGrams { get; set; }
    public decimal FatGrams { get; set; }
    public decimal FiberGrams { get; set; }
    public List<string> Allergens { get; set; } = [];
    public string Description { get; set; } = string.Empty;
}

public sealed class CafeteriaWeekSnapshot
{
    public Guid Id { get; set; }
    public DateOnly WeekStart { get; set; }
    public DateOnly WeekEnd { get; set; }
    public string Note { get; set; } = string.Empty;
    public List<CafeteriaMealEntry> Meals { get; set; } = [];
    public string UpdatedBy { get; set; } = string.Empty;
    public DateTime? UpdatedAtUtc { get; set; }
}
