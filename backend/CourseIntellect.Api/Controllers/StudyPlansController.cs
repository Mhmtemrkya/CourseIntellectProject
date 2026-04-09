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
        var item = await studyPlanService.UpdateAsync(request, cancellationToken);
        return Ok(item);
    }
}
