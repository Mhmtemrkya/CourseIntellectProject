using System.Security.Claims;
using System.Text.Json;
using CourseIntellect.Api.Controllers;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Api.Hubs;

/// <summary>
/// Soru içe aktarma ilerlemesi. Gruba yalnız içe aktarma yetkisi olan roller ve
/// yalnız kendi kurumundaki bir iş için katılınabilir. Eskiden kontrol yoktu:
/// giriş yapmış herkes (öğrenci, başka kurum) iş kimliğiyle ilerlemeyi dinleyebiliyordu.
/// </summary>
[Authorize(Roles = "Teacher,Admin")]
public sealed class QuestionImportHub(CourseIntellectDbContext dbContext) : Hub
{
    public async Task JoinImport(string importId)
    {
        if (!Guid.TryParse(importId, out var id) || !await JobBelongsToCallerTenantAsync(id)) return;
        await Groups.AddToGroupAsync(Context.ConnectionId, BuildImportGroup(importId));
    }

    public Task LeaveImport(string importId)
    {
        return Groups.RemoveFromGroupAsync(Context.ConnectionId, BuildImportGroup(importId));
    }

    public static string BuildImportGroup(string importId) => $"question-import-{importId}";

    // Hub'da HttpContext'e dayalı kurum filtresine güvenilmez; kurum açıkça süzülür.
    private async Task<bool> JobBelongsToCallerTenantAsync(Guid jobId)
    {
        if (!Guid.TryParse(Context.User?.FindFirstValue("tenant_id"), out var tenantId)) return false;

        var raw = await dbContext.SiteContentItems
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(item => item.TenantId == tenantId
                && item.SectionKey == QuestionImportController.SectionKey
                && item.Language == "tr")
            .OrderByDescending(item => item.Version)
            .Select(item => item.ContentJson)
            .FirstOrDefaultAsync();
        if (string.IsNullOrWhiteSpace(raw)) return false;

        try
        {
            var jobs = JsonSerializer.Deserialize<List<QuestionImportJobSnapshot>>(
                raw, new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? [];
            return jobs.Any(job => job.Id == jobId);
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
