using System.Security.Claims;
using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using CourseIntellect.Api.Authorization;
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
    [RequireEntitlement("installments", "plan-create")]
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
    [RequireEntitlement("collections", "collect")]
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

    // Peşinatı beklenen (tahsil edilmemiş) sözleşmeler — tahsilat ekranı listesi.
    [HttpGet("pending-down-payments")]
    public async Task<IActionResult> GetPendingDownPayments(CancellationToken cancellationToken)
    {
        return Ok(await studentFinanceService.GetPendingDownPaymentsAsync(cancellationToken));
    }

    // Bekleyen peşinatı makbuzlu tahsil eder ve sözleşmeyi "ödendi" işaretler.
    [HttpPost("contracts/{contractId:guid}/collect-down-payment")]
    [RequireEntitlement("collections", "collect")]
    public async Task<IActionResult> CollectDownPayment(Guid contractId, [FromBody] CollectDownPaymentRequest? request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await studentFinanceService.CollectDownPaymentAsync(contractId, request?.Method, CurrentUserId(), cancellationToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("refunds")]
    [RequireEntitlement("collections", "refund")]
    public async Task<IActionResult> Refund([FromBody] RefundRequest request, CancellationToken cancellationToken)
    {
        if (request.Amount <= 0)
        {
            return BadRequest(new { message = "İade tutarı sıfırdan büyük olmalı." });
        }

        if (request.PaymentId == Guid.Empty)
        {
            return BadRequest(new { message = "İade edilecek tahsilat seçilmelidir." });
        }
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new { message = "İade gerekçesi zorunludur." });
        }
        try
        {
            return Ok(await studentFinanceService.RefundPaymentAsync(request, CurrentUserId(), cancellationToken));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    [HttpPost("reminders")]
    [RequireEntitlement("late-payments", "notify")]
    public async Task<IActionResult> SendReminders([FromQuery] int upcomingWindowDays = 7, CancellationToken cancellationToken = default)
    {
        return Ok(await studentFinanceService.SendDueRemindersAsync(upcomingWindowDays, cancellationToken));
    }

    // Eski taksitsiz (vadesiz) sözleşmeleri tek seferde takibe alır.
    [HttpPost("backfill-installments")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> BackfillInstallments(CancellationToken cancellationToken)
    {
        var count = await studentFinanceService.BackfillMissingInstallmentsAsync(cancellationToken);
        return Ok(new { created = count, message = $"{count} sözleşme takibe alındı." });
    }

    // Geçmiş "Peşinat" yöntemli kayıt peşinatlarını tek seferde "Nakit"e çevirir.
    [HttpPost("backfill-downpayment-method")]
    [Authorize(Roles = "Accounting,Admin")]
    public async Task<IActionResult> BackfillDownPaymentMethod(CancellationToken cancellationToken)
    {
        var count = await studentFinanceService.BackfillDownPaymentMethodAsync(cancellationToken);
        return Ok(new { updated = count, message = $"{count} peşinat Nakit'e çevrildi." });
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
    [RequireEntitlement("reconciliation", "run")]
    public async Task<IActionResult> Reconcile([FromBody] ReconciliationRequest request, CancellationToken cancellationToken)
    {
        return Ok(await reconciliationService.ReconcileAsync(request, cancellationToken));
    }

    // ---- Faz 4 ----
    [HttpPost("e-invoice/issue")]
    [RequireEntitlement("billing", "invoice-create")]
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
