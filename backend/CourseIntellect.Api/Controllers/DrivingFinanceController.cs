using CourseIntellect.Api.Authorization;
using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Data;
using System.Security.Claims;

namespace CourseIntellect.Api.Controllers;

/// <summary>
/// Sürücü kursuna özel finans işlemleri: ek ders satışı, sınav/dosya ücreti,
/// ek hizmet, tahsilat, iade ve kurs finans özeti.
///
/// <para>Borç, taksit, gecikme ve makbuz mekanizması YENİDEN YAZILMAZ — her ücret
/// kalemi mevcut sözleşmeye bir taksit olarak düşer, tahsilat mevcut finans
/// servisinden geçer. Böylece kasa ve gecikmiş ödeme ekranları kendiliğinden çalışır.</para>
/// </summary>
[ApiController]
[Authorize]
[Route("api/driving-school")]
public sealed class DrivingFinanceController(
    CourseIntellectDbContext dbContext,
    IStudentFinanceService financeService,
    IDrivingLedgerService ledgerService,
    IDrivingNotifier notifier,
    IAuditLogService auditLogService) : ControllerBase
{
    private const string AuditCategory = "DrivingSchool";

    // ─── Ücret kalemleri ──────────────────────────────────────────────────────

    [HttpGet("students/{profileId:guid}/charges")]
    [RequireDrivingPermission(DrivingPermissions.FinanceView)]
    public async Task<IActionResult> GetCharges(Guid profileId, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();

        var rows = await dbContext.DrivingCharges.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profileId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new
            {
                x.Id,
                chargeType = x.ChargeType.ToString(),
                x.Description,
                x.GrossAmount,
                x.DiscountAmount,
                x.NetAmount,
                x.DiscountReason,
                x.Minutes,
                x.RefundedAmount,
                x.RefundReason,
                x.RefundedAtUtc,
                x.CreatedAtUtc,
            })
            .ToListAsync(ct);

        return Ok(rows);
    }

    /// <summary>
    /// Ücret kalemi açar. Ek direksiyon dersi ise ders hakkına dakikayı da ekler —
    /// para ve dakika tek işlemde, ayrı ayrı unutulamaz.
    /// </summary>
    [HttpPost("students/{profileId:guid}/charges")]
    [RequireDrivingPermission(DrivingPermissions.FinanceCollect)]
    public async Task<IActionResult> CreateCharge(Guid profileId, [FromBody] CreateDrivingChargeRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var actorId = CurrentUserId();
        if (actorId is null) return Unauthorized();

        if (request.ParsedType is not { } chargeType) return BadRequest(new { message = $"Ücret türü geçersiz: {request.ChargeType}." });
        if (request.GrossAmount <= 0 || request.GrossAmount > 1_000_000) return BadRequest(new { message = "Tutar 0'dan büyük olmalıdır." });
        if (request.DiscountAmount < 0 || request.DiscountAmount > request.GrossAmount) return BadRequest(new { message = "İndirim, brüt tutardan büyük olamaz." });
        if (DrivingChargeTypes.AddsLessonMinutes(chargeType) && request.Minutes is < 1 or > 10000)
            return BadRequest(new { message = "Ek direksiyon dersinde süre 1-10000 dakika arasında olmalıdır." });

        // İndirim vermek ayrı bir yetkidir: tahsilat alan herkes indirim yapamaz.
        if (request.DiscountAmount > 0 && !await HasPermissionAsync(DrivingPermissions.FinanceDiscount, ct))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "İndirim uygulamak için yetkiniz yok." });

        var profile = await dbContext.StudentDrivingProfiles.SingleOrDefaultAsync(x => x.Id == profileId, ct);
        if (profile is null) return NotFound(new { message = "Kursiyer bulunamadı." });
        if (profile.EnrollmentContractId is not Guid contractId)
            return BadRequest(new { message = "Kursiyerin sözleşmesi yok; önce kayıt finansalını oluşturun." });

        var contract = await dbContext.EnrollmentContracts.SingleOrDefaultAsync(x => x.Id == contractId, ct);
        if (contract is null) return BadRequest(new { message = "Sözleşme bulunamadı." });

        var net = request.GrossAmount - request.DiscountAmount;

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

        // Kalem, sözleşmenin son taksitinden sonraki sıraya eklenir ve hemen vadesi gelir.
        var nextSeq = await dbContext.FinanceInstallments
            .Where(x => x.EnrollmentContractId == contractId)
            .Select(x => (int?)x.SeqNo)
            .MaxAsync(ct) ?? 0;

        var installment = new FinanceInstallment
        {
            EnrollmentContractId = contractId,
            StudentUserId = contract.StudentUserId,
            StudentName = contract.StudentName,
            SeqNo = nextSeq + 1,
            Label = DrivingChargeTypes.Label(chargeType),
            DueDateUtc = (request.DueDateUtc ?? DateTime.UtcNow).Date,
            Amount = net,
            PaidAmount = 0,
            Status = "Pending",
        };
        dbContext.FinanceInstallments.Add(installment);

        var charge = new DrivingCharge
        {
            StudentDrivingProfileId = profileId,
            ChargeType = chargeType,
            Description = request.Description?.Trim() ?? DrivingChargeTypes.Label(chargeType),
            GrossAmount = request.GrossAmount,
            DiscountAmount = request.DiscountAmount,
            DiscountReason = request.DiscountReason?.Trim() ?? string.Empty,
            NetAmount = net,
            Minutes = DrivingChargeTypes.AddsLessonMinutes(chargeType) ? request.Minutes : 0,
            FinanceInstallmentId = installment.Id,
            EnrollmentContractId = contractId,
            CreatedByUserId = actorId,
        };
        dbContext.DrivingCharges.Add(charge);

        // Sözleşmenin toplamı da büyür; aksi hâlde "net tutar" ile taksitler tutmaz.
        contract.GrossAmount += request.GrossAmount;
        contract.DiscountAmount += request.DiscountAmount;
        contract.NetAmount += net;

        if (charge.Minutes > 0)
        {
            await ledgerService.AddAsync(profileId, DrivingLedgerEntryType.ExtraPurchasedMinutes, charge.Minutes,
                $"Ek direksiyon dersi satın alındı ({net:N2} ₺)", reason: charge.Description, cancellationToken: ct);
        }

        await dbContext.SaveChangesAsync(ct);
        if (charge.Minutes > 0) await ledgerService.SyncProfileCacheAsync(profileId, ct);
        await dbContext.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        await auditLogService.LogChangeAsync("Ücret kalemi eklendi", AuditCategory, "DrivingCharge", charge.Id.ToString(),
            $"{DrivingChargeTypes.Label(chargeType)} — {net:N2} ₺"
                + (charge.Minutes > 0 ? $", {charge.Minutes} dk ders hakkı eklendi." : ".")
                + (request.DiscountAmount > 0 ? $" İndirim: {request.DiscountAmount:N2} ₺ ({charge.DiscountReason})." : string.Empty),
            null,
            new { chargeType = chargeType.ToString(), charge.GrossAmount, charge.DiscountAmount, charge.NetAmount, charge.Minutes },
            ct);

        await notifier.NotifyStudentAsync(profileId,
            $"{DrivingChargeTypes.Label(chargeType)} eklendi",
            $"Hesabınıza {net:N2} ₺ tutarında {DrivingChargeTypes.Label(chargeType).ToLowerInvariant()} işlendi."
                + (charge.Minutes > 0 ? $" {charge.Minutes} dakika ders hakkı tanımlandı." : string.Empty),
            DrivingNotificationCategories.Finance,
            dedupeKey: $"charge-created:{charge.Id}",
            relatedEntityType: "DrivingCharge",
            relatedEntityId: charge.Id.ToString(),
            cancellationToken: ct);

        return Ok(new { charge.Id, charge.NetAmount, charge.Minutes, installmentId = installment.Id });
    }

    /// <summary>Tahsilat. Makbuz numarası ve taksit mahsubu mevcut finans servisinden gelir.</summary>
    [HttpPost("students/{profileId:guid}/payments")]
    [RequireDrivingPermission(DrivingPermissions.FinanceCollect)]
    public async Task<IActionResult> RecordPayment(Guid profileId, [FromBody] DrivingPaymentRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        if (request.Amount <= 0 || request.Amount > 1_000_000) return BadRequest(new { message = "Tahsilat tutarı 0'dan büyük olmalıdır." });

        var row = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.Id == profileId)
            .Join(dbContext.Students.AsNoTracking(), x => x.StudentId, x => x.Id, (profile, student) => new { profile.EnrollmentContractId, student.FullName, student.UserId })
            .SingleOrDefaultAsync(ct);
        if (row is null) return NotFound(new { message = "Kursiyer bulunamadı." });
        // Sözleşmesi olmayan kursiyerden de doğrudan tahsilat (açık makbuz) alınabilir:
        // ödeme öğrenciye atfedilir, makbuz kesilir. Sözleşme varsa taksitlere mahsup edilir.

        // Şube seçildiyse kuruma ait ve aktif olmalı — yanlış şubeye tahsilat yazılmasın.
        if (request.BranchId is Guid branchId)
        {
            var branchOk = await dbContext.OrgUnits.AsNoTracking().AnyAsync(x => x.Id == branchId, ct);
            if (!branchOk) return BadRequest(new { message = "Seçilen şube bulunamadı." });
        }

        FinancePaymentDto payment;
        try
        {
            payment = await financeService.RecordPaymentAsync(
                new RecordPaymentRequest(
                    StudentUserId: row.UserId,
                    StudentName: row.FullName,
                    EnrollmentContractId: row.EnrollmentContractId,
                    FinanceInstallmentId: request.FinanceInstallmentId,
                    Amount: request.Amount,
                    Method: request.Method,
                    Note: request.Note,
                    BranchId: request.BranchId),
                CurrentUserId(),
                ct);
        }
        catch (InvalidOperationException ex)
        {
            // Ör. ekranda bayatlamış bir taksit seçiliyse ("taksit bu öğrenciye ait
            // değil"): kullanıcıya anlaşılır hata dönmeli, 500 değil.
            return BadRequest(new { message = ex.Message });
        }

        await auditLogService.LogChangeAsync("Tahsilat alındı", AuditCategory, "FinancePayment", payment.Id.ToString(),
            $"{row.FullName} — {request.Amount:N2} ₺ ({request.Method ?? "Nakit"}), makbuz {payment.ReceiptNo}.",
            null, new { request.Amount, request.Method, payment.ReceiptNo }, ct);

        await notifier.NotifyStudentAsync(profileId,
            "Ödemeniz alındı",
            $"{request.Amount:N2} ₺ tutarındaki ödemeniz tahsil edildi. Makbuz no: {payment.ReceiptNo}.",
            DrivingNotificationCategories.Finance,
            dedupeKey: $"payment:{payment.Id}",
            relatedEntityType: "FinancePayment",
            relatedEntityId: payment.Id.ToString(),
            cancellationToken: ct);

        return Ok(payment);
    }

    /// <summary>Kursiyerin bekleyen kayıt peşinatını makbuzlu tahsil eder ("Ödeme Al"
    /// modalındaki peşinat kutusu). Sürücü finans-tahsil izniyle çalışır.</summary>
    [HttpPost("students/{profileId:guid}/collect-down-payment")]
    [RequireDrivingPermission(DrivingPermissions.FinanceCollect)]
    public async Task<IActionResult> CollectDownPayment(Guid profileId, [FromBody] CollectDownPaymentBody? body, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var contractId = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.Id == profileId).Select(x => x.EnrollmentContractId).SingleOrDefaultAsync(ct);
        if (contractId is null) return BadRequest(new { message = "Kursiyerin sözleşmesi yok." });

        try
        {
            var payment = await financeService.CollectDownPaymentAsync(contractId.Value, body?.Method, CurrentUserId(), ct);
            return Ok(payment);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Kurumun şubeleri — tahsilat şubesi ve randevu şubesi seçmek için. Randevu
    /// ekranı da bu listeyi kullandığından randevu görme yetkisi de yeterlidir.
    /// Şube yoksa liste boştur.
    /// </summary>
    [HttpGet("branches")]
    [RequireDrivingPermission(DrivingPermissions.FinanceView, DrivingPermissions.AppointmentView)]
    public async Task<IActionResult> GetBranches(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var branches = await dbContext.OrgUnits.AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.Name)
            .Select(x => new { x.Id, x.Name, x.UnitType })
            .ToListAsync(ct);
        return Ok(branches);
    }

    /// <summary>Bir kursiyerin ödenmemiş taksitleri (Ödeme Al'da taksit seçmek için).</summary>
    [HttpGet("students/{profileId:guid}/installments")]
    [RequireDrivingPermission(DrivingPermissions.FinanceView)]
    public async Task<IActionResult> GetStudentInstallments(Guid profileId, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var contractId = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.Id == profileId).Select(x => x.EnrollmentContractId).SingleOrDefaultAsync(ct);
        if (contractId is null) return Ok(Array.Empty<object>());

        var now = DateTime.UtcNow;
        var rows = await dbContext.FinanceInstallments.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.EnrollmentContractId == contractId && x.TenantId == dbContext.CurrentTenantId && x.Amount - x.PaidAmount > 0)
            .OrderBy(x => x.DueDateUtc)
            .Select(x => new
            {
                x.Id, x.SeqNo, x.Label, x.DueDateUtc, x.Amount, x.PaidAmount,
                remaining = x.Amount - x.PaidAmount,
                overdue = x.DueDateUtc < now,
            })
            .ToListAsync(ct);
        return Ok(rows);
    }

    /// <summary>
    /// "Ödeme Al" modalı için tam finans bağlamı: sözleşme özeti (net/ödenen/kalan),
    /// peşinat durumu (ödendi/bekliyor + tutar), tüm taksit planı (durumlarıyla) ve
    /// son makbuzlar. Sözleşmesiz kursiyerde hasContract=false döner (açık tahsilat).
    /// </summary>
    [HttpGet("students/{profileId:guid}/payment-context")]
    [RequireDrivingPermission(DrivingPermissions.FinanceView)]
    public async Task<IActionResult> GetPaymentContext(Guid profileId, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var tenantId = dbContext.CurrentTenantId;
        var head = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.Id == profileId)
            .Join(dbContext.Students.IgnoreQueryFilters().Where(s => s.TenantId == tenantId),
                p => p.StudentId, s => s.Id,
                (p, s) => new { p.EnrollmentContractId, p.StudentNumber, p.Status, s.FullName, s.UserId })
            .SingleOrDefaultAsync(ct);
        if (head is null) return NotFound(new { message = "Kursiyer bulunamadı." });

        var now = DateTime.UtcNow;

        if (head.EnrollmentContractId is not Guid contractId)
        {
            // Sözleşmesiz: açık tahsilat (öğrenciye atfen alınan makbuzlar) toplamı.
            var openPaid = await dbContext.FinancePayments.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.StudentUserId == head.UserId && x.EnrollmentContractId == null && x.TenantId == tenantId)
                .SumAsync(x => (decimal?)x.Amount, ct) ?? 0m;
            return Ok(new
            {
                hasContract = false,
                studentName = head.FullName,
                studentNumber = head.StudentNumber,
                status = head.Status.ToString(),
                grossAmount = 0m, discountAmount = 0m, netAmount = 0m,
                downPayment = 0m, downPaymentPaid = true, downPaymentPending = false,
                paidTotal = openPaid, remaining = 0m, overdueTotal = 0m, overdueCount = 0,
                installments = Array.Empty<object>(),
            });
        }

        var contract = await dbContext.EnrollmentContracts.IgnoreQueryFilters().AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == contractId && x.TenantId == tenantId, ct);
        if (contract is null) return NotFound(new { message = "Sözleşme bulunamadı." });

        var installments = await dbContext.FinanceInstallments.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.EnrollmentContractId == contractId && x.TenantId == tenantId)
            .OrderBy(x => x.SeqNo)
            .Select(x => new
            {
                x.Id, x.SeqNo, x.Label, x.DueDateUtc, x.Amount, x.PaidAmount,
                remaining = x.Amount - x.PaidAmount,
                overdue = x.Amount - x.PaidAmount > 0 && x.DueDateUtc < now,
                status = x.PaidAmount >= x.Amount ? "Paid" : x.PaidAmount > 0 ? "Partial" : "Pending",
            })
            .ToListAsync(ct);

        // Şubeler-arası tahsilat geçmişi: bu sözleşmeye ait ödemeler + kim, hangi şubeden aldı.
        var rawPayments = await dbContext.FinancePayments.IgnoreQueryFilters().AsNoTracking()
            .Where(x => x.EnrollmentContractId == contractId && x.TenantId == tenantId)
            .OrderByDescending(x => x.PaidAtUtc)
            .Select(x => new
            {
                x.Id, x.Amount, x.Method, x.ReceiptNo, x.Note, x.PaidAtUtc, x.BranchId, x.CreatedByUserId,
                x.EntryType, x.OriginalPaymentId, x.RefundStatus,
            })
            .ToListAsync(ct);
        var paidTotal = FinanceTotals.NetCollected(rawPayments.Select(x => x.Amount));

        // Her makbuz için kalan iade edilebilir tutar: "Ödeme Al"dan alınan tahsilatlar
        // İadeler ekranında görünsün diye gerekir (yalnız ücret kalemleri görünüyordu).
        var refundedByPayment = rawPayments
            .Where(x => x.OriginalPaymentId != null && x.Amount < 0 && x.RefundStatus != "Failed")
            .GroupBy(x => x.OriginalPaymentId!.Value)
            .ToDictionary(g => g.Key, g => g.Sum(x => -x.Amount));

        var payBranchIds = rawPayments.Where(x => x.BranchId != null).Select(x => x.BranchId!.Value).Distinct().ToList();
        var payCollectorIds = rawPayments.Where(x => x.CreatedByUserId != null).Select(x => x.CreatedByUserId!.Value).Distinct().ToList();
        var payBranchNames = await dbContext.OrgUnits.AsNoTracking().Where(x => payBranchIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var payCollectorNames = await dbContext.Users.IgnoreQueryFilters().AsNoTracking().Where(x => payCollectorIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.FullName, ct);
        var recentPayments = rawPayments.Select(x => new
        {
            x.Id, x.Amount, x.Method, x.ReceiptNo, x.Note, x.PaidAtUtc,
            entryType = x.Amount < 0 ? "Refund" : string.IsNullOrWhiteSpace(x.EntryType) ? "Collection" : x.EntryType,
            refundedAmount = refundedByPayment.GetValueOrDefault(x.Id),
            refundableAmount = x.Amount > 0
                ? Math.Max(0, x.Amount - refundedByPayment.GetValueOrDefault(x.Id))
                : 0m,
            branchName = x.BranchId is Guid b && payBranchNames.TryGetValue(b, out var bn) ? bn : null,
            collectedByName = x.CreatedByUserId is Guid c && payCollectorNames.TryGetValue(c, out var cn) ? cn : null,
        }).ToList();

        var overdueRows = installments.Where(x => x.overdue).ToList();

        return Ok(new
        {
            hasContract = true,
            contractId,
            studentName = head.FullName,
            studentNumber = head.StudentNumber,
            status = head.Status.ToString(),
            contract.GrossAmount,
            contract.DiscountAmount,
            contract.NetAmount,
            contract.DownPayment,
            contract.DownPaymentPaid,
            // Peşinat tanımlı ama tahsil edilmemişse modalda ayrıca tahsil edilebilir.
            downPaymentPending = contract.DownPayment > 0 && !contract.DownPaymentPaid,
            paidTotal,
            remaining = FinanceTotals.Outstanding(contract.NetAmount, paidTotal),
            overdueTotal = overdueRows.Sum(x => x.remaining),
            overdueCount = overdueRows.Count,
            installments,
            recentPayments,
        });
    }

    /// <summary>
    /// "Ödeme Al" listesi: seçili şubenin kursiyerleri finans özetiyle. "Tüm
    /// Şubeler" seçildiğinde kurumun birleşik listesi döner. Öncelik aktif
    /// (taksidi en önde olan başta) → mezun → pasiftir.
    /// </summary>
    [HttpGet("collection-list")]
    [RequireDrivingPermission(DrivingPermissions.FinanceView)]
    public async Task<IActionResult> GetCollectionList([FromQuery] Guid? groupId, [FromQuery] bool? ungrouped, [FromQuery] string? bucket, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var tenantId = dbContext.CurrentTenantId;

        var profileQuery = dbContext.StudentDrivingProfiles.AsNoTracking().AsQueryable();
        if (ungrouped == true) profileQuery = profileQuery.Where(x => x.StudentGroupId == null);
        else if (groupId is Guid gid) profileQuery = profileQuery.Where(x => x.StudentGroupId == gid);

        var rows = await profileQuery
            // Profil sorgusundaki aktif şube filtresi kapsamı belirler. Öğrenci
            // join'inde filtre yalnız ilişkiyi tamamlamak için kaldırılır.
            .Join(dbContext.Students.IgnoreQueryFilters().Where(s => s.TenantId == tenantId),
                p => p.StudentId, s => s.Id,
                (p, s) => new { p.Id, p.StudentNumber, s.FullName, s.UserId, p.Status, p.StudentGroupId, p.EnrollmentContractId, RegBranchId = s.BranchId, p.RegisteredByUserId })
            .ToListAsync(ct);

        var groups = await dbContext.DrivingStudentGroups.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var branchNames = await dbContext.OrgUnits.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var registrarIds = rows.Where(x => x.RegisteredByUserId != null).Select(x => x.RegisteredByUserId!.Value).Distinct().ToList();
        var registrarNames = await dbContext.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(u => registrarIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, ct);

        var contractIds = rows.Where(x => x.EnrollmentContractId != null).Select(x => x.EnrollmentContractId!.Value).Distinct().ToList();
        var installments = await dbContext.FinanceInstallments.IgnoreQueryFilters().AsNoTracking()
            .Where(i => i.TenantId == tenantId && contractIds.Contains(i.EnrollmentContractId))
            .Select(i => new { i.EnrollmentContractId, i.Amount, i.PaidAmount, i.DueDateUtc })
            .ToListAsync(ct);
        var byContract = installments.GroupBy(i => i.EnrollmentContractId).ToDictionary(g => g.Key, g => g.ToList());

        var now = DateTime.UtcNow;
        var list = rows.Select(x =>
        {
            var priority = x.Status == DrivingStudentStatus.Graduated ? 1
                : x.Status is DrivingStudentStatus.Suspended or DrivingStudentStatus.Cancelled ? 2 : 0;
            var unpaid = x.EnrollmentContractId is Guid cid && byContract.TryGetValue(cid, out var l)
                ? l.Where(i => i.Amount - i.PaidAmount > 0).ToList()
                : [];
            DateTime? nextDue = unpaid.Count > 0 ? unpaid.Min(i => i.DueDateUtc) : null;
            // Ödenmemiş taksitlerin ay bazlı dökümü: "Ödeme Al" ekranı ay filtresini
            // ve o ayın vade sıralamasını bunun üzerinden kurar (ek istek gerekmez).
            var unpaidByMonth = unpaid
                .GroupBy(i => new { i.DueDateUtc.Year, i.DueDateUtc.Month })
                .Select(g => new
                {
                    month = $"{g.Key.Year:D4}-{g.Key.Month:D2}",
                    dueDateUtc = g.Min(i => i.DueDateUtc),
                    amount = g.Sum(i => i.Amount - i.PaidAmount),
                    count = g.Count(),
                })
                .OrderBy(x => x.dueDateUtc)
                .ToList();
            return new
            {
                profileId = x.Id,
                x.StudentNumber,
                x.FullName,
                // Okul tarafındaki cari hesap ekranı kursiyeri kullanıcı kimliğiyle
                // eşleştirip aynı tahsilat modalını açabilsin diye döner.
                studentUserId = x.UserId,
                status = x.Status.ToString(),
                priority,
                groupId = x.StudentGroupId,
                groupName = x.StudentGroupId is Guid g && groups.TryGetValue(g, out var gn) ? gn : null,
                registrationBranchId = x.RegBranchId,
                registrationBranchName = x.RegBranchId is Guid b && branchNames.TryGetValue(b, out var bn) ? bn : null,
                registrarName = x.RegisteredByUserId is Guid r && registrarNames.TryGetValue(r, out var rn) ? rn : null,
                hasContract = x.EnrollmentContractId != null,
                remaining = unpaid.Sum(i => i.Amount - i.PaidAmount),
                nextDueDateUtc = nextDue,
                unpaidByMonth,
                overdueAmount = unpaid.Where(i => i.DueDateUtc < now).Sum(i => i.Amount - i.PaidAmount),
                overdueCount = unpaid.Count(i => i.DueDateUtc < now),
            };
        });

        list = bucket switch
        {
            "passive" => list.Where(x => x.priority == 2),
            "graduated" => list.Where(x => x.priority == 1),
            "active" => list.Where(x => x.priority == 0),
            _ => list,
        };

        // Aktif → mezun → pasif; aktifte taksidi en önde (en erken vade) olan başta.
        var ordered = list
            .OrderBy(x => x.priority)
            .ThenBy(x => x.nextDueDateUtc ?? DateTime.MaxValue)
            .ThenByDescending(x => x.overdueAmount)
            .ThenBy(x => x.FullName)
            .ToList();
        return Ok(ordered);
    }

    /// <summary>
    /// İade. Para iadesi negatif tahsilat olarak yazılır; ek ders iadesinde
    /// satın alınan dakikalar da geri alınır.
    /// </summary>
    [HttpPost("charges/{chargeId:guid}/refund")]
    [RequireDrivingPermission(DrivingPermissions.FinanceRefund)]
    public async Task<IActionResult> RefundCharge(Guid chargeId, [FromBody] RefundChargeRequest request, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();
        var actorId = CurrentUserId();
        if (actorId is null) return Unauthorized();

        var reason = request.Reason?.Trim() ?? string.Empty;
        if (reason.Length is < 5 or > 500) return BadRequest(new { message = "İade nedeni 5-500 karakter olmalıdır." });

        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

        var charge = await dbContext.DrivingCharges.SingleOrDefaultAsync(x => x.Id == chargeId, ct);
        if (charge is null) return NotFound(new { message = "Ücret kalemi bulunamadı." });

        // KISMİ İADE: kalan tutar üzerinden hesaplanır. Eskiden ilk kısmi iadede
        // RefundedAtUtc dolduğu için ikinci iade "zaten iade edilmiş" sayılıyor ve
        // kalan tutar hiç iade edilemiyordu. Kapı artık TUTARA bakar.
        var alreadyRefunded = Math.Max(0, charge.RefundedAmount);
        var refundable = charge.NetAmount - alreadyRefunded;
        if (refundable <= 0)
            return Conflict(new { message = "Bu kalemin tamamı zaten iade edilmiş." });

        var refund = request.Amount ?? refundable;
        if (refund <= 0 || refund > refundable)
            return BadRequest(new { message = $"İade tutarı 0 ile {refundable:N2} ₺ arasında olmalıdır." });

        // KULLANILMIŞ EĞİTİM HAKKI: ek ders kaleminde öğrenci dakikaları tükettiyse
        // o dakikalar geri alınamaz. Tüketilen kısmın parası varsayılan olarak iade
        // EDİLMEZ — aksi hâlde alınmış eğitim bedelsiz kalırdı. Kurum bilinçli olarak
        // yine de iade etmek isterse request.AllowConsumedRefund ile açıkça onaylar
        // ve bu karar audit'e yazılır.
        var reclaimableMinutes = 0;
        var consumedMinutes = 0;
        if (charge.Minutes > 0)
        {
            var balance = await ledgerService.GetBalanceAsync(charge.StudentDrivingProfileId, ct);
            reclaimableMinutes = Math.Min(charge.Minutes, Math.Max(0, balance.AvailableMinutes));
            consumedMinutes = charge.Minutes - reclaimableMinutes;
        }

        var consumedValue = consumedMinutes > 0 && charge.Minutes > 0
            ? Math.Round(charge.NetAmount * consumedMinutes / charge.Minutes, 2)
            : 0m;
        var allowConsumedRefund = request.AllowConsumedRefund == true;
        if (consumedValue > 0 && !allowConsumedRefund)
        {
            var maxRefund = Math.Max(0, refundable - consumedValue);
            if (refund > maxRefund)
            {
                return BadRequest(new
                {
                    message = $"Bu kalemde {consumedMinutes} dakika eğitim kullanılmış ({consumedValue:N2} ₺). "
                        + $"En fazla {maxRefund:N2} ₺ iade edilebilir. Kullanılan eğitimin bedelini de iade etmek için "
                        + "işlemi \"kullanılan eğitim dahil\" onayıyla tekrarlayın.",
                    maxRefundable = maxRefund,
                    consumedMinutes,
                    consumedValue,
                });
            }
        }

        charge.RefundedAmount = alreadyRefunded + refund;
        charge.RefundReason = reason;
        charge.RefundedAtUtc = DateTime.UtcNow;

        // Borcu düşür ve GERÇEKTEN TAHSİL EDİLMİŞ kısmı ayır: tahsil edilmiş para
        // kasadan çıkar (negatif tahsilat), tahsil edilmemiş kısım yalnız borç azaltır.
        var cashOut = 0m;
        FinanceInstallment? installment = null;
        if (charge.FinanceInstallmentId is Guid installmentId)
        {
            installment = await dbContext.FinanceInstallments.SingleOrDefaultAsync(x => x.Id == installmentId, ct);
            if (installment is not null)
            {
                cashOut = Math.Min(refund, installment.PaidAmount);
                installment.Amount = Math.Max(0, installment.Amount - refund);
                installment.PaidAmount = Math.Max(0, installment.PaidAmount - cashOut);
                installment.Status = installment.PaidAmount <= 0
                    ? "Pending"
                    : installment.PaidAmount >= installment.Amount ? "Paid" : "Partial";
            }
        }

        EnrollmentContract? contract = null;
        if (charge.EnrollmentContractId is Guid contractId)
        {
            contract = await dbContext.EnrollmentContracts.SingleOrDefaultAsync(x => x.Id == contractId, ct);
            if (contract is not null) contract.NetAmount = Math.Max(0, contract.NetAmount - refund);
        }

        // GERÇEK KASA ÇIKIŞI: iade yalnız borcu küçültmekle kalmaz, tahsil edilmiş
        // para için negatif bir FinancePayment yazılır. Eskiden bu satır hiç
        // oluşmadığı için kasa ve gelir raporları iadeye rağmen yüksek kalıyordu.
        // Okul tarafındaki iade ile AYNI kayıt biçimi kullanılır (EntryType="Refund"),
        // böylece FinanceTotals.NetCollected iadeyi kendiliğinden düşer.
        string? refundReceiptNo = null;
        if (cashOut > 0)
        {
            var refundPayment = new FinancePayment
            {
                EnrollmentContractId = charge.EnrollmentContractId,
                FinanceInstallmentId = charge.FinanceInstallmentId,
                StudentUserId = contract?.StudentUserId,
                StudentName = contract?.StudentName ?? string.Empty,
                Amount = -cashOut,
                Method = "İade",
                ReceiptNo = await financeService.NextReceiptNumberAsync(ct),
                Currency = contract?.Currency ?? "TRY",
                Note = $"İade: {DrivingChargeTypes.Label(charge.ChargeType)} — {reason}",
                CreatedByUserId = actorId,
                BranchId = charge.BranchId,
                PaidAtUtc = DateTime.UtcNow,
                EntryType = "Refund",
                RefundType = "ContractReduction",
                RefundStatus = "Completed",
                RefundReason = reason,
                RefundChannel = "Nakit",
            };
            dbContext.FinancePayments.Add(refundPayment);
            refundReceiptNo = refundPayment.ReceiptNo;
        }

        // Ek ders iadesinde kullanılmamış dakikalar geri alınır — para geri gidiyorsa
        // hak da gitmeli. Tüketilmiş dakikalar geri alınamaz (fiilen kullanıldı).
        var minutesTaken = 0;
        if (reclaimableMinutes > 0)
        {
            // Kısmi iadede yalnız iade oranı kadar dakika geri alınır.
            minutesTaken = charge.NetAmount > 0
                ? Math.Min(reclaimableMinutes, (int)Math.Floor(charge.Minutes * refund / charge.NetAmount))
                : reclaimableMinutes;
            if (minutesTaken > 0)
            {
                await ledgerService.AddAsync(charge.StudentDrivingProfileId, DrivingLedgerEntryType.ManualAdjustmentMinutes, -minutesTaken,
                    "Ek ders iadesi", reason: reason, cancellationToken: ct);
            }
        }

        await dbContext.SaveChangesAsync(ct);
        if (minutesTaken > 0) await ledgerService.SyncProfileCacheAsync(charge.StudentDrivingProfileId, ct);
        await dbContext.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        await auditLogService.LogChangeAsync("Ücret iadesi yapıldı", AuditCategory, "DrivingCharge", charge.Id.ToString(),
            $"{DrivingChargeTypes.Label(charge.ChargeType)} — {refund:N2} ₺ iade edildi. Gerekçe: {reason}."
                + (cashOut > 0 ? $" Kasadan {cashOut:N2} ₺ çıkışı yazıldı (makbuz {refundReceiptNo})." : " Tahsil edilmemiş borç düşüldü, kasa hareketi yok.")
                + (minutesTaken > 0 ? $" {minutesTaken} dk ders hakkı geri alındı." : string.Empty)
                + (consumedValue > 0 && allowConsumedRefund ? $" Kullanılmış {consumedMinutes} dk ({consumedValue:N2} ₺) da iade edildi — yetkili onayı." : string.Empty),
            new { charge.NetAmount, refundedAmount = alreadyRefunded },
            new { charge.NetAmount, refundedAmount = charge.RefundedAmount, cashOut, minutesReclaimed = minutesTaken, consumedMinutes, consumedValue, allowConsumedRefund, reason }, ct);

        await notifier.NotifyStudentAsync(charge.StudentDrivingProfileId,
            "İade işlendi",
            $"{DrivingChargeTypes.Label(charge.ChargeType)} için {refund:N2} ₺ iade edildi."
                + (minutesTaken > 0 ? $" {minutesTaken} dakika ders hakkı geri alındı." : string.Empty),
            DrivingNotificationCategories.Finance,
            // Kısmi iadeler ayrı bildirimler: dedupe anahtarı iade sırasını içerir.
            dedupeKey: $"charge-refund:{charge.Id}:{charge.RefundedAmount:0.##}",
            relatedEntityType: "DrivingCharge",
            relatedEntityId: charge.Id.ToString(),
            cancellationToken: ct);

        return Ok(new
        {
            charge.Id,
            refundedAmount = refund,
            totalRefunded = charge.RefundedAmount,
            remainingRefundable = charge.NetAmount - charge.RefundedAmount,
            cashOut,
            refundReceiptNo,
            minutesReclaimed = minutesTaken,
        });
    }

    // ─── Kurs finans özeti ────────────────────────────────────────────────────

    /// <summary>
    /// Kurumun sürücü kursu finans özeti. Sekreterde bilerek YOKTUR —
    /// <see cref="DrivingPermissions.FinanceReportView"/> ister.
    /// </summary>
    [HttpGet("finance/summary")]
    [RequireDrivingPermission(DrivingPermissions.FinanceReportView)]
    public async Task<IActionResult> GetSummary([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();

        var start = from ?? DateTime.UtcNow.Date.AddDays(-30);
        var end = to ?? DateTime.UtcNow.Date.AddDays(1);
        if (end <= start || end - start > TimeSpan.FromDays(400)) return BadRequest(new { message = "Tarih aralığı geçersiz." });

        // Yalnızca sürücü adaylarının sözleşmeleri — okul tarafıyla karışmasın.
        var contractIds = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(x => x.EnrollmentContractId != null)
            .Select(x => x.EnrollmentContractId!.Value)
            .ToListAsync(ct);

        var contracts = await dbContext.EnrollmentContracts.AsNoTracking()
            .Where(x => contractIds.Contains(x.Id))
            .Select(x => new { x.NetAmount, x.DiscountAmount })
            .ToListAsync(ct);

        var payments = await dbContext.FinancePayments.AsNoTracking()
            .Where(x => x.EnrollmentContractId != null && contractIds.Contains(x.EnrollmentContractId!.Value))
            .Where(x => x.PaidAtUtc >= start && x.PaidAtUtc < end)
            .Select(x => new { x.Amount, x.Method, x.PaidAtUtc })
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var installments = await dbContext.FinanceInstallments.AsNoTracking()
            .Where(x => contractIds.Contains(x.EnrollmentContractId))
            .Select(x => new { x.Amount, x.PaidAmount, x.DueDateUtc })
            .ToListAsync(ct);

        // Kalem toplamları iadeyi GÖRMELİ: iade edilmiş bir kalem tür toplamında tam
        // gelir gibi durursa rapor, net tahsilat ile uzlaşmaz. Brüt ve iade ayrı ayrı
        // döner; net = brüt − iade.
        var charges = await dbContext.DrivingCharges.AsNoTracking()
            .Where(x => x.CreatedAtUtc >= start && x.CreatedAtUtc < end)
            .GroupBy(x => x.ChargeType)
            .Select(x => new
            {
                ChargeType = x.Key,
                Count = x.Count(),
                Total = x.Sum(c => c.NetAmount),
                Refunded = x.Sum(c => c.RefundedAmount),
            })
            .ToListAsync(ct);

        var refunded = await dbContext.DrivingCharges.AsNoTracking()
            .Where(x => x.RefundedAtUtc >= start && x.RefundedAtUtc < end)
            .SumAsync(x => (decimal?)x.RefundedAmount, ct) ?? 0;

        var overdue = installments.Where(x => x.PaidAmount < x.Amount && x.DueDateUtc < now).ToList();

        return Ok(new
        {
            period = new { start, end },
            totals = new
            {
                contractedNet = contracts.Sum(x => x.NetAmount),
                totalDiscount = contracts.Sum(x => x.DiscountAmount),
                collectedInPeriod = FinanceTotals.NetCollected(payments.Select(x => x.Amount)),
                grossCollectedInPeriod = FinanceTotals.Gross(payments.Select(x => x.Amount)),
                refundedInPeriod = refunded,
                outstanding = installments.Sum(x => x.Amount - x.PaidAmount),
                overdueAmount = overdue.Sum(x => x.Amount - x.PaidAmount),
                overdueCount = overdue.Count,
                studentCount = contractIds.Count,
            },
            collectionsByMethod = payments
                .GroupBy(x => x.Method)
                .Select(x => new { method = x.Key, total = x.Sum(p => p.Amount), count = x.Count() })
                .OrderByDescending(x => x.total),
            chargesByType = charges
                .Select(x => new
                {
                    chargeType = x.ChargeType.ToString(),
                    label = DrivingChargeTypes.Label(x.ChargeType),
                    x.Count,
                    // Total artık NET (iade düşülmüş) — ekranlar bu alanı gelir olarak
                    // gösteriyor. Brüt ve iade ayrıca verilir ki fark izlenebilsin.
                    Total = x.Total - x.Refunded,
                    grossTotal = x.Total,
                    refundedTotal = x.Refunded,
                })
                .OrderByDescending(x => x.Total),
        });
    }

    /// <summary>Öğrencinin kendi ödeme planı — mobil "Ödemelerim" ekranı bunu okur.</summary>
    [HttpGet("student/my-payments")]
    [Authorize(Roles = "Student")]
    [RequireDrivingPermission(DrivingPermissions.FinanceView)]
    public async Task<IActionResult> GetMyPayments(CancellationToken ct)
    {
        if (!await CanUseModuleAsync(ct)) return Forbid();

        var userId = CurrentUserId();
        var profile = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Join(dbContext.Students.AsNoTracking().Where(x => x.UserId == userId), x => x.StudentId, x => x.Id, (profile, _) => profile)
            .SingleOrDefaultAsync(ct);
        if (profile is null) return Forbid();
        if (profile.EnrollmentContractId is not Guid contractId)
            return Ok(new { hasContract = false });

        var contract = await dbContext.EnrollmentContracts.AsNoTracking().SingleOrDefaultAsync(x => x.Id == contractId, ct);
        var installments = await dbContext.FinanceInstallments.AsNoTracking()
            .Where(x => x.EnrollmentContractId == contractId)
            .OrderBy(x => x.SeqNo)
            .Select(x => new { x.Id, x.SeqNo, x.Label, x.DueDateUtc, x.Amount, x.PaidAmount, x.Status })
            .ToListAsync(ct);
        var payments = await dbContext.FinancePayments.AsNoTracking()
            .Where(x => x.EnrollmentContractId == contractId)
            .OrderByDescending(x => x.PaidAtUtc)
            .Select(x => new { x.Id, x.Amount, x.Method, x.ReceiptNo, x.PaidAtUtc })
            .ToListAsync(ct);
        var charges = await dbContext.DrivingCharges.AsNoTracking()
            .Where(x => x.StudentDrivingProfileId == profile.Id)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new { x.Id, chargeType = x.ChargeType.ToString(), x.Description, x.NetAmount, x.RefundedAmount, x.CreatedAtUtc })
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var paid = FinanceTotals.NetCollected(payments.Select(x => x.Amount));

        return Ok(new
        {
            hasContract = true,
            netAmount = contract?.NetAmount ?? 0,
            paidTotal = paid,
            remaining = FinanceTotals.Outstanding(contract?.NetAmount ?? 0, paid),
            overdueCount = installments.Count(x => x.PaidAmount < x.Amount && x.DueDateUtc < now),
            nextInstallment = installments
                .Where(x => x.PaidAmount < x.Amount)
                .OrderBy(x => x.DueDateUtc)
                .Select(x => new { x.Label, x.DueDateUtc, remaining = x.Amount - x.PaidAmount })
                .FirstOrDefault(),
            installments,
            payments,
            charges,
        });
    }

    // ─── Yardımcılar ──────────────────────────────────────────────────────────

    private async Task<bool> HasPermissionAsync(string permission, CancellationToken ct)
    {
        var service = HttpContext.RequestServices.GetRequiredService<IDrivingPermissionService>();
        return await service.HasAsync(User, permission, ct);
    }

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirstValue("nameid") ?? User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(raw, out var parsed) ? parsed : null;
    }

    private async Task<bool> CanUseModuleAsync(CancellationToken ct)
    {
        if (dbContext.CurrentTenantId is not Guid tenantId) return false;
        var tenant = await dbContext.TenantWorkspaces.IgnoreQueryFilters().AsNoTracking()
            .SingleOrDefaultAsync(x => x.Id == tenantId, ct);
        return tenant is not null
            && tenant.InstitutionType == InstitutionType.DrivingSchool
            && tenant.DrivingSchoolModuleEnabled
            && string.Equals(tenant.Status, "active", StringComparison.OrdinalIgnoreCase);
    }
}

public sealed record CreateDrivingChargeRequest(
    string ChargeType,
    string? Description,
    decimal GrossAmount,
    decimal DiscountAmount,
    string? DiscountReason,
    int Minutes,
    DateTime? DueDateUtc)
{
    public DrivingChargeType? ParsedType =>
        Enum.TryParse<DrivingChargeType>(ChargeType, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed)
            ? parsed
            : null;
}

public sealed record DrivingPaymentRequest(decimal Amount, string? Method, Guid? FinanceInstallmentId, string? Note, Guid? BranchId = null);
public sealed record CollectDownPaymentBody(string? Method = null);

/// <param name="AllowConsumedRefund">
/// Kullanılmış (geri alınamayan) eğitim dakikalarının bedelini de iade etmek için
/// yetkilinin AÇIK onayı. Varsayılan davranış, tüketilmiş eğitimin bedelini iade
/// dışında tutmaktır; bu bayrak audit'e yazılır.
/// </param>
public sealed record RefundChargeRequest(decimal? Amount, string? Reason, bool? AllowConsumedRefund = null);
