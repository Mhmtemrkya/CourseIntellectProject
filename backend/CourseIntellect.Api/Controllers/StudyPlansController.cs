using CourseIntellect.Api.Security;
using System.Security.Claims;
using CourseIntellect.Api.Authorization;
using CourseIntellect.Api.Hubs;
using CourseIntellect.Application.DTOs.StudyPlans;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
[RequireEntitlement("study-plan")]
public sealed class StudyPlansController(
    IStudyPlanService studyPlanService,
    IHubContext<StudyPlanHub> studyPlanHub) : ControllerBase
{
    /// <summary>Plan sahibi: oturumdaki kullanıcının kimliği (istemci başka birini seçemez) ve gösterim adı.</summary>
    private (Guid UserId, string Name)? Owner()
    {
        var userId = StudentScope.ResolveUserId(User);
        var name = User.FindFirstValue("name");
        return userId is Guid id && !string.IsNullOrWhiteSpace(name) ? (id, name) : null;
    }

    private static UnauthorizedObjectResult NoSession() => new(new { message = "Oturum bilgisi alınamadı." });

    /// <summary>Plan değişimini öğrencinin tüm açık oturumlarına (desktop + mobil) yayınlar (kimliğe göre).</summary>
    private Task BroadcastAsync(Guid userId, StudyPlanStateDto state, CancellationToken cancellationToken) =>
        studyPlanHub.Clients
            .Group(StudyPlanHub.BuildUserGroup(User.FindFirstValue("tenant_id"), userId))
            .SendAsync("studyPlanUpdated", state, cancellationToken);

    [HttpGet]
    [Authorize(Roles = "Student,Teacher,Admin")]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        if (Owner() is not { } owner) return NoSession();
        return Ok(await studyPlanService.GetOrCreateAsync(owner.UserId, owner.Name, cancellationToken));
    }

    [HttpPut]
    [Authorize(Roles = "Student,Teacher,Admin")]
    public async Task<IActionResult> Update([FromBody] UpdateStudyPlanStateRequest request, CancellationToken cancellationToken)
    {
        // Güvenlik: istemcinin gönderdiği öğrenci adı/XP KULLANILMAZ; yalnız kendi programı, yalnız maddeler yazılır.
        if (Owner() is not { } owner) return NoSession();
        var item = await studyPlanService.UpdatePlanItemsAsync(owner.UserId, owner.Name, request.PlanItemsSerialized, cancellationToken);
        await BroadcastAsync(owner.UserId, item, cancellationToken);
        return Ok(item);
    }

    [HttpPost("xp")]
    [Authorize(Roles = "Student,Teacher,Admin")]
    public async Task<IActionResult> AddXp([FromBody] AddStudyPlanXpRequest request, CancellationToken cancellationToken)
    {
        // Güvenlik: istemcinin gönderdiği XP miktarı KABUL EDİLMEZ; XP yalnız sunucu ödüllerinden gelir.
        // Uç, eski istemciler hata almasın diye durur ve değişiklik yapmadan güncel durumu döndürür.
        _ = request;
        if (Owner() is not { } owner) return NoSession();
        return Ok(await studyPlanService.GetOrCreateAsync(owner.UserId, owner.Name, cancellationToken));
    }

    [HttpPost("items")]
    [Authorize(Roles = "Student,Teacher,Admin")]
    public async Task<IActionResult> AddItem([FromBody] StudyPlanItemRequest request, CancellationToken cancellationToken)
    {
        if (Owner() is not { } owner) return NoSession();
        var item = await studyPlanService.AddItemAsync(owner.UserId, owner.Name, request, cancellationToken);
        await BroadcastAsync(owner.UserId, item, cancellationToken);
        return Ok(item);
    }

    [HttpPatch("items/{itemId}/done")]
    [Authorize(Roles = "Student,Teacher,Admin")]
    public async Task<IActionResult> SetItemDone(string itemId, [FromBody] SetStudyPlanItemDoneRequest request, CancellationToken cancellationToken)
    {
        if (Owner() is not { } owner) return NoSession();
        var item = await studyPlanService.SetItemDoneAsync(owner.UserId, owner.Name, itemId, request.Done, cancellationToken);
        await BroadcastAsync(owner.UserId, item, cancellationToken);
        return Ok(item);
    }

    [HttpDelete("items/{itemId}")]
    [Authorize(Roles = "Student,Teacher,Admin")]
    public async Task<IActionResult> DeleteItem(string itemId, CancellationToken cancellationToken)
    {
        if (Owner() is not { } owner) return NoSession();
        var item = await studyPlanService.DeleteItemAsync(owner.UserId, owner.Name, itemId, cancellationToken);
        await BroadcastAsync(owner.UserId, item, cancellationToken);
        return Ok(item);
    }
}
