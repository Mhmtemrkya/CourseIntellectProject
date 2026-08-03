using System.Security.Claims;
using CourseIntellect.Application.DTOs.Staff;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using CourseIntellect.Api.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class StaffController(IStaffManagementService staffManagementService) : ControllerBase
{
    /// <summary>
    /// Personel listesi. Öğrenci ve veli bu listeyi "öğretmen seçme" (soru kutusu,
    /// görüşme talebi) akışlarında kullanır; bu yüzden erişim tamamen kapatılmaz
    /// ama KİŞİSEL VERİ ALANLARI (TC, telefon, e-posta, eğitim, medeni durum, not)
    /// maskelenir. Aksi hâlde tek bir öğrenci hesabı tüm kadronun TC'sini çekebilir.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? role, CancellationToken cancellationToken)
    {
        var staff = await staffManagementService.GetStaffAsync(role, cancellationToken);

        // Personel rolleri (yönetim/muhasebe/idari) kadronun tamamını görür.
        // Öğretmen KENDİ kaydını tam görür (profil ekranı buradan okur), meslektaş
        // kayıtlarında kişisel alanlar maskelenir. Öğrenci/veli hepsinde maskelidir.
        var isStaffManager = User.IsInRole("Admin") || User.IsInRole("Administrative")
            || User.IsInRole("Accounting") || User.IsInRole("BranchManager");
        if (!isStaffManager)
        {
            var selfUserRaw = User.FindFirstValue("user_id") ?? User.FindFirstValue("sub")
                ?? User.FindFirstValue("nameid") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
            Guid.TryParse(selfUserRaw, out var selfUserId);
            var selfUsername = (User.FindFirstValue("unique_name") ?? string.Empty).Trim();

            staff = staff.Select(item => (item.UserId != Guid.Empty && item.UserId == selfUserId)
                || (selfUsername.Length > 0 && string.Equals(item.Username, selfUsername, StringComparison.OrdinalIgnoreCase))
                ? item
                : item with
            {
                TcNo = string.Empty,
                Phone = string.Empty,
                Email = string.Empty,
                Education = string.Empty,
                MaritalStatus = string.Empty,
                ChildCount = 0,
                Note = string.Empty,
                Username = string.Empty,
                StartDate = string.Empty,
            }).ToList();
        }

        return Ok(staff);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("teachers", "create")]
    [ProducesResponseType(typeof(StaffCredentialsDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        [FromBody] CreateStaffRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await staffManagementService.CreateStaffAsync(request, cancellationToken);
            return CreatedAtAction(nameof(Get), new { role = result.Role }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("teachers", "edit")]
    [ProducesResponseType(typeof(StaffSummaryDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(
        Guid id,
        [FromBody] UpdateStaffRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await staffManagementService.UpdateStaffAsync(id, request, cancellationToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Var olan kullanıcının rol/şube/özel rol atamasını günceller (ev grant'ı yenilenir).
    /// Örn. mevcut bir öğretmeni şube müdürü yapmak için kişiyi silip yeniden açmak GEREKMEZ.</summary>
    [HttpPut("users/{userId:guid}/assignment")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateAssignment(
        Guid userId,
        [FromBody] UpdateStaffAssignmentRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            return await staffManagementService.UpdateAssignmentAsync(userId, request, cancellationToken)
                ? Ok(new { message = "Atama güncellendi." })
                : NotFound(new { message = "Kullanıcı bulunamadı." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("users/{userId:guid}")]
    [Authorize(Roles = "Admin,Administrative")]
    [RequireEntitlement("teachers")]
    public async Task<IActionResult> DeleteByUserId(Guid userId, CancellationToken cancellationToken)
    {
        try
        {
            return await staffManagementService.DeleteStaffByUserIdAsync(userId, cancellationToken)
                ? NoContent()
                : NotFound(new { message = "Personel kullanıcısı bulunamadı." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("accounting")]
    [Authorize(Roles = "Admin")]
    [RequireEntitlement("registrations", "staff-register")]
    [ProducesResponseType(typeof(StaffCredentialsDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreateAccounting(
        [FromBody] CreateAccountingStaffRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await staffManagementService.CreateAccountingStaffAsync(request, cancellationToken);
            return CreatedAtAction(nameof(Get), new { role = "Accounting" }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
