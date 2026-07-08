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
    /// <summary>
    /// Plan değişimini öğrencinin tüm açık oturumlarına (desktop + mobil) yayınlar.
    /// </summary>
    private Task BroadcastAsync(string studentName, StudyPlanStateDto state, CancellationToken cancellationToken)
    {
        return studyPlanHub.Clients
            .Group(StudyPlanHub.BuildStudentGroup(studentName))
            .SendAsync("studyPlanUpdated", state, cancellationToken);
    }

    [HttpGet]
    [Authorize(Roles = "Student,Teacher,Admin")]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        // Güvenlik: claim çözülemiyorsa sabit bir isme (eski "Ali Yilmaz"
        // fallback'i) düşmek başkasının planını açardı; istek reddedilir.
        var fullName = User.FindFirstValue("name");
        if (string.IsNullOrWhiteSpace(fullName))
        {
            return Unauthorized(new { message = "Oturum bilgisi alınamadı." });
        }

        var item = await studyPlanService.GetOrCreateAsync(fullName, cancellationToken);
        return Ok(item);
    }

    [HttpPut]
    [Authorize(Roles = "Student,Teacher,Admin")]
    public async Task<IActionResult> Update([FromBody] UpdateStudyPlanStateRequest request, CancellationToken cancellationToken)
    {
        // Güvenlik: studentName client-supplied olamaz. GET claim'den okurken
        // PUT request body'den alıyordu — kullanıcı başkasının planına yazabilirdi.
        // Token claim'inden çözüp request'i o ad ile override ediyoruz.
        var fullName = User.FindFirstValue("name");
        if (string.IsNullOrWhiteSpace(fullName))
        {
            return Unauthorized(new { message = "Oturum bilgisi alınamadı." });
        }

        var scopedRequest = request with { StudentName = fullName };
        var item = await studyPlanService.UpdateAsync(scopedRequest, cancellationToken);
        await BroadcastAsync(fullName, item, cancellationToken);
        return Ok(item);
    }

    [HttpPost("xp")]
    [Authorize(Roles = "Student,Teacher,Admin")]
    public async Task<IActionResult> AddXp([FromBody] AddStudyPlanXpRequest request, CancellationToken cancellationToken)
    {
        var fullName = User.FindFirstValue("name");
        if (string.IsNullOrWhiteSpace(fullName))
        {
            return Unauthorized(new { message = "Oturum bilgisi alınamadı." });
        }

        if (request.Amount <= 0)
        {
            return BadRequest(new { message = "XP miktarı pozitif olmalıdır." });
        }

        var item = await studyPlanService.AddXpAsync(fullName, request.Amount, cancellationToken);
        await BroadcastAsync(fullName, item, cancellationToken);
        return Ok(item);
    }

    [HttpPost("items")]
    [Authorize(Roles = "Student,Teacher,Admin")]
    public async Task<IActionResult> AddItem([FromBody] StudyPlanItemRequest request, CancellationToken cancellationToken)
    {
        var fullName = User.FindFirstValue("name");
        if (string.IsNullOrWhiteSpace(fullName))
        {
            return Unauthorized(new { message = "Oturum bilgisi alınamadı." });
        }

        var item = await studyPlanService.AddItemAsync(fullName, request, cancellationToken);
        await BroadcastAsync(fullName, item, cancellationToken);
        return Ok(item);
    }

    [HttpPatch("items/{itemId}/done")]
    [Authorize(Roles = "Student,Teacher,Admin")]
    public async Task<IActionResult> SetItemDone(string itemId, [FromBody] SetStudyPlanItemDoneRequest request, CancellationToken cancellationToken)
    {
        var fullName = User.FindFirstValue("name");
        if (string.IsNullOrWhiteSpace(fullName))
        {
            return Unauthorized(new { message = "Oturum bilgisi alınamadı." });
        }

        var item = await studyPlanService.SetItemDoneAsync(fullName, itemId, request.Done, cancellationToken);
        await BroadcastAsync(fullName, item, cancellationToken);
        return Ok(item);
    }

    [HttpDelete("items/{itemId}")]
    [Authorize(Roles = "Student,Teacher,Admin")]
    public async Task<IActionResult> DeleteItem(string itemId, CancellationToken cancellationToken)
    {
        var fullName = User.FindFirstValue("name");
        if (string.IsNullOrWhiteSpace(fullName))
        {
            return Unauthorized(new { message = "Oturum bilgisi alınamadı." });
        }

        var item = await studyPlanService.DeleteItemAsync(fullName, itemId, cancellationToken);
        await BroadcastAsync(fullName, item, cancellationToken);
        return Ok(item);
    }
}
