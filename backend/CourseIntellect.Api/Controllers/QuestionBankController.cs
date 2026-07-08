using CourseIntellect.Application.DTOs.QuestionBank;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using CourseIntellect.Api.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class QuestionBankController(
    IQuestionBankService questionBankService,
    CourseIntellectDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? className, CancellationToken cancellationToken = default)
    {
        var includeDrafts = User.IsInRole("Teacher") || User.IsInRole("Admin");
        var items = await questionBankService.GetQuestionsAsync(className, includeDrafts, cancellationToken);
        return Ok(items);
    }

    [HttpGet("attempts")]
    public async Task<IActionResult> GetAttempts([FromQuery] string? studentUsername, CancellationToken cancellationToken = default)
    {
        var items = await questionBankService.GetAttemptsAsync(studentUsername, cancellationToken);
        return Ok(items);
    }

    [HttpGet("attempts/stats")]
    public async Task<IActionResult> GetAttemptStats([FromQuery] string? studentUsername, [FromQuery] string? className, CancellationToken cancellationToken = default)
    {
        var stats = await questionBankService.GetStatsAsync(studentUsername, className, cancellationToken);
        return Ok(stats);
    }

    [HttpPost]
    [Authorize(Roles = "Teacher,Admin")]
    [RequireEntitlement("question-bank", "create")]
    public async Task<IActionResult> Create([FromBody] CreateQuestionBankItemRequest request, CancellationToken cancellationToken)
    {
        var item = await questionBankService.CreateQuestionAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Teacher,Admin")]
    [RequireEntitlement("question-bank")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreateQuestionBankItemRequest request, CancellationToken cancellationToken)
    {
        var item = await questionBankService.UpdateQuestionAsync(id, request, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Teacher,Admin")]
    [RequireEntitlement("question-bank")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await questionBankService.DeleteQuestionAsync(id, cancellationToken);
        if (!deleted)
        {
            return NotFound();
        }

        await RemoveQuestionFromPlannedExamSourcesAsync(id, cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/usage")]
    public async Task<IActionResult> IncrementUsage(Guid id, CancellationToken cancellationToken)
    {
        var item = await questionBankService.IncrementUsageAsync(id, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost("{id:guid}/attempts")]
    [RequireEntitlement("question-bank", "practice")]
    public async Task<IActionResult> SubmitAttempt(Guid id, [FromBody] SubmitQuestionPracticeAttemptRequest request, CancellationToken cancellationToken)
    {
        var item = await questionBankService.SubmitAttemptAsync(id, request, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    private async Task RemoveQuestionFromPlannedExamSourcesAsync(Guid questionId, CancellationToken cancellationToken)
    {
        var plannedExams = await CompatibilitySnapshotStore.LoadListAsync<PlannedExamSnapshot>(
            dbContext,
            PlannedExamsController.SectionKey,
            cancellationToken);

        var changed = false;
        foreach (var exam in plannedExams)
        {
            var removed = exam.Sources.RemoveAll(source => source.QuestionId == questionId);
            if (removed <= 0)
            {
                continue;
            }

            changed = true;
            exam.QuestionCount = exam.Sources.Count;
        }

        if (changed)
        {
            await CompatibilitySnapshotStore.SaveListAsync(
                dbContext,
                PlannedExamsController.SectionKey,
                plannedExams,
                User.Identity?.Name ?? "system",
                cancellationToken);
        }
    }
}
