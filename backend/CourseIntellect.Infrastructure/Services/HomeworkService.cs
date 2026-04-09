using System.Text.Json;
using CourseIntellect.Application.DTOs.Homework;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class HomeworkService(CourseIntellectDbContext dbContext) : IHomeworkService
{
    public async Task<IReadOnlyList<HomeworkAssignmentDto>> GetAssignmentsAsync(CancellationToken cancellationToken = default)
    {
        var assignments = await dbContext.Set<HomeworkAssignment>()
            .OrderByDescending(x => x.Id)
            .ToListAsync(cancellationToken);

        var ids = assignments.Select(x => x.Id).ToList();
        var submissions = await dbContext.Set<HomeworkSubmission>()
            .Where(x => ids.Contains(x.AssignmentId))
            .OrderByDescending(x => x.Id)
            .ToListAsync(cancellationToken);

        return assignments
            .Select(item => ToDto(item, submissions.Where(x => x.AssignmentId == item.Id).ToList()))
            .ToList();
    }

    public async Task<HomeworkAssignmentDto> CreateAssignmentAsync(CreateHomeworkAssignmentRequest request, CancellationToken cancellationToken = default)
    {
        var entity = new HomeworkAssignment
        {
            Title = request.Title.Trim(),
            ClassName = request.ClassName.Trim(),
            Subject = string.IsNullOrWhiteSpace(request.Subject) ? "Matematik" : request.Subject.Trim(),
            Teacher = string.IsNullOrWhiteSpace(request.Teacher) ? "Hasan Yildiz" : request.Teacher.Trim(),
            DeadlineLabel = request.Deadline.Trim(),
            Description = request.Description.Trim(),
            MaterialsSerialized = JsonSerializer.Serialize((request.Materials ?? []).Where(x => !string.IsNullOrWhiteSpace(x)).ToList()),
            CreatedAtLabel = BuildDateLabel(),
        };

        await dbContext.Set<HomeworkAssignment>().AddAsync(entity, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(entity, []);
    }

    public async Task<bool> DeleteAssignmentAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.Set<HomeworkAssignment>().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return false;

        var submissions = await dbContext.Set<HomeworkSubmission>().Where(x => x.AssignmentId == id).ToListAsync(cancellationToken);
        dbContext.Set<HomeworkSubmission>().RemoveRange(submissions);
        dbContext.Set<HomeworkAssignment>().Remove(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<HomeworkAssignmentDto?> SubmitAssignmentAsync(Guid id, CreateHomeworkSubmissionRequest request, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.Set<HomeworkAssignment>().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return null;

        var existing = await dbContext.Set<HomeworkSubmission>()
            .FirstOrDefaultAsync(x => x.AssignmentId == id && x.StudentName == request.StudentName, cancellationToken);

        if (existing is null)
        {
            existing = new HomeworkSubmission
            {
                AssignmentId = id,
                StudentName = request.StudentName.Trim(),
            };
            await dbContext.Set<HomeworkSubmission>().AddAsync(existing, cancellationToken);
        }

        existing.Note = request.Note.Trim();
        existing.FilesSerialized = JsonSerializer.Serialize((request.Files ?? []).Where(x => !string.IsNullOrWhiteSpace(x)).ToList());
        existing.SubmittedAtLabel = BuildDateLabel();
        await dbContext.SaveChangesAsync(cancellationToken);

        var submissions = await dbContext.Set<HomeworkSubmission>()
            .Where(x => x.AssignmentId == id)
            .OrderByDescending(x => x.Id)
            .ToListAsync(cancellationToken);
        return ToDto(entity, submissions);
    }

    private static HomeworkAssignmentDto ToDto(HomeworkAssignment entity, IReadOnlyList<HomeworkSubmission> submissions)
    {
        var submissionDtos = submissions
            .Select(x => new HomeworkSubmissionDto(
                x.Id,
                x.StudentName,
                x.Note,
                DeserializeStrings(x.FilesSerialized),
                x.SubmittedAtLabel))
            .ToList();

        var submitted = submissionDtos.Count;
        var total = entity.TotalStudents;
        var status = submitted == 0 ? "Yeni" : submitted >= total ? "Tamamlandi" : "Devam Ediyor";

        return new HomeworkAssignmentDto(
            entity.Id,
            entity.Title,
            entity.ClassName,
            entity.Subject,
            entity.Teacher,
            entity.DeadlineLabel,
            entity.Description,
            DeserializeStrings(entity.MaterialsSerialized),
            submitted,
            total,
            status,
            entity.CreatedAtLabel,
            submissionDtos);
    }

    private static IReadOnlyList<string> DeserializeStrings(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? []
            : JsonSerializer.Deserialize<List<string>>(value) ?? [];

    private static string BuildDateLabel()
    {
        var now = DateTime.Now;
        var month = now.Month switch
        {
            1 => "Ocak",
            2 => "Subat",
            3 => "Mart",
            4 => "Nisan",
            5 => "Mayis",
            6 => "Haziran",
            7 => "Temmuz",
            8 => "Agustos",
            9 => "Eylul",
            10 => "Ekim",
            11 => "Kasim",
            _ => "Aralik"
        };
        return $"{now.Day} {month} {now.Year}";
    }
}
