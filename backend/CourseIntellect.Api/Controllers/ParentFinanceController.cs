using System.Security.Claims;
using CourseIntellect.Api.Security;
using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Veliye kendi çocuklarının normalize finans verisini (cari/taksit/ödeme)
/// gösterir ve ödeme yapmasına izin verir. Kapsam StudentScope ile sınırlanır:
/// veli yalnızca kendi çocukları için işlem yapabilir.
/// </summary>
[ApiController]
[Authorize(Roles = "Parent,Admin,Administrative")]
[Route("api/parent/finance")]
public sealed class ParentFinanceController(
    IStudentFinanceService studentFinanceService,
    CourseIntellectDbContext dbContext) : ControllerBase
{
    [HttpGet("children")]
    public async Task<IActionResult> GetChildrenFinance(CancellationToken cancellationToken)
    {
        var allowed = await StudentScope.ResolveAllowedStudentNamesAsync(User, dbContext, cancellationToken);
        if (allowed is null)
        {
            return Ok(Array.Empty<object>());
        }

        var accounts = new List<StudentFinanceAccountDto>();
        foreach (var name in allowed)
        {
            if (string.IsNullOrWhiteSpace(name)) continue;
            accounts.Add(await studentFinanceService.GetAccountAsync(null, name, cancellationToken));
        }

        return Ok(accounts);
    }

    [HttpPost("pay")]
    public async Task<IActionResult> Pay([FromBody] ParentPaymentRequest request, CancellationToken cancellationToken)
    {
        if (request.Amount <= 0 || string.IsNullOrWhiteSpace(request.StudentName))
        {
            return BadRequest(new { message = "Öğrenci ve geçerli tutar zorunludur." });
        }

        var allowed = await StudentScope.ResolveAllowedStudentNamesAsync(User, dbContext, cancellationToken);
        if (allowed is not null &&
            !allowed.Any(name => string.Equals(name?.Trim(), request.StudentName.Trim(), StringComparison.OrdinalIgnoreCase)))
        {
            return Forbid();
        }

        var payment = await studentFinanceService.RecordPaymentAsync(
            new RecordPaymentRequest(
                null,
                request.StudentName.Trim(),
                null,
                null,
                request.Amount,
                string.IsNullOrWhiteSpace(request.Method) ? "Online" : request.Method.Trim(),
                "Veli ödemesi"),
            CurrentUserId(),
            cancellationToken);

        return Ok(payment);
    }

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue("user_id") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}

public sealed record ParentPaymentRequest(string StudentName, decimal Amount, string? Method);
