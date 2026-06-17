using System.Security.Claims;
using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class StudentsController(
    IAcademicQueryService academicQueryService,
    IStudentFinanceService studentFinanceService) : ControllerBase
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

        // Kayıt ücreti girildiyse otomatik sözleşme + taksit planı oluştur.
        if (request.EnrollmentGrossAmount is decimal gross && gross > 0)
        {
            await studentFinanceService.CreateEnrollmentAsync(
                new CreateEnrollmentRequest(
                    result.UserId,
                    result.FullName,
                    result.ClassName,
                    request.AcademicYear ?? string.Empty,
                    gross,
                    request.EnrollmentDiscountAmount ?? 0,
                    request.EnrollmentDiscountReason,
                    request.EnrollmentDownPayment ?? 0,
                    request.EnrollmentInstallmentCount ?? 0,
                    null,
                    "TRY",
                    "Kayıt sırasında oluşturuldu"),
                CurrentUserId(),
                cancellationToken);
        }

        return CreatedAtAction(nameof(GetStudents), new { id = result.UserId }, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> UpdateStudent(
        Guid id,
        [FromBody] CourseIntellect.Application.DTOs.Students.UpdateStudentRequest request,
        CancellationToken cancellationToken)
    {
        var result = await academicQueryService.UpdateStudentAsync(id, request, cancellationToken);
        return result is null ? NotFound(new { message = "Ogrenci bulunamadi." }) : Ok(result);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Administrative")]
    public async Task<IActionResult> DeleteStudent(Guid id, CancellationToken cancellationToken)
    {
        var removed = await academicQueryService.DeleteStudentAsync(id, cancellationToken);
        return removed ? NoContent() : NotFound(new { message = "Ogrenci bulunamadi." });
    }

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
