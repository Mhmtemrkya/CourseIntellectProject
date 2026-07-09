using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/contents/{contentId:guid}/engagement")]
public sealed class ContentEngagementController(CourseIntellectDbContext dbContext) : ControllerBase
{
    private const string ExtrasConfigurationType = "content-extras";
    private const string UserConfigurationType = "content-user-state";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpGet]
    public async Task<IActionResult> Get(Guid contentId, CancellationToken cancellationToken)
    {
        var (_, tenantId) = ResolveContext();
        if (tenantId is null) return Unauthorized();

        var contentExists = await dbContext.ContentItems
            .AsNoTracking()
            .AnyAsync(item => item.Id == contentId && item.TenantId == tenantId.Value, cancellationToken);
        if (!contentExists) return NotFound(new { message = "İçerik bulunamadı." });

        var extras = await ReadPayloadAsync<ContentExtrasState>(
            ExtrasConfigurationType,
            contentId.ToString("N"),
            tenantId.Value,
            cancellationToken) ?? new ContentExtrasState();

        var userState = await ReadUserStateAsync(contentId, tenantId.Value, cancellationToken) ?? new ContentUserState();

        return Ok(new ContentEngagementResponse(
            extras.CoverImageUrl,
            extras.Exercises,
            extras.Comments.OrderByDescending(item => item.CreatedAtUtc).ToList(),
            userState.Progress,
            userState.Liked,
            userState.Favorite,
            userState.Note));
    }

    [HttpPut("extras")]
    [Authorize(Roles = "Teacher,Admin")]
    public async Task<IActionResult> SaveExtras(Guid contentId, [FromBody] SaveContentExtrasRequest request, CancellationToken cancellationToken)
    {
        var (_, tenantId) = ResolveContext();
        if (tenantId is null) return Unauthorized();

        var content = await dbContext.ContentItems.FirstOrDefaultAsync(item => item.Id == contentId && item.TenantId == tenantId.Value, cancellationToken);
        if (content is null) return NotFound(new { message = "İçerik bulunamadı." });

        content.CoverImageUrl = string.IsNullOrWhiteSpace(request.CoverImageUrl) ? null : request.CoverImageUrl.Trim();

        var existing = await ReadPayloadAsync<ContentExtrasState>(
            ExtrasConfigurationType,
            contentId.ToString("N"),
            tenantId.Value,
            cancellationToken) ?? new ContentExtrasState();

        existing.CoverImageUrl = content.CoverImageUrl;
        existing.Exercises = request.Exercises
            .Where(item => !string.IsNullOrWhiteSpace(item.Title))
            .Take(50)
            .Select(item => item with
            {
                Id = string.IsNullOrWhiteSpace(item.Id) ? Guid.NewGuid().ToString("N") : item.Id.Trim(),
                Title = item.Title.Trim(),
                Description = item.Description?.Trim() ?? string.Empty,
                Url = item.Url?.Trim() ?? string.Empty,
            })
            .ToList();

        await SavePayloadAsync(ExtrasConfigurationType, contentId.ToString("N"), $"CONTENT_EXTRAS::{contentId:N}", existing, tenantId.Value, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(existing);
    }

    [HttpPut("state")]
    public async Task<IActionResult> SaveState(Guid contentId, [FromBody] SaveContentUserStateRequest request, CancellationToken cancellationToken)
    {
        var (userId, tenantId) = ResolveContext();
        if (userId is null || tenantId is null) return Unauthorized();

        var contentExists = await dbContext.ContentItems
            .AsNoTracking()
            .AnyAsync(item => item.Id == contentId && item.TenantId == tenantId.Value, cancellationToken);
        if (!contentExists) return NotFound(new { message = "İçerik bulunamadı." });

        var state = new ContentUserState(
            Math.Clamp(request.Progress, 0, 100),
            request.Liked,
            request.Favorite,
            request.Note?.Trim() ?? string.Empty,
            DateTime.UtcNow);

        await SavePayloadAsync(UserConfigurationType, UserScopeKey(userId.Value, contentId), $"CONTENT_STATE::{userId:N}::{contentId:N}", state, tenantId.Value, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(state);
    }

    [HttpPost("comments")]
    public async Task<IActionResult> AddComment(Guid contentId, [FromBody] AddContentCommentRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Message)) return BadRequest(new { message = "Yorum boş olamaz." });

        var (_, tenantId) = ResolveContext();
        if (tenantId is null) return Unauthorized();

        var contentExists = await dbContext.ContentItems
            .AsNoTracking()
            .AnyAsync(item => item.Id == contentId && item.TenantId == tenantId.Value, cancellationToken);
        if (!contentExists) return NotFound(new { message = "İçerik bulunamadı." });

        var extras = await ReadPayloadAsync<ContentExtrasState>(
            ExtrasConfigurationType,
            contentId.ToString("N"),
            tenantId.Value,
            cancellationToken) ?? new ContentExtrasState();

        extras.Comments.Add(new ContentCommentDto(
            Guid.NewGuid().ToString("N"),
            User.FindFirstValue("name") ?? User.Identity?.Name ?? "Kullanıcı",
            User.FindFirstValue("role") ?? "Student",
            request.Message.Trim(),
            DateTime.UtcNow));

        extras.Comments = extras.Comments
            .OrderByDescending(item => item.CreatedAtUtc)
            .Take(200)
            .OrderBy(item => item.CreatedAtUtc)
            .ToList();

        await SavePayloadAsync(ExtrasConfigurationType, contentId.ToString("N"), $"CONTENT_EXTRAS::{contentId:N}", extras, tenantId.Value, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(extras.Comments.OrderByDescending(item => item.CreatedAtUtc).ToList());
    }

    private async Task<ContentUserState?> ReadUserStateAsync(Guid contentId, Guid tenantId, CancellationToken cancellationToken)
    {
        var (userId, _) = ResolveContext();
        if (userId is null) return null;
        return await ReadPayloadAsync<ContentUserState>(UserConfigurationType, UserScopeKey(userId.Value, contentId), tenantId, cancellationToken);
    }

    private async Task<T?> ReadPayloadAsync<T>(string type, string scopeKey, Guid tenantId, CancellationToken cancellationToken)
    {
        var entity = await dbContext.PlatformConfigurations
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.TenantId == tenantId && item.ConfigurationType == type && item.ScopeKey == scopeKey, cancellationToken);
        if (entity is null || string.IsNullOrWhiteSpace(entity.PayloadJson)) return default;
        try
        {
            return JsonSerializer.Deserialize<T>(entity.PayloadJson, JsonOptions);
        }
        catch
        {
            return default;
        }
    }

    private async Task SavePayloadAsync<T>(string type, string scopeKey, string displayName, T payload, Guid tenantId, CancellationToken cancellationToken)
    {
        var json = JsonSerializer.Serialize(payload, JsonOptions);
        var entity = await dbContext.PlatformConfigurations
            .FirstOrDefaultAsync(item => item.TenantId == tenantId && item.ConfigurationType == type && item.ScopeKey == scopeKey, cancellationToken);

        if (entity is null)
        {
            entity = new PlatformConfiguration
            {
                TenantId = tenantId,
                ConfigurationType = type,
                ScopeKey = scopeKey,
                DisplayName = displayName,
                PayloadJson = json,
                UpdatedAtUtc = DateTime.UtcNow,
            };
            await dbContext.PlatformConfigurations.AddAsync(entity, cancellationToken);
            return;
        }

        entity.PayloadJson = json;
        entity.UpdatedAtUtc = DateTime.UtcNow;
    }

    private static string UserScopeKey(Guid userId, Guid contentId) => $"{userId:N}:{contentId:N}";

    private (Guid? UserId, Guid? TenantId) ResolveContext()
    {
        var userIdClaim = User.FindFirstValue("nameid") ?? User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId)) return (null, null);
        return (userId, dbContext.CurrentTenantId);
    }
}

public sealed record ContentEngagementResponse(
    string? CoverImageUrl,
    IReadOnlyList<ContentExerciseDto> Exercises,
    IReadOnlyList<ContentCommentDto> Comments,
    double Progress,
    bool Liked,
    bool Favorite,
    string Note);

public sealed record SaveContentExtrasRequest(
    string? CoverImageUrl,
    IReadOnlyList<ContentExerciseDto> Exercises);

public sealed record SaveContentUserStateRequest(
    double Progress,
    bool Liked,
    bool Favorite,
    string? Note);

public sealed record AddContentCommentRequest(string Message);

public sealed record ContentExtrasState
{
    public string? CoverImageUrl { get; set; }
    public List<ContentExerciseDto> Exercises { get; set; } = [];
    public List<ContentCommentDto> Comments { get; set; } = [];
}

public sealed record ContentUserState(
    double Progress = 0,
    bool Liked = false,
    bool Favorite = false,
    string Note = "",
    DateTime? UpdatedAtUtc = null);

public sealed record ContentExerciseDto(
    string Id,
    string Title,
    string Description,
    string Url);

public sealed record ContentCommentDto(
    string Id,
    string AuthorName,
    string AuthorRole,
    string Message,
    DateTime CreatedAtUtc);
