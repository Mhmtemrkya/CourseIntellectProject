using CourseIntellect.Application.DTOs.QuestionBank;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class QuestionBankController(IQuestionBankService questionBankService) : ControllerBase
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

    [HttpPost]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> Create([FromBody] CreateQuestionBankItemRequest request, CancellationToken cancellationToken)
    {
        var item = await questionBankService.CreateQuestionAsync(request, cancellationToken);
        return Ok(item);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreateQuestionBankItemRequest request, CancellationToken cancellationToken)
    {
        var item = await questionBankService.UpdateQuestionAsync(id, request, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await questionBankService.DeleteQuestionAsync(id, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/usage")]
    public async Task<IActionResult> IncrementUsage(Guid id, CancellationToken cancellationToken)
    {
        var item = await questionBankService.IncrementUsageAsync(id, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost("{id:guid}/attempts")]
    public async Task<IActionResult> SubmitAttempt(Guid id, [FromBody] SubmitQuestionPracticeAttemptRequest request, CancellationToken cancellationToken)
    {
        var item = await questionBankService.SubmitAttemptAsync(id, request, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }
}
