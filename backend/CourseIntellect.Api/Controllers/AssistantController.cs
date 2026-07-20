using System.Security.Claims;
using CourseIntellect.Application.DTOs.Assistant;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[EnableRateLimiting("assistant")]
[Route("api/assistant")]
[Produces("application/json")]
public sealed class AssistantController(IAssistantService assistantService) : ControllerBase
{
    [HttpPost("conversations")]
    [ProducesResponseType<AssistantConversationDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateConversation([FromBody] CreateAssistantConversationRequest? request, CancellationToken ct)
    {
        if (!TryContext(out var context, out var error)) return error!;
        var result = await assistantService.CreateConversationAsync(context!, request?.Title, ct);
        return CreatedAtAction(nameof(GetConversationMessages), new { conversationId = result.Id }, result);
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations(CancellationToken ct)
    {
        if (!TryContext(out var context, out var error)) return error!;
        return Ok(await assistantService.GetConversationsAsync(context!, ct));
    }

    [HttpGet("conversations/{conversationId:guid}")]
    [HttpGet("conversations/{conversationId:guid}/messages")]
    public async Task<IActionResult> GetConversationMessages(Guid conversationId, CancellationToken ct)
    {
        if (!TryContext(out var context, out var error)) return error!;
        var result = await assistantService.GetMessagesAsync(context!, conversationId, ct);
        return result is null ? NotFound(new { code = "CONVERSATION_NOT_FOUND", message = "Sohbet bulunamadı." }) : Ok(result);
    }

    [HttpDelete("conversations/{conversationId:guid}")]
    public async Task<IActionResult> DeleteConversation(Guid conversationId, CancellationToken ct)
    {
        if (!TryContext(out var context, out var error)) return error!;
        return await assistantService.DeleteConversationAsync(context!, conversationId, ct) ? NoContent() : NotFound();
    }

    [HttpPost("messages")]
    [ProducesResponseType<AssistantResponseDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> SendMessage([FromBody] SendAssistantMessageRequest request, CancellationToken ct)
    {
        if (!TryContext(out var context, out var error)) return error!;
        if (request.ClientMessageId == Guid.Empty) return BadRequest(new { code = "CLIENT_MESSAGE_ID_REQUIRED", message = "clientMessageId zorunludur." });
        return Ok(await assistantService.SendAsync(context!, request, ct));
    }

    [HttpGet("suggestions")]
    public async Task<IActionResult> GetSuggestions(CancellationToken ct)
    {
        if (!TryContext(out var context, out var error)) return error!;
        return Ok(await assistantService.GetSuggestionsAsync(context!, ct));
    }

    [HttpPost("actions")]
    public async Task<IActionResult> ExecuteAction([FromBody] AssistantActionRequest request, CancellationToken ct)
    {
        if (!TryContext(out var context, out var error)) return error!;
        return Ok(await assistantService.ExecuteActionAsync(context!, request, ct));
    }

    private bool TryContext(out AssistantRequestContext? context, out IActionResult? error)
    {
        context = null;
        error = null;
        var userRaw = User.FindFirstValue("sub") ?? User.FindFirstValue("nameid") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        var tenantRaw = User.FindFirstValue("tenant_id");
        if (!Guid.TryParse(userRaw, out var userId) || !Guid.TryParse(tenantRaw, out var tenantId))
        {
            error = Forbid();
            return false;
        }
        Guid? branchId = Guid.TryParse(User.FindFirstValue("branch_id"), out var parsedBranch) ? parsedBranch : null;
        var roles = User.FindAll("role").Select(x => x.Value).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var primaryRole = roles.FirstOrDefault(x => !x.Equals("Admin", StringComparison.OrdinalIgnoreCase)) ?? roles.FirstOrDefault() ?? string.Empty;
        context = new AssistantRequestContext(
            userId, tenantId, branchId, primaryRole, roles, User,
            HttpContext.TraceIdentifier,
            HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty,
            Request.Headers.UserAgent.ToString());
        return true;
    }
}
