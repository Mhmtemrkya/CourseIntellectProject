using System.Security.Claims;
using CourseIntellect.Application.DTOs.StudyPlans;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class StudyPlansController(IStudyPlanService studyPlanService) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Student,Teacher,Admin")]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var fullName = User.FindFirstValue("name") ?? "Ali Yilmaz";
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
        return Ok(item);
    }
}
