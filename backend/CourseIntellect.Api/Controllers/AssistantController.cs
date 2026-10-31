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
    public async Task<IActionResult> GetConversations([FromQuery] string? portal, CancellationToken ct)
    {
        if (!TryContext(out var context, out var error)) return error!;
        return Ok(await assistantService.GetConversationsAsync(context!, portal, ct));
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
        return Ok(await assistantService.SendAsync(WithPortal(context!, request.Context?.Portal, request.Context?.Language), request, ct));
    }

    [HttpGet("suggestions")]
    public async Task<IActionResult> GetSuggestions([FromQuery] string? portal, [FromQuery] string? language, CancellationToken ct)
    {
        if (!TryContext(out var context, out var error)) return error!;
        return Ok(await assistantService.GetSuggestionsAsync(WithPortal(context!, portal, language), ct));
    }

    [HttpPost("actions")]
    public async Task<IActionResult> ExecuteAction([FromBody] AssistantActionRequest request, CancellationToken ct)
    {
        if (!TryContext(out var context, out var error)) return error!;
        return Ok(await assistantService.ExecuteActionAsync(WithPortal(context!, request.Context?.Portal, request.Context?.Language), request, ct));
    }

    /// <summary>Panel açılınca gösterilen, role göre günlük özet.</summary>
    [HttpGet("briefing")]
    [ProducesResponseType<AssistantBriefingDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBriefing([FromQuery] string? portal, [FromQuery] string? language, CancellationToken ct)
    {
        if (!TryContext(out var context, out var error)) return error!;
        return Ok(await assistantService.GetBriefingAsync(WithPortal(context!, portal, language), ct));
    }

    [HttpPost("messages/{messageId:guid}/feedback")]
    public async Task<IActionResult> SetFeedback(Guid messageId, [FromBody] AssistantFeedbackRequest request, CancellationToken ct)
    {
        if (!TryContext(out var context, out var error)) return error!;
        return await assistantService.SetFeedbackAsync(context!, messageId, request.Helpful, ct) ? NoContent() : NotFound();
    }

    /// <summary>Asistanın cevaplayamadığı sorular — yalnız kurum yöneticisi (şube müdürü kendi şubesini görür).</summary>
    [HttpGet("unanswered")]
    [Authorize(Roles = "Admin,BranchManager")]
    [ProducesResponseType<IReadOnlyList<AssistantUnansweredDto>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUnanswered([FromQuery] int days = 30, CancellationToken ct = default)
    {
        if (!TryContext(out var context, out var error)) return error!;
        return Ok(await assistantService.GetUnansweredAsync(context!, days, ct));
    }

    private static readonly string[] RolePriority = ["BranchManager", "Admin", "Administrative", "Accounting", "Teacher", "Parent", "Student", "Developer"];

    /// <summary>
    /// İstemcinin bildirdiği portal yalnız kullanıcının GERÇEK bir rolüne karşılık geliyorsa
    /// kabul edilir; aksi hâlde token'daki birincil rol kalır. Böylece öğretmen+veli olan biri
    /// veli portalındayken asistan veli gibi, öğretmen portalındayken öğretmen gibi cevaplar.
    /// </summary>
    private static AssistantRequestContext WithPortal(AssistantRequestContext context, string? portal, string? language)
    {
        var lang = string.Equals(language, "en", StringComparison.OrdinalIgnoreCase) ? "en" : "tr";
        var requested = (portal ?? string.Empty).Trim().ToLowerInvariant();
        var role = requested switch
        {
            "admin" => context.Roles.Contains("BranchManager") ? "BranchManager" : context.Roles.Contains("Admin") ? "Admin" : null,
            "administrative" => context.Roles.Contains("Administrative") ? "Administrative" : null,
            "accounting" => context.Roles.Contains("Accounting") ? "Accounting" : null,
            "teacher" or "counselor" => context.Roles.Contains("Teacher") ? "Teacher" : null,
            "parent" => context.Roles.Contains("Parent") ? "Parent" : null,
            "student" => context.Roles.Contains("Student") ? "Student" : null,
            _ => null,
        };
        return context with { PrimaryRole = role ?? context.PrimaryRole, Language = lang };
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
        // Rol kümesi sırasızdır; çok rollü kullanıcıda (ör. öğretmen + veli) birincil rol
        // rastgele seçilmesin diye sabit öncelik kullanılır. İstemci portal bildirirse WithPortal ezer.
        var primaryRole = RolePriority.FirstOrDefault(roles.Contains) ?? roles.FirstOrDefault() ?? string.Empty;
        context = new AssistantRequestContext(
            userId, tenantId, branchId, primaryRole, roles, User,
            HttpContext.TraceIdentifier,
            HttpContext.Connection.RemoteIpAddress?.ToString() ?? string.Empty,
            Request.Headers.UserAgent.ToString());
        return true;
    }
}
