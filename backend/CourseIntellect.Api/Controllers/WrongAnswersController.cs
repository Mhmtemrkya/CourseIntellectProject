using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CourseIntellect.Infrastructure.Persistence;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/wronganswers")]
public sealed class WrongAnswersController(CourseIntellectDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetList(
        [FromQuery] string? studentUsername = null,
        [FromQuery] string? studentName = null,
        CancellationToken cancellationToken = default)
    {
        var attemptsQuery = dbContext.QuestionPracticeAttempts
            .AsNoTracking()
            .Where(item => !item.IsCorrect);

        if (!string.IsNullOrWhiteSpace(studentUsername))
        {
            var normalizedUsername = studentUsername.Trim().ToLowerInvariant();
            attemptsQuery = attemptsQuery.Where(item => item.StudentUsername.ToLower() == normalizedUsername);
        }

        var attempts = await attemptsQuery
            .OrderByDescending(item => item.SubmittedAtUtc)
            .ToListAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(studentName))
        {
            var normalizedName = CompatibilitySnapshotStore.NormalizeText(studentName);
            attempts = attempts
                .Where(item => CompatibilitySnapshotStore.NormalizeText(item.StudentName) == normalizedName)
                .ToList();
        }

        var questionIds = attempts.Select(item => item.QuestionId).Distinct().ToList();
        var questions = await dbContext.QuestionBankItems
            .AsNoTracking()
            .Where(item => questionIds.Contains(item.Id))
            .ToDictionaryAsync(item => item.Id, cancellationToken);

        var response = attempts
            .Where(item => questions.ContainsKey(item.QuestionId))
            .Select(item =>
            {
                var question = questions[item.QuestionId];
                var options = CompatibilitySnapshotStore.DeserializeStringList(question.OptionsSerialized);
                var correctAnswer = question.CorrectOptionIndex.HasValue &&
                                    question.CorrectOptionIndex.Value >= 0 &&
                                    question.CorrectOptionIndex.Value < options.Count
                    ? options[question.CorrectOptionIndex.Value]
                    : string.Empty;

                return new
                {
                    attemptId = item.Id,
                    questionId = item.QuestionId,
                    studentName = item.StudentName,
                    studentUsername = item.StudentUsername,
                    subject = question.Subject,
                    topic = question.Topic,
                    difficulty = question.Difficulty,
                    questionText = question.QuestionText,
                    yourAnswer = item.AnswerText,
                    correctAnswer,
                    note = $"Konu: {question.Topic} • Zorluk: {question.Difficulty}",
                    submittedAtUtc = item.SubmittedAtUtc,
                };
            })
            .ToList();

        return Ok(response);
    }

    [HttpDelete]
    public async Task<IActionResult> Clear(
        [FromQuery] string? studentUsername = null,
        [FromQuery] string? studentName = null,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.QuestionPracticeAttempts
            .Where(item => !item.IsCorrect);

        if (!string.IsNullOrWhiteSpace(studentUsername))
        {
            var normalizedUsername = studentUsername.Trim().ToLowerInvariant();
            query = query.Where(item => item.StudentUsername.ToLower() == normalizedUsername);
        }

        var attempts = await query.ToListAsync(cancellationToken);

        if (!string.IsNullOrWhiteSpace(studentName))
        {
            var normalizedName = CompatibilitySnapshotStore.NormalizeText(studentName);
            attempts = attempts
                .Where(item => CompatibilitySnapshotStore.NormalizeText(item.StudentName) == normalizedName)
                .ToList();
        }

        if (attempts.Count == 0)
        {
            return NoContent();
        }

        dbContext.QuestionPracticeAttempts.RemoveRange(attempts);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
