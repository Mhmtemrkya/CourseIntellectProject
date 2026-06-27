using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace CourseIntellect.Api.Controllers;

// Geçerli kullanıcının tüm içerik etkileşim durumlarını (ilerleme, beğeni,
// favori, not) tek seferde döndürür. Favoriler sayfası ve merkezi "Notlarım"
// senkronizasyonu bu uç üzerinden beslenir. Başka kullanıcıların verisi
// dönmez; ScopeKey kullanıcı kimliğiyle ön eklenir.
[ApiController]
[Authorize]
[Route("api/contents/my-engagement")]
public sealed class MyContentEngagementController(CourseIntellectDbContext dbContext) : ControllerBase
{
    private const string UserConfigurationType = "content-user-state";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirstValue("nameid")
            ?? User.FindFirstValue("sub")
            ?? User.FindFirstValue("user_id")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        var tenantIdClaim = User.FindFirstValue("tenant_id");
        if (!Guid.TryParse(userIdClaim, out var userId) || !Guid.TryParse(tenantIdClaim, out var tenantId))
        {
            return Unauthorized();
        }

        var prefix = $"{userId:N}:";
        var rows = await dbContext.PlatformConfigurations
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId
                && item.ConfigurationType == UserConfigurationType
                && item.ScopeKey.StartsWith(prefix))
            .Select(item => new { item.ScopeKey, item.PayloadJson, item.UpdatedAtUtc })
            .ToListAsync(cancellationToken);

        var states = new List<MyContentStateDto>(rows.Count);
        foreach (var row in rows)
        {
            var separatorIndex = row.ScopeKey.IndexOf(':');
            if (separatorIndex < 0 || separatorIndex + 1 >= row.ScopeKey.Length) continue;
            var contentIdRaw = row.ScopeKey[(separatorIndex + 1)..];
            if (!Guid.TryParseExact(contentIdRaw, "N", out var contentId)) continue;
            if (string.IsNullOrWhiteSpace(row.PayloadJson)) continue;

            ContentUserState? state;
            try
            {
                state = JsonSerializer.Deserialize<ContentUserState>(row.PayloadJson, JsonOptions);
            }
            catch
            {
                continue;
            }
            if (state is null) continue;

            states.Add(new MyContentStateDto(
                contentId,
                state.Progress,
                state.Liked,
                state.Favorite,
                state.Note ?? string.Empty,
                state.UpdatedAtUtc ?? row.UpdatedAtUtc));
        }

        return Ok(states
            .OrderByDescending(item => item.UpdatedAtUtc)
            .ToList());
    }
}

public sealed record MyContentStateDto(
    Guid ContentId,
    double Progress,
    bool Liked,
    bool Favorite,
    string Note,
    DateTime UpdatedAtUtc);
