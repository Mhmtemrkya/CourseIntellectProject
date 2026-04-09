using System.Security.Claims;
using CourseIntellect.Application.DTOs.Messages;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class MessagesController(IMessageService messageService) : ControllerBase
{
    [HttpGet("threads")]
    public async Task<IActionResult> GetThreads(CancellationToken cancellationToken)
    {
        var (userId, fullName, _) = GetCurrentUser();
        var threads = await messageService.GetThreadsAsync(userId, fullName, cancellationToken);
        return Ok(threads);
    }

    [HttpPost("threads")]
    public async Task<IActionResult> CreateThread([FromBody] CreateThreadRequest request, CancellationToken cancellationToken)
    {
        var (userId, fullName, role) = GetCurrentUser();
        var thread = await messageService.CreateOrGetThreadAsync(userId, fullName, role, request, cancellationToken);
        return Ok(thread);
    }

    [HttpGet("threads/{threadId:guid}")]
    public async Task<IActionResult> GetMessages(Guid threadId, CancellationToken cancellationToken)
    {
        var (userId, fullName, _) = GetCurrentUser();
        var messages = await messageService.GetMessagesAsync(userId, fullName, threadId, cancellationToken);
        return Ok(messages);
    }

    [HttpPost("threads/{threadId:guid}/messages")]
    public async Task<IActionResult> SendMessage(Guid threadId, [FromBody] SendMessageRequest request, CancellationToken cancellationToken)
    {
        var (userId, fullName, role) = GetCurrentUser();
        var item = await messageService.SendMessageAsync(userId, fullName, role, threadId, request, cancellationToken);
        return Ok(item);
    }

    [HttpPost("threads/{threadId:guid}/join-realtime")]
    public async Task<IActionResult> JoinRealtime(Guid threadId, CancellationToken cancellationToken)
    {
        var (userId, fullName, _) = GetCurrentUser();
        await messageService.JoinRealtimeAsync(userId, fullName, threadId, cancellationToken);
        return NoContent();
    }

    [HttpDelete("threads/{threadId:guid}/messages/{messageId:guid}/me")]
    public IActionResult DeleteForMe(Guid threadId, Guid messageId)
    {
        return NoContent();
    }

    private (Guid UserId, string FullName, string Role) GetCurrentUser()
    {
        var userId = Guid.Parse((User.FindFirstValue("nameid") ?? User.FindFirstValue("sub"))!);
        var fullName = User.FindFirstValue("name") ?? string.Empty;
        var role = User.FindFirstValue("role") ?? string.Empty;
        return (userId, fullName, role);
    }
}
