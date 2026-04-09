using System.Security.Claims;
using CourseIntellect.Application.DTOs.QuestionThreads;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class QuestionThreadsController(IQuestionThreadService questionThreadService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var role = User.FindFirstValue("role") ?? "Student";
        var fullName = User.FindFirstValue("name") ?? string.Empty;
        var username = string.Empty;
        var items = await questionThreadService.GetThreadsAsync(role, fullName, username, cancellationToken);
        return Ok(items);
    }

    [HttpPost]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> Create([FromBody] CreateQuestionThreadRequest request, CancellationToken cancellationToken)
    {
        var fullName = User.FindFirstValue("name") ?? string.Empty;
        var username = string.Empty;
        var item = await questionThreadService.CreateThreadAsync(fullName, username, request, cancellationToken);
        return Ok(item);
    }

    [HttpPost("{id:guid}/replies")]
    [Authorize(Roles = "Student,Teacher,Admin")]
    public async Task<IActionResult> Reply(Guid id, [FromBody] CreateQuestionThreadReplyRequest request, CancellationToken cancellationToken)
    {
        var senderName = User.FindFirstValue("name") ?? string.Empty;
        var senderRole = User.FindFirstValue("role") ?? "Student";
        var item = await questionThreadService.AddReplyAsync(id, senderName, senderRole, request, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }
}
