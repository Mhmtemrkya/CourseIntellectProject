using CourseIntellect.Application.DTOs.ExamResults;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class ExamResultsController(IAcademicQueryService academicQueryService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? studentName, [FromQuery] string? className, CancellationToken cancellationToken)
    {
        var results = await academicQueryService.GetExamResultsAsync(studentName, className, cancellationToken);
        return Ok(results);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Teacher")]
    public async Task<IActionResult> Create([FromBody] CreateExamResultRequest request, CancellationToken cancellationToken)
    {
        var result = await academicQueryService.CreateExamResultAsync(request, cancellationToken);
        return Ok(result);
    }
}
