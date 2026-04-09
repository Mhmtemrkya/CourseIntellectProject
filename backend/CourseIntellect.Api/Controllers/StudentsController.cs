using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class StudentsController(IAcademicQueryService academicQueryService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetStudents(CancellationToken cancellationToken)
    {
        var students = await academicQueryService.GetStudentsAsync(cancellationToken);
        return Ok(students);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> CreateStudent(
        [FromBody] CourseIntellect.Application.DTOs.Students.CreateStudentRequest request,
        CancellationToken cancellationToken)
    {
        var result = await academicQueryService.CreateStudentAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetStudents), new { id = result.UserId }, result);
    }
}
