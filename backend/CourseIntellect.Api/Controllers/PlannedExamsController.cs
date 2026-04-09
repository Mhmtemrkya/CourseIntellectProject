using System.Text.Json;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/plannedexams")]
public sealed class PlannedExamsController(CourseIntellectDbContext dbContext) : ControllerBase
{
    public const string SectionKey = "planned-exams";

    [HttpGet]
    public async Task<IActionResult> GetList(
        [FromQuery] string? className = null,
        [FromQuery] string? teacherName = null,
        [FromQuery] string? studentName = null,
        [FromQuery] string? studentUsername = null,
        CancellationToken cancellationToken = default)
    {
        var items = await CompatibilitySnapshotStore.LoadListAsync<PlannedExamSnapshot>(dbContext, SectionKey, cancellationToken);
        items = items
            .OrderBy(item => CompatibilitySnapshotStore.ParseDateLabel(item.DateLabel))
            .ThenByDescending(item => item.CreatedAtUtc)
            .ToList();

        if (!string.IsNullOrWhiteSpace(className))
        {
            var normalizedClass = CompatibilitySnapshotStore.NormalizeText(className);
            items = items.Where(item => CompatibilitySnapshotStore.NormalizeText(item.ClassName) == normalizedClass).ToList();
        }

        if (!string.IsNullOrWhiteSpace(teacherName))
        {
            var normalizedTeacher = CompatibilitySnapshotStore.NormalizeText(teacherName);
            items = items.Where(item => CompatibilitySnapshotStore.NormalizeText(item.TeacherName) == normalizedTeacher).ToList();
        }

        if ((!string.IsNullOrWhiteSpace(studentName) || !string.IsNullOrWhiteSpace(studentUsername)) && string.IsNullOrWhiteSpace(className))
        {
            var users = await dbContext.Users.AsNoTracking().ToDictionaryAsync(item => item.Id, cancellationToken);
            var studentProfiles = await dbContext.Students.AsNoTracking().ToListAsync(cancellationToken);
            var students = studentProfiles.Select(item => new
            {
                item.FullName,
                Username = users.TryGetValue(item.UserId, out var user) ? user.Username : string.Empty,
                item.ClassName,
            }).ToList();

            var normalizedStudent = CompatibilitySnapshotStore.NormalizeText(studentName);
            var normalizedUsername = CompatibilitySnapshotStore.NormalizeText(studentUsername);
            var matchedClass = students
                .FirstOrDefault(item =>
                    (!string.IsNullOrWhiteSpace(normalizedStudent) && CompatibilitySnapshotStore.NormalizeText(item.FullName) == normalizedStudent) ||
                    (!string.IsNullOrWhiteSpace(normalizedUsername) && CompatibilitySnapshotStore.NormalizeText(item.Username) == normalizedUsername))
                ?.ClassName;

            if (!string.IsNullOrWhiteSpace(matchedClass))
            {
                var normalizedResolvedClass = CompatibilitySnapshotStore.NormalizeText(matchedClass);
                items = items.Where(item => CompatibilitySnapshotStore.NormalizeText(item.ClassName) == normalizedResolvedClass).ToList();
            }
        }

        return Ok(items.Select(MapResponse).ToList());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PlannedExamCreateRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title) ||
            string.IsNullOrWhiteSpace(request.Type) ||
            string.IsNullOrWhiteSpace(request.ClassName) ||
            string.IsNullOrWhiteSpace(request.Subject) ||
            string.IsNullOrWhiteSpace(request.DateLabel) ||
            string.IsNullOrWhiteSpace(request.Duration))
        {
            return BadRequest(new { message = "Başlık, tür, sınıf, ders, tarih ve süre zorunludur." });
        }

        var items = await CompatibilitySnapshotStore.LoadListAsync<PlannedExamSnapshot>(dbContext, SectionKey, cancellationToken);
        var item = new PlannedExamSnapshot
        {
            Id = Guid.NewGuid(),
            Title = request.Title.Trim(),
            Type = request.Type.Trim(),
            ClassName = request.ClassName.Trim(),
            Subject = request.Subject.Trim(),
            DateLabel = request.DateLabel.Trim(),
            Duration = request.Duration.Trim(),
            QuestionCount = request.QuestionCount,
            Status = "Planlandı",
            TeacherName = request.TeacherName?.Trim() ?? "Öğretmen",
            SourceType = string.IsNullOrWhiteSpace(request.SourceType) ? "Manuel Ekle" : request.SourceType.Trim(),
            Sources = (request.Sources ?? []).Select(item => new PlannedExamSourceSnapshot
            {
                QuestionId = item.QuestionId,
                Title = item.Title?.Trim() ?? string.Empty,
                Type = item.Type?.Trim() ?? string.Empty,
                Subject = item.Subject?.Trim(),
                ImagePath = item.ImagePath?.Trim(),
                ImagePlacement = item.ImagePlacement?.Trim(),
            }).ToList(),
            CreatedAtUtc = DateTime.UtcNow,
        };

        items.Add(item);
        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, items, item.TeacherName, cancellationToken);
        return Ok(MapResponse(item));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var items = await CompatibilitySnapshotStore.LoadListAsync<PlannedExamSnapshot>(dbContext, SectionKey, cancellationToken);
        var removed = items.RemoveAll(item => item.Id == id);
        if (removed == 0)
        {
            return NotFound();
        }

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, items, User.Identity?.Name ?? "system", cancellationToken);
        return NoContent();
    }

    [HttpGet("{id:guid}/submissions")]
    public async Task<IActionResult> GetSubmissions(Guid id, CancellationToken cancellationToken)
    {
        var items = await CompatibilitySnapshotStore.LoadListAsync<PlannedExamSnapshot>(dbContext, SectionKey, cancellationToken);
        var plannedExam = items.FirstOrDefault(item => item.Id == id);
        if (plannedExam is null)
        {
            return NotFound();
        }

        var normalizedTitle = CompatibilitySnapshotStore.NormalizeText(plannedExam.Title);
        var normalizedClass = CompatibilitySnapshotStore.NormalizeText(plannedExam.ClassName);
        var normalizedSubject = CompatibilitySnapshotStore.NormalizeText(plannedExam.Subject);

        var results = await dbContext.ExamResults
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var response = results
            .Where(item =>
                CompatibilitySnapshotStore.NormalizeText(item.ExamTitle) == normalizedTitle &&
                CompatibilitySnapshotStore.NormalizeText(item.ClassName) == normalizedClass &&
                CompatibilitySnapshotStore.NormalizeText(item.Subject) == normalizedSubject)
            .OrderByDescending(item => CompatibilitySnapshotStore.ParseDateLabel(item.DateLabel))
            .Select(item => new
            {
                id = item.Id,
                studentName = item.StudentName,
                score = item.Score,
                net = item.Net,
                submittedAtUtc = CompatibilitySnapshotStore.ParseDateLabel(item.DateLabel),
                status = "Teslim Edildi",
            })
            .ToList();

        return Ok(response);
    }

    private static object MapResponse(PlannedExamSnapshot item)
    {
        return new
        {
            id = item.Id,
            title = item.Title,
            type = item.Type,
            className = item.ClassName,
            subject = item.Subject,
            date = item.DateLabel,
            dateLabel = item.DateLabel,
            duration = item.Duration,
            questionCount = item.QuestionCount,
            status = item.Status,
            teacherName = item.TeacherName,
            sourceType = item.SourceType,
            sources = item.Sources.Select(source => new
            {
                questionId = source.QuestionId,
                title = source.Title,
                type = source.Type,
                subject = source.Subject,
                imagePath = source.ImagePath,
                imagePlacement = source.ImagePlacement,
            }).ToList(),
        };
    }
}

public sealed class PlannedExamCreateRequest
{
    public string Title { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string DateLabel { get; set; } = string.Empty;
    public string Duration { get; set; } = string.Empty;
    public int QuestionCount { get; set; }
    public string? TeacherName { get; set; }
    public string? SourceType { get; set; }
    public List<PlannedExamSourceRequest>? Sources { get; set; }
}

public sealed class PlannedExamSourceRequest
{
    public Guid? QuestionId { get; set; }
    public string? Title { get; set; }
    public string? Type { get; set; }
    public string? Subject { get; set; }
    public string? ImagePath { get; set; }
    public string? ImagePlacement { get; set; }
}

public sealed class PlannedExamSnapshot
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string DateLabel { get; set; } = string.Empty;
    public string Duration { get; set; } = string.Empty;
    public int QuestionCount { get; set; }
    public string Status { get; set; } = "Planlandı";
    public string TeacherName { get; set; } = string.Empty;
    public string SourceType { get; set; } = string.Empty;
    public List<PlannedExamSourceSnapshot> Sources { get; set; } = [];
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class PlannedExamSourceSnapshot
{
    public Guid? QuestionId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string? Subject { get; set; }
    public string? ImagePath { get; set; }
    public string? ImagePlacement { get; set; }
}
