using System.Security.Claims;
using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize(Roles = "Accounting,Admin,Administrative")]
[Route("api/student-finance")]
public sealed class StudentFinanceController(
    IStudentFinanceService studentFinanceService,
    IPaymentGatewayService paymentGatewayService,
    IEInvoiceService eInvoiceService,
    IPayrollService payrollService,
    IReconciliationService reconciliationService) : ControllerBase
{
    [HttpPost("enrollments")]
    public async Task<IActionResult> CreateEnrollment([FromBody] CreateEnrollmentRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.StudentName))
        {
            return BadRequest(new { message = "Öğrenci adı zorunludur." });
        }

        var result = await studentFinanceService.CreateEnrollmentAsync(request, CurrentUserId(), cancellationToken);
        return Ok(result);
    }

    [HttpGet("account")]
    public async Task<IActionResult> GetAccount(
        [FromQuery] Guid? studentUserId,
        [FromQuery] string? studentName,
        CancellationToken cancellationToken)
    {
        if (studentUserId is null && string.IsNullOrWhiteSpace(studentName))
        {
            return BadRequest(new { message = "studentUserId veya studentName gerekli." });
        }

        return Ok(await studentFinanceService.GetAccountAsync(studentUserId, studentName, cancellationToken));
    }

    [HttpPost("payments")]
    public async Task<IActionResult> RecordPayment([FromBody] RecordPaymentRequest request, CancellationToken cancellationToken)
    {
        if (request.Amount <= 0)
        {
            return BadRequest(new { message = "Tutar sıfırdan büyük olmalı." });
        }

        var result = await studentFinanceService.RecordPaymentAsync(request, CurrentUserId(), cancellationToken);
        return Ok(result);
    }

    [HttpGet("summaries")]
    public async Task<IActionResult> GetSummaries([FromQuery] string? className, CancellationToken cancellationToken)
    {
        return Ok(await studentFinanceService.GetAllSummariesAsync(className, cancellationToken));
    }

    // ---- Faz 2 ----
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard([FromQuery] string? className, CancellationToken cancellationToken)
    {
        return Ok(await studentFinanceService.GetDashboardAsync(className, cancellationToken));
    }

    [HttpPost("refunds")]
    public async Task<IActionResult> Refund([FromBody] RefundRequest request, CancellationToken cancellationToken)
    {
        if (request.Amount <= 0)
        {
            return BadRequest(new { message = "İade tutarı sıfırdan büyük olmalı." });
        }

        return Ok(await studentFinanceService.RefundPaymentAsync(request, CurrentUserId(), cancellationToken));
    }

    [HttpPost("reminders")]
    public async Task<IActionResult> SendReminders([FromQuery] int upcomingWindowDays = 7, CancellationToken cancellationToken = default)
    {
        return Ok(await studentFinanceService.SendDueRemindersAsync(upcomingWindowDays, cancellationToken));
    }

    [HttpPost("payments/intent")]
    public async Task<IActionResult> CreatePaymentIntent([FromBody] PaymentIntentRequest request, CancellationToken cancellationToken)
    {
        return Ok(await paymentGatewayService.CreateIntentAsync(request, cancellationToken));
    }

    [HttpPost("payments/confirm")]
    public async Task<IActionResult> ConfirmPayment([FromBody] ConfirmPaymentRequest request, CancellationToken cancellationToken)
    {
        var success = await paymentGatewayService.ConfirmAsync(request, cancellationToken);
        return Ok(new { success });
    }

    // ---- Faz 3 ----
    [HttpPost("reconciliation")]
    public async Task<IActionResult> Reconcile([FromBody] ReconciliationRequest request, CancellationToken cancellationToken)
    {
        return Ok(await reconciliationService.ReconcileAsync(request, cancellationToken));
    }

    // ---- Faz 4 ----
    [HttpPost("e-invoice/issue")]
    public async Task<IActionResult> IssueEInvoice([FromBody] IssueEInvoiceRequest request, CancellationToken cancellationToken)
    {
        return Ok(await eInvoiceService.IssueAsync(request, cancellationToken));
    }

    [HttpPost("payroll/calculate")]
    public IActionResult CalculatePayroll([FromBody] PayrollRequest request)
    {
        if (request.GrossSalary <= 0)
        {
            return BadRequest(new { message = "Brüt maaş sıfırdan büyük olmalı." });
        }

        return Ok(payrollService.Calculate(request));
    }

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
