using System.Security.Claims;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize(Roles = "Teacher,Admin")]
[Route("api/question-studio")]
public sealed class QuestionStudioController(
    CourseIntellectDbContext dbContext) : ControllerBase
{
    private const string DraftSectionKey = "question-studio-drafts";

    [HttpGet("drafts")]
    public async Task<IActionResult> GetDrafts(CancellationToken cancellationToken)
    {
        var username = ResolveUsername();
        var drafts = await CompatibilitySnapshotStore.LoadListAsync<QuestionStudioDraftSnapshot>(dbContext, DraftSectionKey, cancellationToken);
        return Ok(drafts
            .Where(item => string.Equals(item.OwnerUsername, username, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(item => item.UpdatedAtUtc)
            .Take(50)
            .ToList());
    }

    [HttpPost("drafts")]
    public async Task<IActionResult> SaveDraft([FromBody] QuestionStudioDraftRequest request, CancellationToken cancellationToken)
    {
        var username = ResolveUsername();
        var drafts = await CompatibilitySnapshotStore.LoadListAsync<QuestionStudioDraftSnapshot>(dbContext, DraftSectionKey, cancellationToken);
        var draft = request.Id.HasValue
            ? drafts.FirstOrDefault(item => item.Id == request.Id.Value && string.Equals(item.OwnerUsername, username, StringComparison.OrdinalIgnoreCase))
            : null;

        if (draft is null)
        {
            draft = new QuestionStudioDraftSnapshot
            {
                Id = request.Id ?? Guid.NewGuid(),
                OwnerUsername = username,
                OwnerName = ResolveFullName(),
                CreatedAtUtc = DateTime.UtcNow,
            };
            drafts.Add(draft);
        }

        draft.Title = string.IsNullOrWhiteSpace(request.Title) ? "Adsız Soru Taslağı" : request.Title.Trim();
        draft.Mode = string.IsNullOrWhiteSpace(request.Mode) ? "QuestionBank" : request.Mode.Trim();
        draft.PayloadJson = request.PayloadJson ?? "{}";
        draft.UpdatedAtUtc = DateTime.UtcNow;

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, DraftSectionKey, drafts, username, cancellationToken);
        return Ok(draft);
    }

    [HttpDelete("drafts/{id:guid}")]
    public async Task<IActionResult> DeleteDraft(Guid id, CancellationToken cancellationToken)
    {
        var username = ResolveUsername();
        var drafts = await CompatibilitySnapshotStore.LoadListAsync<QuestionStudioDraftSnapshot>(dbContext, DraftSectionKey, cancellationToken);
        var removed = drafts.RemoveAll(item => item.Id == id && string.Equals(item.OwnerUsername, username, StringComparison.OrdinalIgnoreCase));
        if (removed == 0) return NotFound();

        await CompatibilitySnapshotStore.SaveListAsync(dbContext, DraftSectionKey, drafts, username, cancellationToken);
        return NoContent();
    }

    private string ResolveUsername()
    {
        return User.FindFirstValue("unique_name")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.Identity?.Name
            ?? "teacher";
    }

    private string ResolveFullName()
    {
        return User.FindFirstValue("name") ?? User.Identity?.Name ?? "Öğretmen";
    }
}

public sealed class QuestionStudioDraftRequest
{
    public Guid? Id { get; set; }
    public string? Title { get; set; }
    public string? Mode { get; set; }
    public string? PayloadJson { get; set; }
}

public sealed class QuestionStudioDraftSnapshot
{
    public Guid Id { get; set; }
    public string OwnerUsername { get; set; } = string.Empty;
    public string OwnerName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Mode { get; set; } = "QuestionBank";
    public string PayloadJson { get; set; } = "{}";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
