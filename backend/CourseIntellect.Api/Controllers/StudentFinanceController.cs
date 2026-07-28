using System.Globalization;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
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
    IReconciliationService reconciliationService,
    IStudentStatementPdfService statementPdfService,
    IPlatformConfigurationService platformConfigurationService,
    ITenantContext tenantContext,
    IAuditLogService auditLogService,
    IWebHostEnvironment environment) : ControllerBase
{
    private const string AuditCategory = "Finance";
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

    /// <summary>
    /// Cari hesap ekstresi. <c>format=pdf</c> ile kurum künyeli, baskıya uygun PDF
    /// döner; varsayılan JSON çıktısı ekranda önizleme için kullanılır. Tarihler
    /// verilmezse ilk hareketten taksit planının sonuna kadar tüm geçmiş kapsanır.
    /// </summary>
    [HttpGet("statement")]
    public async Task<IActionResult> GetStatement(
        [FromQuery] Guid? studentUserId,
        [FromQuery] string? studentName,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] string? format,
        CancellationToken cancellationToken)
    {
        if (studentUserId is null && string.IsNullOrWhiteSpace(studentName))
        {
            return BadRequest(new { message = "studentUserId veya studentName gerekli." });
        }

        if (fromUtc.HasValue && toUtc.HasValue && toUtc.Value.Date < fromUtc.Value.Date)
        {
            return BadRequest(new { message = "Bitiş tarihi başlangıç tarihinden önce olamaz." });
        }

        var statement = await studentFinanceService.GetStatementAsync(
            studentUserId, studentName, fromUtc, toUtc, cancellationToken);

        if (!string.Equals(format, "pdf", StringComparison.OrdinalIgnoreCase))
        {
            return Ok(statement);
        }

        var branding = await ResolveStatementBrandingAsync(cancellationToken);
        var pdf = statementPdfService.Generate(new StudentStatementPdfModel(
            statement, branding.Name, branding.LogoBytes, branding.AccentColor));

        // Cari ekstre bir öğrencinin tüm ödeme geçmişini taşır; kim indirdi kayda geçer.
        await auditLogService.LogAsync(
            "Cari hesap ekstresi indirildi",
            AuditCategory,
            "StudentStatement",
            statement.AccountCode,
            $"{statement.StudentName} • {statement.FromUtc:dd.MM.yyyy}-{statement.ToUtc:dd.MM.yyyy} • "
                + $"bakiye {statement.ClosingBalance.ToString("N2", CultureInfo.GetCultureInfo("tr-TR"))} {statement.Currency}",
            cancellationToken);

        var fileName = $"cari-hesap-ekstresi-{Slug(statement.StudentName)}-{DateTime.UtcNow:yyyyMMdd}.pdf";
        return File(pdf, "application/pdf", fileName);
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
    public async Task<IActionResult> GetDashboard(
        [FromQuery] string? className,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        CancellationToken cancellationToken)
    {
        if (fromUtc.HasValue && toUtc.HasValue && toUtc <= fromUtc)
            return BadRequest(new { message = "Bitiş tarihi başlangıç tarihinden sonra olmalıdır." });
        return Ok(await studentFinanceService.GetDashboardAsync(className, fromUtc, toUtc, cancellationToken));
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

    /// <summary>
    /// Ekstrenin sol üst köşesi: kurumun kendi logosu varsa o, yoksa ürün amblemi
    /// kullanılır. Logo yalnızca gömülü (data:) görselden okunur — dış adres
    /// verilirse sunucu istek yapmaz (SSRF yüzeyi açılmasın).
    /// </summary>
    private async Task<(string Name, byte[]? LogoBytes, string AccentColor)> ResolveStatementBrandingAsync(
        CancellationToken cancellationToken)
    {
        var name = "SchoolAsist";
        var accent = "#0F4C81";
        byte[]? logo = null;

        if (tenantContext.CurrentTenantId is Guid tenantId)
        {
            var configuration = (await platformConfigurationService.GetAsync("tenant-customization", cancellationToken))
                .Where(item => string.Equals(item.ScopeKey, tenantId.ToString(), StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(item => item.UpdatedAtUtc)
                .FirstOrDefault();

            if (!string.IsNullOrWhiteSpace(configuration?.PayloadJson))
            {
                try
                {
                    using var payload = JsonDocument.Parse(configuration.PayloadJson);
                    var root = payload.RootElement;
                    if (ReadString(root, "appName") is { Length: > 0 } appName) name = appName;
                    if (ReadString(root, "primaryColor") is { Length: > 0 } primaryColor) accent = primaryColor;
                    if (ReadString(root, "logoUrl") is { Length: > 0 } logoUrl) logo = DecodeInlineImage(logoUrl);
                }
                catch (JsonException)
                {
                    // Bozuk branding kaydı belgeyi engellemez; varsayılan marka ile devam.
                }
            }
        }

        logo ??= await ReadBrandEmblemAsync(cancellationToken);
        return (name, logo, accent);
    }

    private static string? ReadString(JsonElement root, string property) =>
        root.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()?.Trim()
            : null;

    /// <summary>data: URL'indeki görseli çözer; tür/boyut doğrulanmadan PDF'e gömülmez.</summary>
    private static byte[]? DecodeInlineImage(string value)
    {
        if (!value.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase)) return null;
        var separator = value.IndexOf(";base64,", StringComparison.OrdinalIgnoreCase);
        if (separator < 0) return null;

        var base64 = value[(separator + ";base64,".Length)..];
        // 4/3 taban-64 genişlemesi hesaba katılarak ~3 MB üstü logo reddedilir.
        if (base64.Length > 4 * 1024 * 1024) return null;

        Span<byte> buffer = new byte[base64.Length / 4 * 3 + 3];
        if (!Convert.TryFromBase64String(base64, buffer, out var written) || written == 0) return null;
        var bytes = buffer[..written].ToArray();
        return IsSupportedImage(bytes) ? bytes : null;
    }

    private static bool IsSupportedImage(byte[] bytes)
    {
        var png = bytes.Length > 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
        var jpeg = bytes.Length > 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF;
        var webp = bytes.Length > 12
            && Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF"
            && Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP";
        return png || jpeg || webp;
    }

    private async Task<byte[]?> ReadBrandEmblemAsync(CancellationToken cancellationToken)
    {
        if (_brandEmblem is not null) return _brandEmblem.Length == 0 ? null : _brandEmblem;

        var path = Path.Combine(environment.ContentRootPath, "Assets", "schoolasist-emblem.png");
        _brandEmblem = System.IO.File.Exists(path)
            ? await System.IO.File.ReadAllBytesAsync(path, cancellationToken)
            : [];
        return _brandEmblem.Length == 0 ? null : _brandEmblem;
    }

    private static byte[]? _brandEmblem;

    /// <summary>Dosya adı için Türkçe karakterleri sadeleştirir (Content-Disposition güvenli).</summary>
    private static string Slug(string value)
    {
        var map = new Dictionary<char, char>
        {
            ['ç'] = 'c', ['Ç'] = 'c', ['ğ'] = 'g', ['Ğ'] = 'g', ['ı'] = 'i', ['İ'] = 'i',
            ['ö'] = 'o', ['Ö'] = 'o', ['ş'] = 's', ['Ş'] = 's', ['ü'] = 'u', ['Ü'] = 'u',
        };

        var builder = new StringBuilder();
        foreach (var character in value.Trim())
        {
            var normalized = map.TryGetValue(character, out var replacement)
                ? replacement
                : char.ToLowerInvariant(character);
            if (char.IsAsciiLetterOrDigit(normalized)) builder.Append(normalized);
            else if (builder.Length > 0 && builder[^1] != '-') builder.Append('-');
        }

        return builder.ToString().Trim('-') is { Length: > 0 } slug ? slug : "ogrenci";
    }
}
