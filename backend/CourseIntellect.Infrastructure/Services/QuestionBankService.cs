using System.Text.Json;
using CourseIntellect.Application.DTOs.QuestionBank;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class QuestionBankService(CourseIntellectDbContext dbContext) : IQuestionBankService
{
    public async Task<IReadOnlyList<QuestionBankItemDto>> GetQuestionsAsync(string? className, CancellationToken cancellationToken = default)
    {
        var query = dbContext.QuestionBankItems.AsQueryable();

        if (!string.IsNullOrWhiteSpace(className))
        {
            var normalizedClass = className.Trim();
            query = query.Where(x =>
                x.ClassTargetsSerialized.Contains("\"Tum Siniflar\"") ||
                x.ClassTargetsSerialized.Contains("\"Tüm Sınıflar\"") ||
                x.ClassTargetsSerialized.Contains($"\"{normalizedClass}\""));
        }

        var items = await query
            .OrderByDescending(x => x.Id)
            .ToListAsync(cancellationToken);

        return items.Select(ToDto).ToList();
    }

    public async Task<IReadOnlyList<QuestionPracticeAttemptDto>> GetAttemptsAsync(string? studentUsername, CancellationToken cancellationToken = default)
    {
        var query = dbContext.QuestionPracticeAttempts.AsQueryable();
        if (!string.IsNullOrWhiteSpace(studentUsername))
        {
            var normalized = studentUsername.Trim();
            query = query.Where(x => x.StudentUsername == normalized);
        }

        return await query
            .OrderByDescending(x => x.SubmittedAtUtc)
            .Select(x => new QuestionPracticeAttemptDto(
                x.Id,
                x.QuestionId,
                x.StudentName,
                x.StudentUsername,
                x.AnswerText,
                x.IsCorrect,
                x.SubmittedAtUtc))
            .ToListAsync(cancellationToken);
    }

    public async Task<QuestionBankItemDto> CreateQuestionAsync(CreateQuestionBankItemRequest request, CancellationToken cancellationToken = default)
    {
        var item = new QuestionBankItem
        {
            CreatedAtLabel = BuildCreatedAtLabel()
        };
        Apply(item, request);
        await dbContext.QuestionBankItems.AddAsync(item, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(item);
    }

    public async Task<QuestionBankItemDto?> UpdateQuestionAsync(Guid id, CreateQuestionBankItemRequest request, CancellationToken cancellationToken = default)
    {
        var item = await dbContext.QuestionBankItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return null;
        }

        Apply(item, request);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(item);
    }

    public async Task<bool> DeleteQuestionAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var item = await dbContext.QuestionBankItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return false;
        }

        dbContext.QuestionBankItems.Remove(item);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<QuestionBankItemDto?> IncrementUsageAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var item = await dbContext.QuestionBankItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return null;
        }

        item.UsageCount += 1;
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(item);
    }

    public async Task<QuestionPracticeAttemptDto?> SubmitAttemptAsync(Guid id, SubmitQuestionPracticeAttemptRequest request, CancellationToken cancellationToken = default)
    {
        var item = await dbContext.QuestionBankItems.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (item is null)
        {
            return null;
        }

        var normalizedAnswer = request.AnswerText.Trim();
        var isCorrect = EvaluateAnswer(item, normalizedAnswer);

        var attempt = new QuestionPracticeAttempt
        {
            TenantId = item.TenantId,
            QuestionId = id,
            StudentName = request.StudentName.Trim(),
            StudentUsername = request.StudentUsername.Trim(),
            AnswerText = normalizedAnswer,
            IsCorrect = isCorrect,
            SubmittedAtUtc = DateTime.UtcNow
        };

        item.UsageCount += 1;
        await dbContext.QuestionPracticeAttempts.AddAsync(attempt, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new QuestionPracticeAttemptDto(
            attempt.Id,
            attempt.QuestionId,
            attempt.StudentName,
            attempt.StudentUsername,
            attempt.AnswerText,
            attempt.IsCorrect,
            attempt.SubmittedAtUtc);
    }

    private static void Apply(QuestionBankItem item, CreateQuestionBankItemRequest request)
    {
        item.Subject = request.Subject.Trim();
        item.Topic = request.Topic.Trim();
        item.Difficulty = request.Difficulty.Trim();
        item.Type = request.Type.Trim();
        item.QuestionText = request.QuestionText.Trim();
        item.Teacher = request.Teacher.Trim();
        item.ImagePath = NormalizeOptional(request.ImagePath);
        item.ImagePlacement = string.IsNullOrWhiteSpace(request.ImagePlacement) ? "Ust" : request.ImagePlacement.Trim();
        item.OptionsSerialized = JsonSerializer.Serialize(request.Options ?? []);
        item.CorrectOptionIndex = request.CorrectOptionIndex;
        item.ClassTargetsSerialized = JsonSerializer.Serialize(
            request.ClassTargets is { Count: > 0 } ? request.ClassTargets : new[] { "Tüm Sınıflar" });
        item.SolutionAssetPath = NormalizeOptional(request.SolutionAssetPath);
        item.SolutionAssetType = NormalizeOptional(request.SolutionAssetType);
        item.RevealCorrectAnswerToStudent = request.RevealCorrectAnswerToStudent;
        item.ExpectedAnswer = NormalizeOptional(request.ExpectedAnswer);
    }

    private static QuestionBankItemDto ToDto(QuestionBankItem item)
    {
        var options = DeserializeList(item.OptionsSerialized);
        var classTargets = DeserializeList(item.ClassTargetsSerialized);

        return new QuestionBankItemDto(
            item.Id,
            item.Subject,
            item.Topic,
            item.Difficulty,
            item.Type,
            item.QuestionText,
            item.Teacher,
            item.CreatedAtLabel,
            item.UsageCount,
            item.ImagePath,
            item.ImagePlacement,
            options,
            item.CorrectOptionIndex,
            classTargets,
            item.SolutionAssetPath,
            item.SolutionAssetType,
            item.RevealCorrectAnswerToStudent,
            item.ExpectedAnswer);
    }

    private static IReadOnlyList<string> DeserializeList(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return [];
        }

        return JsonSerializer.Deserialize<List<string>>(value) ?? [];
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static string BuildCreatedAtLabel()
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

    private static bool EvaluateAnswer(QuestionBankItem item, string answer)
    {
        var options = DeserializeList(item.OptionsSerialized);
        if (item.CorrectOptionIndex is int optionIndex && optionIndex >= 0 && optionIndex < options.Count)
        {
            return string.Equals(
                NormalizeForCompare(options[optionIndex]),
                NormalizeForCompare(answer),
                StringComparison.Ordinal);
        }

        if (!string.IsNullOrWhiteSpace(item.ExpectedAnswer))
        {
            return string.Equals(
                NormalizeForCompare(item.ExpectedAnswer),
                NormalizeForCompare(answer),
                StringComparison.Ordinal);
        }

        return false;
    }

    private static string NormalizeForCompare(string? value)
    {
        return (value ?? string.Empty)
            .Trim()
            .ToLowerInvariant()
            .Replace("ç", "c")
            .Replace("ğ", "g")
            .Replace("ı", "i")
            .Replace("ö", "o")
            .Replace("ş", "s")
            .Replace("ü", "u");
    }
}
