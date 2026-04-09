using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/examsessions")]
public sealed class ExamSessionsController(CourseIntellectDbContext dbContext) : ControllerBase
{
    public const string SectionKey = "exam-sessions";

    [HttpPost("start")]
    public async Task<IActionResult> Start([FromBody] ExamSessionStartRequest request, CancellationToken cancellationToken)
    {
        var resolvedClass = await ResolveClassName(request.StudentUsername, request.ClassName, cancellationToken);
        var resolvedStudentName = await ResolveStudentName(request.StudentUsername, request.StudentName, cancellationToken);

        var plannedExams = await CompatibilitySnapshotStore.LoadListAsync<PlannedExamSnapshot>(dbContext, PlannedExamsController.SectionKey, cancellationToken);
        var plannedExam = request.PlannedExamId.HasValue
            ? plannedExams.FirstOrDefault(item => item.Id == request.PlannedExamId.Value)
            : null;

        var filteredQuestions = await ResolveSessionQuestions(request, plannedExam, resolvedClass, cancellationToken);
        if (filteredQuestions.Count == 0)
        {
            return BadRequest(new { message = "Sınav oturumu için uygun soru bulunamadı." });
        }

        var subject = ResolveSubject(plannedExam?.Subject ?? request.Subject, filteredQuestions);
        var session = new ExamSessionSnapshot
        {
            Id = Guid.NewGuid(),
            ExamTitle = ResolveExamTitle(plannedExam?.Title ?? request.ExamTitle, subject),
            Subject = subject,
            StudentName = resolvedStudentName,
            StudentUsername = request.StudentUsername.Trim(),
            ClassName = resolvedClass,
            DurationSeconds = ResolveDurationSeconds(plannedExam?.Duration, request.DurationSeconds),
            Status = "Active",
            StartedAtUtc = DateTime.UtcNow,
            Questions = filteredQuestions.Select((item, index) => new ExamSessionQuestionSnapshot
            {
                Id = Guid.NewGuid(),
                QuestionBankItemId = item.Id,
                Subject = item.Subject,
                Topic = item.Topic,
                QuestionText = item.QuestionText,
                ImagePath = item.ImagePath,
                ImagePlacement = item.ImagePlacement,
                Options = CompatibilitySnapshotStore.DeserializeStringList(item.OptionsSerialized),
                CorrectOptionIndex = item.CorrectOptionIndex ?? 0,
                SortOrder = index,
            }).ToList(),
        };

        var sessions = await CompatibilitySnapshotStore.LoadListAsync<ExamSessionSnapshot>(dbContext, SectionKey, cancellationToken);
        sessions.Add(session);

        var sourceIds = filteredQuestions.Select(item => item.Id).ToHashSet();
        var sourceQuestions = await dbContext.QuestionBankItems.Where(item => sourceIds.Contains(item.Id)).ToListAsync(cancellationToken);
        foreach (var sourceQuestion in sourceQuestions)
        {
            sourceQuestion.UsageCount += 1;
        }

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, sessions, session.StudentUsername, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(MapSession(session));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var sessions = await CompatibilitySnapshotStore.LoadListAsync<ExamSessionSnapshot>(dbContext, SectionKey, cancellationToken);
        var session = sessions.FirstOrDefault(item => item.Id == id);
        return session is null ? NotFound() : Ok(MapSession(session));
    }

    [HttpPost("{id:guid}/answers")]
    public async Task<IActionResult> SaveAnswer(Guid id, [FromBody] ExamSessionAnswerRequest request, CancellationToken cancellationToken)
    {
        var sessions = await CompatibilitySnapshotStore.LoadListAsync<ExamSessionSnapshot>(dbContext, SectionKey, cancellationToken);
        var session = sessions.FirstOrDefault(item => item.Id == id);
        if (session is null)
        {
            return NotFound();
        }

        if (session.Status == "Completed")
        {
            return Conflict(new { message = "Bu sınav oturumu tamamlandı." });
        }

        var question = session.Questions.FirstOrDefault(item => item.Id == request.QuestionId);
        if (question is null)
        {
            return NotFound();
        }

        if (request.SelectedOptionIndex >= question.Options.Count)
        {
            return BadRequest(new { message = "Geçersiz cevap seçimi." });
        }

        question.Answer = new ExamSessionAnswerSnapshot
        {
            SelectedOptionIndex = request.SelectedOptionIndex,
            IsCorrect = question.CorrectOptionIndex == request.SelectedOptionIndex,
            AnsweredAtUtc = DateTime.UtcNow,
        };

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, sessions, session.StudentUsername, cancellationToken);
        return Ok(MapSession(session));
    }

    [HttpPost("{id:guid}/complete")]
    public async Task<IActionResult> Complete(Guid id, CancellationToken cancellationToken)
    {
        var sessions = await CompatibilitySnapshotStore.LoadListAsync<ExamSessionSnapshot>(dbContext, SectionKey, cancellationToken);
        var session = sessions.FirstOrDefault(item => item.Id == id);
        if (session is null)
        {
            return NotFound();
        }

        if (session.Status != "Completed")
        {
            session.Status = "Completed";
            session.CompletedAtUtc = DateTime.UtcNow;

            var total = session.Questions.Count;
            var answered = session.Questions.Count(item => item.Answer is not null);
            var correct = session.Questions.Count(item => item.Answer?.IsCorrect == true);
            var score = total == 0 ? 0 : (int)Math.Round((double)correct / total * 100, MidpointRounding.AwayFromZero);

            if (!session.RecordedExamResultId.HasValue)
            {
                var result = new ExamResult
                {
                    Id = Guid.NewGuid(),
                    ExamTitle = session.ExamTitle,
                    Type = ExamType.MockExam,
                    Subject = session.Subject,
                    DateLabel = DateTime.UtcNow.ToString("dd.MM.yyyy"),
                    StudentName = session.StudentName,
                    ClassName = session.ClassName,
                    Score = score,
                    Net = correct,
                };

                session.RecordedExamResultId = result.Id;
                await dbContext.ExamResults.AddAsync(result, cancellationToken);
            }

            foreach (var question in session.Questions.Where(item => item.QuestionBankItemId.HasValue && item.Answer is not null))
            {
                var answerText = question.Answer!.SelectedOptionIndex >= 0 && question.Answer.SelectedOptionIndex < question.Options.Count
                    ? question.Options[question.Answer.SelectedOptionIndex]
                    : string.Empty;

                await dbContext.QuestionPracticeAttempts.AddAsync(new QuestionPracticeAttempt
                {
                    Id = Guid.NewGuid(),
                    QuestionId = question.QuestionBankItemId!.Value,
                    StudentName = session.StudentName,
                    StudentUsername = session.StudentUsername,
                    AnswerText = answerText,
                    IsCorrect = question.Answer.IsCorrect,
                    SubmittedAtUtc = DateTime.UtcNow,
                }, cancellationToken);
            }

            await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, sessions, session.StudentUsername, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return Ok(BuildCompletionResponse(session));
    }

    private async Task<List<QuestionBankItem>> ResolveSessionQuestions(
        ExamSessionStartRequest request,
        PlannedExamSnapshot? plannedExam,
        string resolvedClass,
        CancellationToken cancellationToken)
    {
        var allQuestions = await dbContext.QuestionBankItems
            .AsNoTracking()
            .Where(item => item.CorrectOptionIndex.HasValue)
            .OrderByDescending(item => item.UsageCount)
            .ThenBy(item => item.CreatedAtLabel)
            .ToListAsync(cancellationToken);

        if (plannedExam is not null)
        {
            var sourceIds = plannedExam.Sources.Where(item => item.QuestionId.HasValue).Select(item => item.QuestionId!.Value).ToHashSet();
            var byId = allQuestions.Where(item => sourceIds.Contains(item.Id)).ToList();
            if (byId.Count > 0)
            {
                return byId;
            }

            var sourceTitles = plannedExam.Sources
                .Select(item => CompatibilitySnapshotStore.NormalizeText(item.Title))
                .Where(item => !string.IsNullOrWhiteSpace(item))
                .ToHashSet();
            var byTitle = allQuestions.Where(item => sourceTitles.Contains(CompatibilitySnapshotStore.NormalizeText(item.QuestionText))).ToList();
            if (byTitle.Count > 0)
            {
                return byTitle;
            }
        }

        var filtered = allQuestions.AsEnumerable();
        var requestedSubject = plannedExam?.Subject ?? request.Subject;
        if (!string.IsNullOrWhiteSpace(requestedSubject))
        {
            var normalizedSubject = CompatibilitySnapshotStore.NormalizeText(requestedSubject);
            filtered = filtered.Where(item => CompatibilitySnapshotStore.NormalizeText(item.Subject) == normalizedSubject);
        }

        var classFiltered = FilterByClass(filtered.ToList(), resolvedClass);
        return (classFiltered.Count == 0 ? filtered.ToList() : classFiltered)
            .Take(request.QuestionCount > 0 ? request.QuestionCount : 10)
            .ToList();
    }

    private async Task<string> ResolveClassName(string username, string? requestClassName, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(requestClassName))
        {
            return requestClassName.Trim();
        }

        var student = await dbContext.Students
            .AsNoTracking()
            .Join(dbContext.Users.AsNoTracking(), student => student.UserId, user => user.Id, (student, user) => new { student.ClassName, user.Username })
            .FirstOrDefaultAsync(item => item.Username == username.Trim(), cancellationToken);

        return student?.ClassName ?? "Genel";
    }

    private async Task<string> ResolveStudentName(string username, string? requestStudentName, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(requestStudentName))
        {
            return requestStudentName.Trim();
        }

        var student = await dbContext.Students
            .AsNoTracking()
            .Join(dbContext.Users.AsNoTracking(), student => student.UserId, user => user.Id, (student, user) => new { student.FullName, user.Username })
            .FirstOrDefaultAsync(item => item.Username == username.Trim(), cancellationToken);

        return student?.FullName ?? username.Trim();
    }

    private static string ResolveSubject(string? requestedSubject, List<QuestionBankItem> questions)
    {
        if (!string.IsNullOrWhiteSpace(requestedSubject))
        {
            return requestedSubject.Trim();
        }

        return questions
            .GroupBy(item => item.Subject)
            .OrderByDescending(group => group.Count())
            .Select(group => group.Key)
            .FirstOrDefault() ?? "Genel";
    }

    private static string ResolveExamTitle(string? requestedTitle, string subject)
    {
        return string.IsNullOrWhiteSpace(requestedTitle) ? $"{subject} Sınav Oturumu" : requestedTitle.Trim();
    }

    private static int ResolveDurationSeconds(string? durationLabel, int fallbackSeconds)
    {
        if (string.IsNullOrWhiteSpace(durationLabel))
        {
            return fallbackSeconds > 0 ? fallbackSeconds : 3600;
        }

        var digits = new string(durationLabel.Where(char.IsDigit).ToArray());
        return int.TryParse(digits, out var minutes) && minutes > 0 ? minutes * 60 : (fallbackSeconds > 0 ? fallbackSeconds : 3600);
    }

    private static List<QuestionBankItem> FilterByClass(List<QuestionBankItem> items, string className)
    {
        if (string.IsNullOrWhiteSpace(className))
        {
            return items;
        }

        return items.Where(item =>
        {
            var targets = CompatibilitySnapshotStore.DeserializeStringList(item.ClassTargetsSerialized);
            return targets.Contains("Tüm Sınıflar") || targets.Contains("Tum Siniflar") || targets.Contains(className.Trim());
        }).ToList();
    }

    private static object MapSession(ExamSessionSnapshot session)
    {
        return new
        {
            id = session.Id,
            examTitle = session.ExamTitle,
            title = session.ExamTitle,
            subject = session.Subject,
            studentName = session.StudentName,
            studentUsername = session.StudentUsername,
            className = session.ClassName,
            status = session.Status,
            durationSeconds = session.DurationSeconds,
            startedAtUtc = session.StartedAtUtc,
            completedAtUtc = session.CompletedAtUtc,
            questions = session.Questions
                .OrderBy(item => item.SortOrder)
                .Select(item => new
                {
                    id = item.Id,
                    subject = item.Subject,
                    topic = item.Topic,
                    questionText = item.QuestionText,
                    imagePath = item.ImagePath,
                    imagePlacement = item.ImagePlacement,
                    options = item.Options,
                    sortOrder = item.SortOrder,
                    selectedOptionIndex = item.Answer?.SelectedOptionIndex,
                })
                .ToList(),
        };
    }

    private static object BuildCompletionResponse(ExamSessionSnapshot session)
    {
        var total = session.Questions.Count;
        var answered = session.Questions.Count(item => item.Answer is not null);
        var correct = session.Questions.Count(item => item.Answer?.IsCorrect == true);
        var wrong = answered - correct;
        var blank = total - answered;
        var score = total == 0 ? 0 : (int)Math.Round((double)correct / total * 100, MidpointRounding.AwayFromZero);

        return new
        {
            sessionId = session.Id,
            examTitle = session.ExamTitle,
            title = session.ExamTitle,
            subject = session.Subject,
            studentName = session.StudentName,
            className = session.ClassName,
            score,
            net = correct,
            correct,
            wrong,
            blank,
            total,
            completedAtUtc = session.CompletedAtUtc ?? DateTime.UtcNow,
        };
    }
}

public sealed class ExamSessionStartRequest
{
    public Guid? PlannedExamId { get; set; }
    public string? ExamTitle { get; set; }
    public string? Subject { get; set; }
    public string StudentUsername { get; set; } = string.Empty;
    public string? StudentName { get; set; }
    public string? ClassName { get; set; }
    public int DurationSeconds { get; set; } = 3600;
    public int QuestionCount { get; set; } = 10;
}

public sealed class ExamSessionAnswerRequest
{
    public Guid QuestionId { get; set; }
    public int SelectedOptionIndex { get; set; }
}

public sealed class ExamSessionSnapshot
{
    public Guid Id { get; set; }
    public string ExamTitle { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    public string StudentUsername { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public int DurationSeconds { get; set; }
    public string Status { get; set; } = "Active";
    public DateTime StartedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAtUtc { get; set; }
    public Guid? RecordedExamResultId { get; set; }
    public List<ExamSessionQuestionSnapshot> Questions { get; set; } = [];
}

public sealed class ExamSessionQuestionSnapshot
{
    public Guid Id { get; set; }
    public Guid? QuestionBankItemId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
    public string QuestionText { get; set; } = string.Empty;
    public string? ImagePath { get; set; }
    public string? ImagePlacement { get; set; }
    public List<string> Options { get; set; } = [];
    public int CorrectOptionIndex { get; set; }
    public int SortOrder { get; set; }
    public ExamSessionAnswerSnapshot? Answer { get; set; }
}

public sealed class ExamSessionAnswerSnapshot
{
    public int SelectedOptionIndex { get; set; }
    public bool IsCorrect { get; set; }
    public DateTime AnsweredAtUtc { get; set; } = DateTime.UtcNow;
}
