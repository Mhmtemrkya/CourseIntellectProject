using System.Security.Claims;
using CourseIntellect.Api.Authorization;
using CourseIntellect.Api.Security;
using CourseIntellect.Infrastructure.Persistence;
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
    IStudentFinanceService studentFinanceService,
    CourseIntellectDbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Öğrenci listesi. KAPSAM DENETİMİ ŞART: bu uç TC kimlik no, adres ve veli
    /// telefonu taşır. Personel rolleri kurumun tamamını görür; ÖĞRENCİ yalnız
    /// kendisini, VELİ yalnız kendi çocuklarını görür — aksi hâlde tek bir
    /// öğrenci hesabı tüm kurumun kişisel verisini çekebilir.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetStudents(CancellationToken cancellationToken)
    {
        var students = await academicQueryService.GetStudentsAsync(cancellationToken);

        var allowedNames = await StudentScope.ResolveAllowedStudentNamesAsync(User, dbContext, cancellationToken);
        if (allowedNames is not null)
        {
            students = StudentScope.FilterByStudentNames(students, allowedNames, item => item.FullName);
        }

        return Ok(students);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("students", "create")]
    public async Task<IActionResult> CreateStudent(
        [FromBody] CourseIntellect.Application.DTOs.Students.CreateStudentRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await academicQueryService.CreateStudentAsync(
                request,
                cancellationToken,
                requireTcNo: true,
                linkExistingParent: true,
                validateParentPhone: true);

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
                    "Kayıt sırasında oluşturuldu",
                    request.EnrollmentDownPaymentMethod,
                    request.EnrollmentDownPaymentPaid),
                CurrentUserId(),
                cancellationToken);
        }

            return CreatedAtAction(nameof(GetStudents), new { id = result.UserId }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("students", "edit")]
    public async Task<IActionResult> UpdateStudent(
        Guid id,
        [FromBody] CourseIntellect.Application.DTOs.Students.UpdateStudentRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await academicQueryService.UpdateStudentAsync(id, request, cancellationToken);
            return result is null ? NotFound(new { message = "Ogrenci bulunamadi." }) : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Dönem sonu sınıf yükseltme (ör. 7-A → 8-A). Yalnız kurum yöneticisi ve şube
    /// müdürü yapabilir — şube müdürü JWT'de Admin rolü taşır, verisi ise şube
    /// grant'i ile kendi şubesine kilitlidir. İdari personel bu işlemi yapamaz.
    /// </summary>
    [HttpPost("promote")]
    [Authorize(Roles = "Admin")]
    [RequireEntitlement("students", "edit")]
    public async Task<IActionResult> PromoteStudents(
        [FromBody] CourseIntellect.Application.DTOs.Students.PromoteStudentsRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await academicQueryService.PromoteStudentsAsync(request, cancellationToken));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("students", "delete")]
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
