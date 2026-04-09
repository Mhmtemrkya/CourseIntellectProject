using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CourseIntellect.Infrastructure.Persistence;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/classes")]
public sealed class ClassesController(CourseIntellectDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<string>>> GetList(CancellationToken cancellationToken)
    {
        var classes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void AddMany(IEnumerable<string?> values)
        {
            foreach (var value in values)
            {
                var normalized = CompatibilitySnapshotStore.NormalizeClassName(value);
                if (!string.IsNullOrWhiteSpace(normalized) && !string.Equals(normalized, "Tüm Sınıflar", StringComparison.OrdinalIgnoreCase))
                {
                    classes.Add(normalized);
                }
            }
        }

        AddMany(await dbContext.Students.AsNoTracking().Select(item => item.ClassName).ToListAsync(cancellationToken));
        AddMany(await dbContext.AttendanceEntries.AsNoTracking().Select(item => item.ClassName).ToListAsync(cancellationToken));
        AddMany(await dbContext.ExamResults.AsNoTracking().Select(item => item.ClassName).ToListAsync(cancellationToken));
        AddMany(await dbContext.HomeworkAssignments.AsNoTracking().Select(item => item.ClassName).ToListAsync(cancellationToken));
        AddMany(await dbContext.AccountingCollections.AsNoTracking().Select(item => item.ClassName).ToListAsync(cancellationToken));

        var targetJsons = await dbContext.QuestionBankItems
            .AsNoTracking()
            .Select(item => item.ClassTargetsSerialized)
            .ToListAsync(cancellationToken);

        foreach (var raw in targetJsons)
        {
            AddMany(CompatibilitySnapshotStore.DeserializeStringList(raw));
        }

        var plannedExams = await CompatibilitySnapshotStore.LoadListAsync<PlannedExamSnapshot>(dbContext, PlannedExamsController.SectionKey, cancellationToken);
        AddMany(plannedExams.Select(item => item.ClassName));

        var liveRooms = await CompatibilitySnapshotStore.LoadListAsync<LiveRoomSessionSnapshot>(dbContext, LiveRoomSessionsController.SectionKey, cancellationToken);
        AddMany(liveRooms.Select(item => item.ClassName));

        var ordered = classes
            .Where(item => !string.Equals(item, "Tüm Sınıflar", StringComparison.OrdinalIgnoreCase))
            .OrderBy(item => item, StringComparer.Create(new System.Globalization.CultureInfo("tr-TR"), false))
            .ToList();

        return Ok(ordered);
    }
}
