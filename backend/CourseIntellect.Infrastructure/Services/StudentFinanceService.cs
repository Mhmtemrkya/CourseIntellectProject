using System.Globalization;
using System.Data;
using System.Security.Cryptography;
using System.Text;
using CourseIntellect.Application.DTOs.Notifications;
using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class StudentFinanceService(
    CourseIntellectDbContext dbContext,
    IParentNotifier parentNotifier,
    IAuditLogService auditLogService,
    IInstitutionProfileService institutionProfileService) : IStudentFinanceService
{
    public async Task<EnrollmentContractDto> CreateEnrollmentAsync(
        CreateEnrollmentRequest request,
        Guid? createdByUserId,
        CancellationToken cancellationToken = default)
    {
        var gross = Math.Max(0, request.GrossAmount);

        // ── Burs ─────────────────────────────────────────────────────────────
        // Oran 0–100 arasına kelepçelenir ve bursun TUTARI sunucuda hesaplanır;
        // istemci indirim tutarını doğrudan zorlayamaz.
        //
        // DiscountAmount TOPLAM indirimdir (burs + diğer): net, taksit planı,
        // ekstre ve iade hesapları tek bir indirim kalemi üzerinden yürür, burs
        // ayrı bir hesap yolu AÇMAZ. Toplam brütü aşamaz.
        var scholarshipPercent = Math.Clamp(request.ScholarshipPercent, 0m, 100m);
        var scholarshipAmount = Math.Round(gross * scholarshipPercent / 100m, 2, MidpointRounding.AwayFromZero);
        var otherDiscount = Math.Max(0, request.DiscountAmount);
        var discount = Math.Clamp(otherDiscount + scholarshipAmount, 0, gross);
        // Toplam brütü aşıp kırpıldıysa bursun kayıtlı tutarı da gerçekte
        // uygulanan kadar olmalı — aksi halde "burs 12.000" yazıp net 0 çıkardı.
        scholarshipAmount = Math.Min(scholarshipAmount, discount);
        var net = gross - discount;
        var downPayment = Math.Clamp(request.DownPayment, 0, net);
        var installmentCount = Math.Max(0, request.InstallmentCount);
        var currency = string.IsNullOrWhiteSpace(request.Currency) ? "TRY" : request.Currency.Trim();
        var studentName = request.StudentName.Trim();

        var contract = new EnrollmentContract
        {
            StudentUserId = request.StudentUserId,
            StudentName = studentName,
            ClassName = request.ClassName?.Trim() ?? string.Empty,
            AcademicYear = request.AcademicYear?.Trim() ?? string.Empty,
            GrossAmount = gross,
            DiscountAmount = discount,
            DiscountReason = ComposeDiscountReason(request.DiscountReason, scholarshipPercent),
            NetAmount = net,
            ScholarshipPercent = scholarshipPercent,
            ScholarshipAmount = scholarshipAmount,
            DownPayment = downPayment,
            // Peşinatı yoksa (0) "beklemede" kavramı anlamsız → paid=true. Varsa,
            // kayıt anında tahsil edilip edilmediği isteğe bağlıdır.
            DownPaymentPaid = downPayment <= 0 || request.DownPaymentPaid,
            DownPaymentPaidAmount = request.DownPaymentPaid ? downPayment : 0,
            InstallmentCount = installmentCount,
            Currency = currency,
            Status = "Active",
            Note = request.Note?.Trim() ?? string.Empty,
            CreatedByUserId = createdByUserId,
        };
        await dbContext.EnrollmentContracts.AddAsync(contract, cancellationToken);

        // Taksit planı: net - peşinat, taksit sayısına bölünür; son taksit yuvarlama farkını alır.
        var remaining = net - downPayment;
        var installments = new List<FinanceInstallment>();
        if (installmentCount > 0 && remaining > 0)
        {
            var perInstallment = Math.Round(remaining / installmentCount, 2, MidpointRounding.AwayFromZero);
            var firstDue = (request.FirstInstallmentDate ?? FirstDayOfNextMonth(DateTime.UtcNow)).Date;
            var allocated = 0m;
            for (var index = 0; index < installmentCount; index++)
            {
                var isLast = index == installmentCount - 1;
                var amount = isLast ? remaining - allocated : perInstallment;
                allocated += amount;
                installments.Add(new FinanceInstallment
                {
                    EnrollmentContractId = contract.Id,
                    StudentUserId = contract.StudentUserId,
                    StudentName = studentName,
                    SeqNo = index + 1,
                    Label = $"{index + 1}. Taksit",
                    DueDateUtc = DateTime.SpecifyKind(firstDue.AddMonths(index), DateTimeKind.Utc),
                    Amount = amount,
                    PaidAmount = 0,
                    Status = "Pending",
                    Currency = currency,
                });
            }
        }
        else if (remaining > 0)
        {
            // Taksitsiz sözleşme: kalan tutar tek bir vadeli kayıt olarak takibe alınır.
            // Aksi halde vade tarihi olmadığından gecikme/yaşlandırma (aging) ve otomatik
            // hatırlatma bu alacağı görmez ("kayıt yaptım, parası takipte" sanılır ama takip edilmez).
            var due = (request.FirstInstallmentDate ?? FirstDayOfNextMonth(DateTime.UtcNow)).Date;
            installments.Add(new FinanceInstallment
            {
                EnrollmentContractId = contract.Id,
                StudentUserId = contract.StudentUserId,
                StudentName = studentName,
                SeqNo = 1,
                Label = "Tek Ödeme",
                DueDateUtc = DateTime.SpecifyKind(due, DateTimeKind.Utc),
                Amount = remaining,
                PaidAmount = 0,
                Status = "Pending",
                Currency = currency,
            });
        }

        if (installments.Count > 0)
        {
            await dbContext.FinanceInstallments.AddRangeAsync(installments, cancellationToken);
        }

        // Peşinat varsa VE kayıt anında tahsil edildiyse makbuzlu tahsilat olarak
        // kaydedilir (cari bakiyeye yansır) ve manuel tahsilatla parite olması için
        // muhasebe bildirim + audit kaydı düşülür; böylece kayıt peşinatı tahsilat
        // listesinde, makbuzda, özet toplamlarında ve muhasebe aktivite akışında
        // eksiksiz görünür. Tahsil edilmediyse HİÇBİR ödeme kaydı yazılmaz —
        // peşinat "bekliyor" olarak sözleşmede durur ve "Peşinat Bekleyenler"de görünür.
        if (downPayment > 0 && request.DownPaymentPaid)
        {
            // Peşinatın gerçek ödeme kanalı (Nakit/Kart/Havale) — kasa/nakit-kart
            // dağılımına doğru düşmesi için. Boşsa "Nakit" varsayılır. Kaydın "kayıt
            // peşinatı" olduğu Note ve makbuz numarasından anlaşılır.
            var downPaymentMethod = string.IsNullOrWhiteSpace(request.DownPaymentMethod)
                ? "Nakit"
                : request.DownPaymentMethod.Trim();
            var receiptNo = await NextReceiptNoAsync(cancellationToken);
            await dbContext.FinancePayments.AddAsync(new FinancePayment
            {
                EnrollmentContractId = contract.Id,
                StudentUserId = contract.StudentUserId,
                StudentName = studentName,
                Amount = downPayment,
                Method = downPaymentMethod,
                ReceiptNo = receiptNo,
                Currency = currency,
                Note = "Kayıt peşinatı",
                CreatedByUserId = createdByUserId,
                PaidAtUtc = DateTime.UtcNow,
            }, cancellationToken);

            var amountLabel = MoneyText.Format(downPayment, currency);
            await dbContext.AccountingNotifications.AddAsync(new AccountingNotification
            {
                Title = "Kayıt peşinatı tahsil edildi",
                Message = $"{studentName} için {amountLabel} tutarında kayıt peşinatı alındı ({downPaymentMethod} • Makbuz {receiptNo}).",
                Time = "Bugün",
                Unread = true,
            }, cancellationToken);
            await dbContext.AccountingAuditLogs.AddAsync(new AccountingAuditLog
            {
                Title = "Peşinat tahsilatı işlendi",
                Detail = $"{studentName} için kayıt sırasında {amountLabel} peşinat tahsilatı {downPaymentMethod} ile kaydedildi (Makbuz {receiptNo}).",
                Time = $"{DateTime.Now:dd MMMM yyyy} • {DateTime.Now:HH:mm}",
            }, cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync(
            "Kayıt sözleşmesi oluşturuldu",
            "Finance",
            "EnrollmentContract",
            contract.Id.ToString(),
            $"{contract.StudentName} — net tutar: {contract.NetAmount:0.##} {contract.Currency}, taksit sayısı: {installments.Count}.",
            cancellationToken);
        return MapContract(contract, installments);
    }

    // Geçmiş kayıt peşinatları "Peşinat" yöntemiyle kaydedilmişti; bu yöntem
    // gerçek ödeme kanalı olmadığından kasa/nakit-kart dağılımına düşmüyordu.
    // Tek seferde "Nakit"e çevirir (idempotent: tekrar çalıştırınca etkisi olmaz).
    public async Task<int> BackfillDownPaymentMethodAsync(CancellationToken cancellationToken = default)
    {
        var payments = await dbContext.FinancePayments
            .Where(item => item.Method == "Peşinat")
            .ToListAsync(cancellationToken);
        foreach (var payment in payments)
        {
            payment.Method = "Nakit";
        }
        if (payments.Count > 0)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        return payments.Count;
    }

    public async Task<int> BackfillMissingInstallmentsAsync(CancellationToken cancellationToken = default)
    {
        var contracts = await dbContext.EnrollmentContracts.AsNoTracking().ToListAsync(cancellationToken);
        if (contracts.Count == 0) return 0;
        var contractIds = contracts.Select(item => item.Id).ToHashSet();

        var installmentContractIds = (await dbContext.FinanceInstallments.AsNoTracking()
            .Where(item => contractIds.Contains(item.EnrollmentContractId))
            .Select(item => item.EnrollmentContractId)
            .Distinct()
            .ToListAsync(cancellationToken)).ToHashSet();

        var paidByContract = (await dbContext.FinancePayments.AsNoTracking()
            .Where(item => item.EnrollmentContractId != null && contractIds.Contains(item.EnrollmentContractId.Value))
            .Select(item => new { ContractId = item.EnrollmentContractId!.Value, item.Amount })
            .ToListAsync(cancellationToken))
            .GroupBy(item => item.ContractId)
            .ToDictionary(group => group.Key, group => FinanceTotals.NetCollected(group.Select(x => x.Amount)));

        var due = FirstDayOfNextMonth(DateTime.UtcNow).Date;
        var toAdd = new List<FinanceInstallment>();
        foreach (var contract in contracts)
        {
            if (installmentContractIds.Contains(contract.Id)) continue; // zaten taksiti/vadeli kaydı var
            var remaining = contract.NetAmount - paidByContract.GetValueOrDefault(contract.Id);
            if (remaining <= 0) continue;
            toAdd.Add(new FinanceInstallment
            {
                EnrollmentContractId = contract.Id,
                StudentUserId = contract.StudentUserId,
                StudentName = contract.StudentName,
                SeqNo = 1,
                Label = "Tek Ödeme",
                DueDateUtc = DateTime.SpecifyKind(due, DateTimeKind.Utc),
                Amount = remaining,
                PaidAmount = 0,
                Status = "Pending",
                Currency = string.IsNullOrWhiteSpace(contract.Currency) ? "TRY" : contract.Currency,
            });
        }

        if (toAdd.Count > 0)
        {
            await dbContext.FinanceInstallments.AddRangeAsync(toAdd, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        return toAdd.Count;
    }

    public async Task<StudentFinanceAccountDto> GetAccountAsync(
        Guid? studentUserId,
        string? studentName,
        CancellationToken cancellationToken = default)
    {
        var name = studentName?.Trim() ?? string.Empty;
        var nameLower = name.ToLowerInvariant();
        var contractQuery = studentUserId is Guid sid
            ? dbContext.EnrollmentContracts.AsNoTracking().Where(item => item.StudentUserId == sid)
            : dbContext.EnrollmentContracts.AsNoTracking().Where(item => item.StudentName.Trim().ToLower() == nameLower);
        var contracts = await contractQuery
            .OrderByDescending(item => item.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(name))
        {
            name = contracts.FirstOrDefault()?.StudentName ?? string.Empty;
            nameLower = name.ToLowerInvariant();
        }

        var contractIds = contracts.Select(item => item.Id).ToHashSet();

        var installments = await dbContext.FinanceInstallments.AsNoTracking()
            .Where(item => contractIds.Contains(item.EnrollmentContractId)
                || (studentUserId != null && item.StudentUserId == studentUserId)
                || (nameLower != string.Empty && item.StudentName.Trim().ToLower() == nameLower))
            .OrderBy(item => item.DueDateUtc)
            .ToListAsync(cancellationToken);

        var payments = await dbContext.FinancePayments.AsNoTracking()
            .Where(item => (item.EnrollmentContractId != null && contractIds.Contains(item.EnrollmentContractId.Value))
                || (studentUserId != null && item.StudentUserId == studentUserId)
                || (nameLower != string.Empty && item.StudentName.Trim().ToLower() == nameLower))
            .OrderByDescending(item => item.PaidAtUtc)
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        var net = contracts.Sum(item => item.NetAmount);
        var amounts = payments.Select(item => item.Amount).ToList();
        var paid = FinanceTotals.NetCollected(amounts);
        var grossCollected = FinanceTotals.Gross(amounts);
        var refundedTotal = FinanceTotals.Refunded(amounts);
        var refundedByPayment = payments
            .Where(item => item.OriginalPaymentId != null && item.Amount < 0 && item.RefundStatus != "Failed")
            .GroupBy(item => item.OriginalPaymentId!.Value)
            .ToDictionary(group => group.Key, group => group.Sum(item => -item.Amount));
        var paymentIds = payments.Where(item => item.Amount > 0).Select(item => item.Id).ToHashSet();
        var paymentAllocations = await dbContext.FinancePaymentAllocations.AsNoTracking()
            .Where(item => paymentIds.Contains(item.FinancePaymentId))
            .ToListAsync(cancellationToken);
        var allocatedRefundableByPayment = paymentAllocations
            .GroupBy(item => item.FinancePaymentId)
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Amount - item.RefundedAmount));

        // Makbuzun izi: tahsilatı kim aldı, hangi şubede. Pasifleşmiş personel de
        // görünmeli (IgnoreQueryFilters) — geçmiş makbuzun sahibi kaybolmamalı.
        var collectorIds = payments.Where(item => item.CreatedByUserId != null)
            .Select(item => item.CreatedByUserId!.Value).Distinct().ToList();
        var collectorNames = collectorIds.Count == 0
            ? []
            : await dbContext.Users.IgnoreQueryFilters().AsNoTracking()
                .Where(item => collectorIds.Contains(item.Id))
                .ToDictionaryAsync(item => item.Id, item => item.FullName, cancellationToken);
        var paymentBranchIds = payments.Where(item => item.BranchId != null)
            .Select(item => item.BranchId!.Value).Distinct().ToList();
        var paymentBranchNames = paymentBranchIds.Count == 0
            ? []
            : await dbContext.OrgUnits.AsNoTracking()
                .Where(item => paymentBranchIds.Contains(item.Id))
                .ToDictionaryAsync(item => item.Id, item => item.Name, cancellationToken);
        var currency = contracts.FirstOrDefault()?.Currency
            ?? installments.FirstOrDefault()?.Currency
            ?? "TRY";
        var overdue = installments.Count(item => item.Amount - item.PaidAmount > 0 && item.DueDateUtc < now);
        var nextDue = installments
            .Where(item => item.Amount - item.PaidAmount > 0)
            .OrderBy(item => item.DueDateUtc)
            .Select(item => (DateTime?)item.DueDateUtc)
            .FirstOrDefault();

        var drivingProfile = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(item => item.EnrollmentContractId != null && contractIds.Contains(item.EnrollmentContractId.Value))
            .OrderByDescending(item => item.RegisteredAtUtc)
            .Select(item => new
            {
                item.Id,
                item.DrivingExamFee,
                item.DrivingExamFeePaid,
                item.DrivingExamDate,
            })
            .FirstOrDefaultAsync(cancellationToken);
        var drivingAttemptNo = drivingProfile is null
            ? 1
            : await dbContext.DrivingExamCandidates.AsNoTracking()
                .Where(item => item.StudentDrivingProfileId == drivingProfile.Id
                    && item.Status != DrivingExamCandidateStatus.Cancelled)
                .Join(
                    dbContext.DrivingExamSessions.AsNoTracking()
                        .Where(item => item.ExamType == DrivingExamType.DrivingPractice),
                    candidate => candidate.ExamSessionId,
                    session => session.Id,
                    (candidate, _) => (int?)candidate.AttemptNo)
                .MaxAsync(cancellationToken) ?? 1;
        // Ek ders/sınav gibi DrivingCharge kalemleri sözleşme toplamına teknik
        // olarak eklenir. "Kurs ücreti" kolonu yalnız ilk kayıt bedelini göstermeli.
        var additionalCharges = await dbContext.DrivingCharges.AsNoTracking()
            .Where(item => item.EnrollmentContractId != null && contractIds.Contains(item.EnrollmentContractId.Value))
            .Select(item => new
            {
                item.GrossAmount,
                item.NetAmount,
                item.RefundedAmount,
                item.ChargeType,
                item.FinanceInstallmentId,
            })
            .ToListAsync(cancellationToken);
        var additionalChargeGross = additionalCharges.Sum(item => item.GrossAmount);
        var grossTotal = Math.Max(0, contracts.Sum(item => item.GrossAmount) - additionalChargeGross);
        var discountTotal = contracts.Sum(item => item.DiscountAmount);
        var downPaymentTotal = contracts.Sum(item => item.DownPayment);
        var downPaymentPaidTotal = contracts.Sum(item =>
            item.DownPaymentPaid ? Math.Max(item.DownPaymentPaidAmount, item.DownPayment) : item.DownPaymentPaidAmount);

        var installmentsByContract = installments
            .GroupBy(item => item.EnrollmentContractId)
            .ToDictionary(group => group.Key, group => group.ToList());
        var additionalChargeInstallmentIds = additionalCharges
            .Where(item => item.FinanceInstallmentId != null)
            .Select(item => item.FinanceInstallmentId!.Value)
            .ToHashSet();
        var courseRemaining = installments
            .Where(item => !additionalChargeInstallmentIds.Contains(item.Id))
            .Sum(item => Math.Max(0, item.Amount - item.PaidAmount))
            + contracts.Sum(item => Math.Max(0, item.DownPayment - item.DownPaymentPaidAmount));
        var additionalChargeRemaining = installments
            .Where(item => additionalChargeInstallmentIds.Contains(item.Id))
            .Sum(item => Math.Max(0, item.Amount - item.PaidAmount))
            + additionalCharges
                .Where(item => item.FinanceInstallmentId == null)
                .Sum(item => Math.Max(0, item.NetAmount - item.RefundedAmount));
        var standaloneExamFeeRemaining = drivingProfile is not null
            && drivingProfile.DrivingExamFee > 0
            && !drivingProfile.DrivingExamFeePaid
            && !additionalCharges.Any(item => item.ChargeType == DrivingChargeType.ExamFee)
                ? drivingProfile.DrivingExamFee
                : 0;
        var totalPayable = courseRemaining + additionalChargeRemaining + standaloneExamFeeRemaining;

        return new StudentFinanceAccountDto(
            studentUserId,
            name,
            currency,
            net,
            paid,
            totalPayable,
            overdue,
            nextDue,
            contracts.Select(item => MapContract(item, installmentsByContract.GetValueOrDefault(item.Id) ?? [])).ToList(),
            installments.Select(item => MapInstallment(item, now)).ToList(),
            payments.Select(item => MapPayment(
                item,
                refundedByPayment.GetValueOrDefault(item.Id),
                item.Amount > 0 ? Math.Max(0, item.Amount - refundedByPayment.GetValueOrDefault(item.Id)) : 0,
                allocatedRefundableByPayment.GetValueOrDefault(item.Id),
                item.CreatedByUserId is Guid collectorId
                    ? collectorNames.GetValueOrDefault(collectorId, string.Empty)
                    : string.Empty,
                item.BranchId is Guid paymentBranchId
                    ? paymentBranchNames.GetValueOrDefault(paymentBranchId, string.Empty)
                    : string.Empty)).ToList(),
            grossCollected,
            refundedTotal,
            grossTotal,
            discountTotal,
            downPaymentTotal,
            downPaymentPaidTotal,
            contracts.Any(item => item.DownPayment > 0 && !item.DownPaymentPaid),
            drivingProfile?.Id,
            drivingProfile?.DrivingExamFee ?? 0,
            drivingProfile?.DrivingExamFeePaid ?? false,
            drivingAttemptNo,
            drivingProfile?.DrivingExamDate,
            courseRemaining,
            additionalChargeRemaining,
            standaloneExamFeeRemaining,
            totalPayable,
            // Birden çok sözleşmede oranlar farklı olabilir; kart tek oran
            // gösterdiği için EN YÜKSEK oran "öğrencinin bursu" sayılır,
            // tutar ise hepsinin toplamıdır.
            contracts.Count == 0 ? 0 : contracts.Max(item => item.ScholarshipPercent),
            contracts.Sum(item => item.ScholarshipAmount));
    }

    public async Task<StudentStatementDto> GetStatementAsync(
        Guid? studentUserId,
        string? studentName,
        DateTime? fromUtc,
        DateTime? toUtc,
        CancellationToken cancellationToken = default)
    {
        var account = await GetAccountAsync(studentUserId, studentName, cancellationToken);
        var contractIds = account.Contracts.Select(item => item.Id).ToList();
        var classNameByContract = account.Contracts.ToDictionary(item => item.Id, item => item.ClassName);
        var now = DateTime.UtcNow;

        // Taksite bağlanmamış ek ücret kalemleri (ek ders, dosya masrafı…) ekstrede
        // ayrı borç satırı olarak görünür; aksi halde bakiye ile satır toplamı tutmaz.
        var standaloneCharges = contractIds.Count == 0
            ? []
            : await dbContext.DrivingCharges.AsNoTracking()
                .Where(item => item.EnrollmentContractId != null
                    && contractIds.Contains(item.EnrollmentContractId.Value)
                    && item.FinanceInstallmentId == null)
                .Select(item => new
                {
                    item.ChargeType,
                    item.Description,
                    item.NetAmount,
                    item.RefundedAmount,
                    item.CreatedAtUtc,
                })
                .ToListAsync(cancellationToken);

        var movements = new List<StatementMovement>();

        foreach (var contract in account.Contracts)
        {
            if (contract.DownPayment <= 0) continue;
            movements.Add(new StatementMovement(
                contract.CreatedAtUtc,
                "Peşinat",
                Describe("Kayıt peşinatı", contract.ClassName),
                string.Empty,
                contract.DownPayment,
                0));
        }

        foreach (var installment in account.Installments)
        {
            if (installment.Amount <= 0) continue;
            var className = classNameByContract.GetValueOrDefault(installment.EnrollmentContractId) ?? string.Empty;
            movements.Add(new StatementMovement(
                installment.DueDateUtc,
                // Vadesi gelmemiş taksit borç olarak tahakkuk etmez; ayrı etiketlenir.
                installment.DueDateUtc > now ? "Taksit (Vade)" : "Fatura",
                Describe(string.IsNullOrWhiteSpace(installment.Label) ? "Taksit" : installment.Label, className),
                string.Empty,
                installment.Amount,
                0));
        }

        foreach (var charge in standaloneCharges)
        {
            var amount = Math.Max(0, charge.NetAmount - charge.RefundedAmount);
            if (amount <= 0) continue;
            movements.Add(new StatementMovement(
                charge.CreatedAtUtc,
                "Ek Ücret",
                string.IsNullOrWhiteSpace(charge.Description) ? ChargeTypeLabel(charge.ChargeType) : charge.Description,
                string.Empty,
                amount,
                0));
        }

        // Kurs ücretinden ayrı takip edilen direksiyon sınavı ücreti — yalnız
        // ödenmemişse ve ayrı bir ücret kalemi olarak açılmamışsa borçtur.
        if (account.StandaloneExamFeeRemaining > 0)
        {
            movements.Add(new StatementMovement(
                account.DrivingExamDate ?? now,
                "Sınav Ücreti",
                $"{account.DrivingExamAttemptNo}. direksiyon sınavı ücreti",
                string.Empty,
                account.StandaloneExamFeeRemaining,
                0));
        }

        foreach (var payment in account.Payments)
        {
            if (payment.Amount > 0)
            {
                var label = string.IsNullOrWhiteSpace(payment.Note)
                    ? (string.IsNullOrWhiteSpace(payment.Method) ? "Tahsilat" : payment.Method)
                    : payment.Note;
                movements.Add(new StatementMovement(
                    payment.PaidAtUtc,
                    payment.IsDownPayment ? "Peşinat Tahsilatı" : "Tahsilat",
                    Describe(label, string.IsNullOrWhiteSpace(payment.Method) ? string.Empty : payment.Method),
                    payment.ReceiptNo,
                    0,
                    payment.Amount));
            }
            else if (payment.Amount < 0)
            {
                // İade parayı geri verir → cari borcu yeniden doğurur (borç tarafı).
                var reason = string.IsNullOrWhiteSpace(payment.RefundReason) ? payment.Note : payment.RefundReason;
                movements.Add(new StatementMovement(
                    payment.PaidAtUtc,
                    "İade",
                    Describe("İade", reason),
                    payment.ReceiptNo,
                    -payment.Amount,
                    0));
            }
        }

        // Aralık verilmediyse ilk hareketten son harekete kadar tüm geçmiş kapsanır;
        // vadesi gelmemiş taksitler de görünsün diye üst sınır bugünden ileri olabilir.
        var firstMovement = movements.Count == 0 ? now : movements.Min(item => item.DateUtc);
        var lastMovement = movements.Count == 0 ? now : movements.Max(item => item.DateUtc);
        var from = (fromUtc?.Date ?? firstMovement.Date);
        var toInclusive = toUtc?.Date ?? (lastMovement > now ? lastMovement.Date : now.Date);
        if (toInclusive < from) toInclusive = from;
        var fromKind = DateTime.SpecifyKind(from, DateTimeKind.Utc);
        var toExclusive = DateTime.SpecifyKind(toInclusive.AddDays(1), DateTimeKind.Utc);

        var ledger = StatementLedger.Build(movements, fromKind, toExclusive);

        var profile = await ResolveStudentProfileAsync(studentUserId, account.StudentName, cancellationToken);
        var studentPhone = studentUserId is Guid userId
            ? await dbContext.Users.AsNoTracking()
                .Where(item => item.Id == userId)
                .Select(item => item.Phone ?? string.Empty)
                .FirstOrDefaultAsync(cancellationToken) ?? string.Empty
            : string.Empty;
        if (string.IsNullOrWhiteSpace(studentPhone)) studentPhone = profile?.ParentPhone ?? string.Empty;

        // Belge künyesi Ayarlar > Kurum Künyesi ekranından yönetilir; boş alanlar
        // kurumun mevcut kayıtlarından tamamlanır (bkz. IInstitutionProfileService).
        var institution = await institutionProfileService.GetEffectiveAsync(cancellationToken);
        var taxInfo = string.Join(" • ", new[]
        {
            string.IsNullOrWhiteSpace(institution.TaxOffice) ? null : $"Vergi D.: {institution.TaxOffice}",
            string.IsNullOrWhiteSpace(institution.TaxNumber) ? null : $"VKN: {institution.TaxNumber}",
        }.Where(part => part is not null));
        var currencyLabel = string.Equals(account.Currency, "TRY", StringComparison.OrdinalIgnoreCase)
            ? "TL"
            : account.Currency;

        return new StudentStatementDto(
            string.IsNullOrWhiteSpace(institution.Name) ? "Kurum" : institution.Name,
            institution.Address,
            institution.Location,
            institution.Phone,
            institution.Email,
            institution.Website,
            taxInfo,
            BuildAccountCode(profile, studentUserId, account.StudentName),
            account.StudentName,
            studentPhone,
            profile?.Address ?? string.Empty,
            profile?.ParentName ?? string.Empty,
            profile?.ClassName ?? account.Contracts.FirstOrDefault()?.ClassName ?? string.Empty,
            currencyLabel,
            fromKind,
            DateTime.SpecifyKind(toInclusive, DateTimeKind.Utc),
            now,
            ledger.OpeningBalance,
            ledger.DebitTotal,
            ledger.CreditTotal,
            ledger.ClosingBalance,
            TurkishMoneyWords.Format(ledger.ClosingBalance, currencyLabel),
            ledger.Lines
                .Select(line => new StudentStatementLineDto(
                    line.DateUtc,
                    line.EntryType,
                    line.Description,
                    line.DocumentNo,
                    line.Debit,
                    line.Credit,
                    line.Balance))
                .ToList(),
            string.IsNullOrWhiteSpace(institution.DocumentFooterNote)
                ? "Bu belge bilgilendirme amaçlıdır."
                : institution.DocumentFooterNote);
    }

    private static string Describe(string primary, string? secondary) =>
        string.IsNullOrWhiteSpace(secondary) || string.Equals(primary.Trim(), secondary.Trim(), StringComparison.OrdinalIgnoreCase)
            ? primary.Trim()
            : $"{primary.Trim()} • {secondary.Trim()}";

    private static string ChargeTypeLabel(DrivingChargeType type) => type switch
    {
        DrivingChargeType.ExtraLesson => "Ek direksiyon dersi",
        DrivingChargeType.ExamFee => "Sınav ücreti",
        DrivingChargeType.FileFee => "Dosya/evrak masrafı",
        DrivingChargeType.ExtraService => "Ek hizmet",
        _ => "Ek ücret",
    };

    private async Task<StudentProfile?> ResolveStudentProfileAsync(
        Guid? studentUserId,
        string studentName,
        CancellationToken cancellationToken)
    {
        if (studentUserId is Guid userId)
        {
            var byUser = await dbContext.Students.AsNoTracking()
                .FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken);
            if (byUser is not null) return byUser;
        }

        if (string.IsNullOrWhiteSpace(studentName)) return null;
        var nameLower = NormalizeStudentName(studentName);
        return await dbContext.Students.AsNoTracking()
            .FirstOrDefaultAsync(item => item.FullName.Trim().ToLower() == nameLower, cancellationToken);
    }

    /// <summary>
    /// Cari kodu: okul numarası varsa ondan, yoksa öğrenci kimliğinden türetilir.
    /// Aynı öğrenci için her belgede aynı kod çıkar (kurum içi takip kolaylığı).
    /// </summary>
    private static string BuildAccountCode(StudentProfile? profile, Guid? studentUserId, string studentName)
    {
        var digits = new string((profile?.SchoolNumber ?? string.Empty).Where(char.IsDigit).ToArray());
        if (digits.Length is > 0 and <= 9) return $"CR-{int.Parse(digits, CultureInfo.InvariantCulture):D6}";

        var seed = studentUserId?.ToString("N")
            ?? (profile?.Id.ToString("N") ?? NormalizeStudentName(studentName));
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(seed));
        var number = BitConverter.ToUInt32(hash, 0) % 900_000 + 100_000;
        return $"CR-{number:D6}";
    }

    /// <summary>
    /// Seçilen taksit, ödemeyi yapan öğrenciye mi ait? En güçlü kanıttan zayıfa
    /// doğru TEK bir ölçüt uygulanır — sözleşme &gt; öğrenci kimliği &gt; ad. Zayıf
    /// ölçüte yalnız güçlüsü hiç verilmediğinde inilir; hiçbir ölçüt yoksa
    /// eşleşme sayılmaz (fail-closed).
    /// </summary>
    private static bool BelongsToPayer(FinanceInstallment installment, RecordPaymentRequest request, string payerNameLower)
    {
        if (request.EnrollmentContractId is Guid requestedContractId)
        {
            return installment.EnrollmentContractId == requestedContractId;
        }

        if (request.StudentUserId is Guid payerUserId)
        {
            return installment.StudentUserId == payerUserId;
        }

        // Sözleşmesiz/kimliksiz açık tahsilat: yalnız ad eşleşmesi kalır. Taksitte
        // bir öğrenci kimliği varsa ada güvenmek yetmez — o kayıt kimliğe bağlıdır.
        return installment.StudentUserId is null
            && !string.IsNullOrWhiteSpace(payerNameLower)
            && installment.StudentName.Trim().ToLowerInvariant() == payerNameLower;
    }

    public async Task<FinancePaymentDto> RecordPaymentAsync(
        RecordPaymentRequest request,
        Guid? createdByUserId,
        CancellationToken cancellationToken = default)
    {
        var amount = Math.Max(0, request.Amount);
        var name = request.StudentName.Trim();
        var nameLower = name.ToLowerInvariant();
        var method = string.IsNullOrWhiteSpace(request.Method) ? "Nakit" : request.Method.Trim();

        // ── Çift tahsilat koruması ───────────────────────────────────────────
        // Aynı istek kimliğiyle daha önce kayıt oluştuysa YENİSİ YAZILMAZ; ilk
        // makbuz aynen döner. Kullanıcı iki kez tıklasa ya da ağ hatasında istek
        // yeniden gönderilse bile öğrenciden iki kez tahsilat görünmez.
        if (request.ClientRequestId is Guid clientRequestId && clientRequestId != Guid.Empty)
        {
            var existing = await dbContext.FinancePayments.AsNoTracking()
                .FirstOrDefaultAsync(item => item.ClientRequestId == clientRequestId, cancellationToken);
            if (existing is not null)
            {
                return MapPayment(existing);
            }
        }

        Guid? contractId = request.EnrollmentContractId;
        var currency = "TRY";

        // Ödemeyi belirli bir taksite ya da en eski ödenmemiş taksitlere (FIFO) mahsup et.
        var remainingToAllocate = amount;
        var targetInstallments = new List<FinanceInstallment>();
        var newAllocations = new List<(FinanceInstallment Installment, decimal Amount)>();
        if (request.FinanceInstallmentId is Guid installmentId)
        {
            var installment = await dbContext.FinanceInstallments
                .FirstOrDefaultAsync(item => item.Id == installmentId, cancellationToken);

            // SAHİPLİK DOĞRULAMASI: taksit gerçekten ödemeyi yapan öğrenciye mi ait?
            // Eskiden yalnız Id ile bulunuyordu; bir öğrencinin tahsilat ekranından
            // gönderilen yabancı bir FinanceInstallmentId, o parayı BAŞKA öğrencinin
            // taksidine mahsup ediyordu. Eşleşmezse sessizce FIFO'ya düşmek yerine
            // hata veririz — para sessizce yanlış hesaba gitmemeli (fail-closed).
            if (installment is null || !BelongsToPayer(installment, request, nameLower))
            {
                throw new InvalidOperationException("Seçilen taksit bu öğrenciye ait değil.");
            }

            targetInstallments.Add(installment);
            contractId ??= installment.EnrollmentContractId;
        }
        else
        {
            var query = dbContext.FinanceInstallments.AsQueryable();
            query = contractId is Guid cid
                ? query.Where(item => item.EnrollmentContractId == cid)
                : request.StudentUserId is Guid sid
                    ? query.Where(item => item.StudentUserId == sid)
                    : query.Where(item => item.StudentName.Trim().ToLower() == nameLower);
            targetInstallments = await query
                .Where(item => item.Amount - item.PaidAmount > 0)
                .OrderBy(item => item.DueDateUtc)
                .ToListAsync(cancellationToken);
        }

        foreach (var installment in targetInstallments)
        {
            if (remainingToAllocate <= 0) break;
            var due = installment.Amount - installment.PaidAmount;
            if (due <= 0) continue;
            var applied = Math.Min(due, remainingToAllocate);
            installment.PaidAmount += applied;
            remainingToAllocate -= applied;
            newAllocations.Add((installment, applied));
            installment.Status = installment.PaidAmount >= installment.Amount ? "Paid" : "Partial";
            currency = installment.Currency;
            contractId ??= installment.EnrollmentContractId;
        }

        // Sözleşme taksitleri bittikten sonra kalan tutar, paket dışında ve henüz
        // ödenmemiş direksiyon sınav ücretini tamamen karşılıyorsa ödeme durumunu
        // aynı tahsilat içinde kapat. Aksi halde para "avans" görünürken sınav
        // ücreti hâlâ borçta kalıyordu.
        if (contractId is null)
        {
            var contractQuery = dbContext.EnrollmentContracts.AsNoTracking().AsQueryable();
            contractQuery = request.StudentUserId is Guid sid
                ? contractQuery.Where(item => item.StudentUserId == sid)
                : contractQuery.Where(item => item.StudentName.Trim().ToLower() == nameLower);
            contractId = await contractQuery
                .OrderByDescending(item => item.CreatedAtUtc)
                .Select(item => (Guid?)item.Id)
                .FirstOrDefaultAsync(cancellationToken);
        }

        var examFeeApplied = 0m;
        if (contractId is Guid resolvedContractId && remainingToAllocate > 0)
        {
            var profile = await dbContext.StudentDrivingProfiles
                .FirstOrDefaultAsync(item => item.EnrollmentContractId == resolvedContractId, cancellationToken);
            if (profile is { DrivingExamFeePaid: false, DrivingExamFee: > 0 })
            {
                var hasInstallmentBackedExamFee = await dbContext.DrivingCharges.AsNoTracking()
                    .AnyAsync(item => item.StudentDrivingProfileId == profile.Id
                        && item.ChargeType == DrivingChargeType.ExamFee
                        && item.FinanceInstallmentId != null, cancellationToken);
                if (!hasInstallmentBackedExamFee && remainingToAllocate >= profile.DrivingExamFee)
                {
                    examFeeApplied = profile.DrivingExamFee;
                    remainingToAllocate -= examFeeApplied;
                    profile.DrivingExamFeePaid = true;
                }
            }
        }

        // Borçtan fazla ödeme: artan tutar hiçbir taksite gitmez; "Avans" olarak işaretle.
        var baseNote = request.Note?.Trim() ?? string.Empty;
        if (examFeeApplied > 0)
        {
            baseNote = string.IsNullOrEmpty(baseNote)
                ? "Direksiyon sınav ücreti tahsil edildi"
                : $"{baseNote} • Direksiyon sınav ücreti tahsil edildi";
        }
        var note = remainingToAllocate > 0
            ? (string.IsNullOrEmpty(baseNote) ? $"Avans/Fazla: {remainingToAllocate:0.##}" : $"{baseNote} (Avans/Fazla: {remainingToAllocate:0.##})")
            : baseNote;

        var payment = new FinancePayment
        {
            EnrollmentContractId = contractId,
            FinanceInstallmentId = request.FinanceInstallmentId
                ?? (targetInstallments.Count == 1 ? targetInstallments[0].Id : null),
            StudentUserId = request.StudentUserId,
            StudentName = name,
            Amount = amount,
            Method = method,
            ReceiptNo = await NextReceiptNoAsync(cancellationToken),
            Currency = currency,
            Note = note,
            CreatedByUserId = createdByUserId,
            // Şube açıkça seçildiyse onu yaz; boşsa ApplyTenantContext aktörün şubesine düşürür.
            BranchId = request.BranchId,
            ClientRequestId = request.ClientRequestId == Guid.Empty ? null : request.ClientRequestId,
            PaidAtUtc = DateTime.UtcNow,
        };
        await dbContext.FinancePayments.AddAsync(payment, cancellationToken);
        if (newAllocations.Count > 0)
        {
            for (var allocationIndex = 0; allocationIndex < newAllocations.Count; allocationIndex++)
            {
                var allocation = newAllocations[allocationIndex];
                await dbContext.FinancePaymentAllocations.AddAsync(new FinancePaymentAllocation
                {
                    FinancePaymentId = payment.Id,
                    FinanceInstallmentId = allocation.Installment.Id,
                    Amount = allocation.Amount,
                    Sequence = allocationIndex + 1,
                    BranchId = request.BranchId,
                }, cancellationToken);
            }
        }
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(
            "Tahsilat kaydedildi",
            "Finance",
            "FinancePayment",
            payment.Id.ToString(),
            $"{payment.StudentName} — {payment.Amount:0.##} {payment.Currency} ({payment.Method}), makbuz: {payment.ReceiptNo}.",
            cancellationToken);

        return MapPayment(payment);
    }

    public async Task<IReadOnlyList<PendingDownPaymentDto>> GetPendingDownPaymentsAsync(
        CancellationToken cancellationToken = default)
    {
        // Aktif ve peşinatı beklenen (henüz tahsil edilmemiş) sözleşmeler.
        // Global tenant/şube query filter'ı otomatik uygulanır.
        var rows = await dbContext.EnrollmentContracts.AsNoTracking()
            .Where(item => item.DownPayment > item.DownPaymentPaidAmount && item.Status == "Active")
            .OrderBy(item => item.CreatedAtUtc)
            .Select(item => new PendingDownPaymentDto(
                item.Id,
                item.StudentUserId,
                item.StudentName,
                item.ClassName,
                item.DownPayment - item.DownPaymentPaidAmount,
                item.Currency,
                null,
                item.CreatedAtUtc))
            .ToListAsync(cancellationToken);
        return rows;
    }

    public async Task<FinancePaymentDto> CollectDownPaymentAsync(
        Guid contractId,
        string? method,
        Guid? createdByUserId,
        CancellationToken cancellationToken = default)
    {
        var contract = await dbContext.EnrollmentContracts
            .FirstOrDefaultAsync(item => item.Id == contractId, cancellationToken)
            ?? throw new InvalidOperationException("Sözleşme bulunamadı.");
        if (contract.DownPayment <= 0)
        {
            throw new InvalidOperationException("Bu sözleşmede peşinat tanımlı değil.");
        }
        if (contract.DownPaymentPaidAmount >= contract.DownPayment)
        {
            throw new InvalidOperationException("Peşinat zaten tahsil edilmiş.");
        }

        var downPaymentMethod = string.IsNullOrWhiteSpace(method) ? "Nakit" : method.Trim();
        var remainingDownPayment = contract.DownPayment - contract.DownPaymentPaidAmount;
        var receiptNo = await NextReceiptNoAsync(cancellationToken);
        var payment = new FinancePayment
        {
            EnrollmentContractId = contract.Id,
            StudentUserId = contract.StudentUserId,
            StudentName = contract.StudentName,
            Amount = remainingDownPayment,
            Method = downPaymentMethod,
            ReceiptNo = receiptNo,
            Currency = contract.Currency,
            Note = "Kayıt peşinatı",
            CreatedByUserId = createdByUserId,
            PaidAtUtc = DateTime.UtcNow,
        };
        await dbContext.FinancePayments.AddAsync(payment, cancellationToken);

        var amountLabel = MoneyText.Format(remainingDownPayment, contract.Currency);
        await dbContext.AccountingNotifications.AddAsync(new AccountingNotification
        {
            Title = "Bekleyen peşinat tahsil edildi",
            Message = $"{contract.StudentName} için {amountLabel} tutarında bekleyen kayıt peşinatı alındı ({downPaymentMethod} • Makbuz {receiptNo}).",
            Time = "Bugün",
            Unread = true,
        }, cancellationToken);
        await dbContext.AccountingAuditLogs.AddAsync(new AccountingAuditLog
        {
            Title = "Bekleyen peşinat tahsilatı işlendi",
            Detail = $"{contract.StudentName} için bekleyen {amountLabel} peşinat tahsilatı {downPaymentMethod} ile kaydedildi (Makbuz {receiptNo}).",
            Time = $"{DateTime.Now:dd MMMM yyyy} • {DateTime.Now:HH:mm}",
        }, cancellationToken);

        contract.DownPaymentPaidAmount = contract.DownPayment;
        contract.DownPaymentPaid = true;
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditLogService.LogAsync(
            "Bekleyen peşinat tahsil edildi",
            "Finance",
            "FinancePayment",
            payment.Id.ToString(),
            $"{contract.StudentName} — {remainingDownPayment:0.##} {contract.Currency} ({downPaymentMethod}), makbuz: {receiptNo}.",
            cancellationToken);

        return MapPayment(payment);
    }

    public async Task<StudentFinanceSummaryDto> GetSummaryAsync(
        Guid? studentUserId,
        string? studentName,
        CancellationToken cancellationToken = default)
    {
        var account = await GetAccountAsync(studentUserId, studentName, cancellationToken);
        return new StudentFinanceSummaryDto(
            account.StudentUserId,
            account.StudentName,
            account.Contracts.FirstOrDefault()?.ClassName ?? string.Empty,
            account.Currency,
            account.NetTotal,
            account.PaidTotal,
            account.TotalPayable,
            account.OverdueCount,
            account.NextDueDateUtc,
            ResolveStatus(account.TotalPayable, account.OverdueCount, account.NetTotal + account.StandaloneExamFeeRemaining),
            account.GrossTotal,
            account.DiscountTotal,
            account.DownPaymentTotal,
            account.DownPaymentPaidTotal,
            account.HasPendingDownPayment,
            account.DrivingStudentProfileId,
            account.DrivingExamFee,
            account.DrivingExamFeePaid,
            account.DrivingExamAttemptNo,
            account.DrivingExamDate,
            account.CourseRemaining,
            account.AdditionalChargeRemaining,
            account.StandaloneExamFeeRemaining,
            account.TotalPayable);
    }

    public async Task<IReadOnlyList<StudentFinanceSummaryDto>> GetAllSummariesAsync(
        string? className,
        CancellationToken cancellationToken = default)
    {
        var contractQuery = dbContext.EnrollmentContracts.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(className))
        {
            var normalized = className.Trim();
            contractQuery = contractQuery.Where(item => item.ClassName == normalized);
        }

        var contracts = await contractQuery.ToListAsync(cancellationToken);
        if (contracts.Count == 0)
        {
            return [];
        }

        var contractIds = contracts.Select(item => item.Id).ToHashSet();
        var studentUserIds = contracts
            .Where(item => item.StudentUserId != null)
            .Select(item => item.StudentUserId!.Value)
            .ToHashSet();
        var studentNamesLower = contracts
            .Where(item => !string.IsNullOrWhiteSpace(item.StudentName))
            .Select(item => NormalizeStudentName(item.StudentName))
            .ToHashSet();

        var installments = await dbContext.FinanceInstallments.AsNoTracking()
            .Where(item => contractIds.Contains(item.EnrollmentContractId))
            .ToListAsync(cancellationToken);
        // Ödemeler, hesap görünümüyle (GetAccountAsync) tutarlı olacak şekilde
        // contract / öğrenci kullanıcı / öğrenci adı (harf duyarsız) üzerinden eşleştirilir;
        // aksi halde sözleşmeye bağlanmamış (peşin/manuel/iade) tahsilatlar rapora düşmez.
        var payments = await dbContext.FinancePayments.AsNoTracking()
            .Where(item =>
                (item.EnrollmentContractId != null && contractIds.Contains(item.EnrollmentContractId.Value))
                || (item.StudentUserId != null && studentUserIds.Contains(item.StudentUserId.Value))
                || (item.StudentName != string.Empty && studentNamesLower.Contains(item.StudentName.Trim().ToLower())))
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        var paidByStudent = AttributePaymentsToStudents(contracts, payments);

        var installmentsByContract = installments
            .GroupBy(item => item.EnrollmentContractId)
            .ToDictionary(group => group.Key, group => group.ToList());

        var profileRows = await dbContext.StudentDrivingProfiles.AsNoTracking()
            .Where(item => item.EnrollmentContractId != null && contractIds.Contains(item.EnrollmentContractId.Value))
            .Select(item => new
            {
                item.Id,
                ContractId = item.EnrollmentContractId!.Value,
                item.DrivingExamFee,
                item.DrivingExamFeePaid,
                item.DrivingExamDate,
            })
            .ToListAsync(cancellationToken);
        var profileIds = profileRows.Select(item => item.Id).ToList();
        var attemptsByProfile = profileIds.Count == 0
            ? new Dictionary<Guid, int>()
            : (await dbContext.DrivingExamCandidates.AsNoTracking()
                .Where(item => profileIds.Contains(item.StudentDrivingProfileId)
                    && item.Status != DrivingExamCandidateStatus.Cancelled)
                .Join(
                    dbContext.DrivingExamSessions.AsNoTracking()
                        .Where(item => item.ExamType == DrivingExamType.DrivingPractice),
                    candidate => candidate.ExamSessionId,
                    session => session.Id,
                    (candidate, _) => new { candidate.StudentDrivingProfileId, candidate.AttemptNo })
                .ToListAsync(cancellationToken))
                .GroupBy(item => item.StudentDrivingProfileId)
                .ToDictionary(group => group.Key, group => group.Max(item => item.AttemptNo));
        var profilesByContract = profileRows
            .GroupBy(item => item.ContractId)
            .ToDictionary(group => group.Key, group => group.OrderByDescending(item => item.DrivingExamDate).First());
        var chargeRows = await dbContext.DrivingCharges.AsNoTracking()
            .Where(item => item.EnrollmentContractId != null && contractIds.Contains(item.EnrollmentContractId.Value))
            .Select(item => new
            {
                ContractId = item.EnrollmentContractId!.Value,
                item.GrossAmount,
                item.NetAmount,
                item.RefundedAmount,
                item.ChargeType,
                item.FinanceInstallmentId,
            })
            .ToListAsync(cancellationToken);
        var chargeGrossByContract = chargeRows
            .GroupBy(item => item.ContractId)
            .ToDictionary(group => group.Key, group => group.Sum(item => item.GrossAmount));
        return contracts
            .GroupBy(ResolveStudentKey)
            .Select(group =>
            {
                var net = group.Sum(item => item.NetAmount);
                var paid = paidByStudent.GetValueOrDefault(group.Key);
                var studentInstallments = group.SelectMany(item => installmentsByContract.GetValueOrDefault(item.Id) ?? []).ToList();
                var overdue = studentInstallments.Count(item => item.Amount - item.PaidAmount > 0 && item.DueDateUtc < now);
                var nextDue = studentInstallments
                    .Where(item => item.Amount - item.PaidAmount > 0)
                    .OrderBy(item => item.DueDateUtc)
                    .Select(item => (DateTime?)item.DueDateUtc)
                    .FirstOrDefault();
                var first = group.First();
                var gross = Math.Max(0, group.Sum(item =>
                    item.GrossAmount - chargeGrossByContract.GetValueOrDefault(item.Id)));
                var discount = group.Sum(item => item.DiscountAmount);
                var downPayment = group.Sum(item => item.DownPayment);
                var downPaymentPaid = group.Sum(item =>
                    item.DownPaymentPaid ? Math.Max(item.DownPaymentPaidAmount, item.DownPayment) : item.DownPaymentPaidAmount);
                var drivingProfile = group
                    .Select(item => profilesByContract.GetValueOrDefault(item.Id))
                    .FirstOrDefault(item => item is not null);
                var groupContractIds = group.Select(item => item.Id).ToHashSet();
                var groupChargeRows = chargeRows
                    .Where(item => groupContractIds.Contains(item.ContractId))
                    .ToList();
                var groupChargeInstallmentIds = groupChargeRows
                    .Where(item => item.FinanceInstallmentId != null)
                    .Select(item => item.FinanceInstallmentId!.Value)
                    .ToHashSet();
                var courseRemaining = studentInstallments
                    .Where(item => !groupChargeInstallmentIds.Contains(item.Id))
                    .Sum(item => Math.Max(0, item.Amount - item.PaidAmount))
                    + group.Sum(item => Math.Max(0, item.DownPayment - item.DownPaymentPaidAmount));
                var additionalChargeRemaining = studentInstallments
                    .Where(item => groupChargeInstallmentIds.Contains(item.Id))
                    .Sum(item => Math.Max(0, item.Amount - item.PaidAmount))
                    + groupChargeRows
                        .Where(item => item.FinanceInstallmentId == null)
                        .Sum(item => Math.Max(0, item.NetAmount - item.RefundedAmount));
                var standaloneExamFeeRemaining = drivingProfile is not null
                    && drivingProfile.DrivingExamFee > 0
                    && !drivingProfile.DrivingExamFeePaid
                    && !groupChargeRows.Any(item => item.ChargeType == DrivingChargeType.ExamFee)
                        ? drivingProfile.DrivingExamFee
                        : 0;
                var totalPayable = courseRemaining + additionalChargeRemaining + standaloneExamFeeRemaining;
                return new StudentFinanceSummaryDto(
                    first.StudentUserId,
                    first.StudentName,
                    first.ClassName,
                    first.Currency,
                    net,
                    paid,
                    totalPayable,
                    overdue,
                    nextDue,
                    ResolveStatus(totalPayable, overdue, net + standaloneExamFeeRemaining),
                    gross,
                    discount,
                    downPayment,
                    downPaymentPaid,
                    group.Any(item => item.DownPayment > 0 && !item.DownPaymentPaid),
                    drivingProfile?.Id,
                    drivingProfile?.DrivingExamFee ?? 0,
                    drivingProfile?.DrivingExamFeePaid ?? false,
                    drivingProfile is null ? 1 : attemptsByProfile.GetValueOrDefault(drivingProfile.Id, 1),
                    drivingProfile?.DrivingExamDate,
                    courseRemaining,
                    additionalChargeRemaining,
                    standaloneExamFeeRemaining,
                    totalPayable);
            })
            .ToList();
    }

    public async Task<FinancePaymentDto> RefundPaymentAsync(
        RefundRequest request,
        Guid? createdByUserId,
        CancellationToken cancellationToken = default)
    {
        var amount = Math.Abs(request.Amount);
        if (amount <= 0) throw new InvalidOperationException("İade tutarı sıfırdan büyük olmalı.");
        if (string.IsNullOrWhiteSpace(request.Reason)) throw new InvalidOperationException("İade gerekçesi zorunludur.");
        if (string.IsNullOrWhiteSpace(request.RefundChannel)) throw new InvalidOperationException("İade kanalı zorunludur.");
        if (!string.Equals(request.RefundChannel.Trim(), "Nakit", StringComparison.OrdinalIgnoreCase)
            && string.IsNullOrWhiteSpace(request.ExternalReference))
        {
            throw new InvalidOperationException("Kart ve banka iadelerinde işlem referansı zorunludur.");
        }

        var refundType = request.RefundType?.Trim() ?? string.Empty;
        if (refundType is not ("PaymentReversal" or "AdvanceReturn" or "ContractReduction"))
        {
            throw new InvalidOperationException("Geçerli bir iade türü seçilmelidir.");
        }

        // Aynı makbuza eşzamanlı iki iadenin kalan tutarı birlikte aşmasını önler.
        await using var transaction = await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var source = await dbContext.FinancePayments
            .FirstOrDefaultAsync(item => item.Id == request.PaymentId, cancellationToken)
            ?? throw new InvalidOperationException("İade edilecek tahsilat bulunamadı.");
        if (source.Amount <= 0 || source.EntryType == "Refund")
        {
            throw new InvalidOperationException("Yalnızca pozitif bir tahsilat iade edilebilir.");
        }
        var isDownPayment = source.Note.StartsWith("Kayıt peşinatı", StringComparison.OrdinalIgnoreCase);
        if (isDownPayment && refundType != "PaymentReversal")
        {
            throw new InvalidOperationException("Peşinat yalnızca tahsilat iptali/düzeltmesi olarak iade edilebilir.");
        }
        if (refundType == "ContractReduction" && source.EnrollmentContractId is null)
        {
            throw new InvalidOperationException("Sözleşmeye bağlı olmayan tahsilatta ücret indirimi iadesi yapılamaz.");
        }

        var previousRefundAmounts = await dbContext.FinancePayments
            .Where(item => item.OriginalPaymentId == source.Id && item.EntryType == "Refund" && item.RefundStatus == "Completed")
            .Select(item => item.Amount)
            .ToListAsync(cancellationToken);
        var previousRefunds = previousRefundAmounts.Sum(item => -item);
        var refundable = source.Amount - previousRefunds;
        if (amount > refundable)
        {
            throw new InvalidOperationException($"Bu makbuz için en fazla {refundable:0.##} {source.Currency} iade edilebilir.");
        }

        var allocations = await dbContext.FinancePaymentAllocations
            .Where(item => item.FinancePaymentId == source.Id)
            .OrderByDescending(item => item.Sequence)
            .ToListAsync(cancellationToken);
        if (allocations.Count == 0)
        {
            allocations = await CreateLegacyAllocationsAsync(source, cancellationToken);
        }

        var allocationRefundedBefore = allocations.Sum(item => item.RefundedAmount);
        var nonDebtPart = Math.Max(0, source.Amount - allocations.Sum(item => item.Amount));
        var nonDebtRefundedBefore = Math.Max(0, previousRefunds - allocationRefundedBefore);
        var refundableNonDebt = Math.Max(0, nonDebtPart - nonDebtRefundedBefore);

        if (refundType == "AdvanceReturn" && amount > refundableNonDebt)
        {
            throw new InvalidOperationException($"Bu tahsilatta iade edilebilir avans/fazla ödeme en fazla {refundableNonDebt:0.##} {source.Currency}.");
        }

        var remainingToReverse = refundType == "AdvanceReturn" ? 0 : amount;
        if (refundType == "PaymentReversal")
        {
            remainingToReverse = Math.Max(0, amount - refundableNonDebt);
        }
        var allocationCapacity = allocations.Sum(item => item.Amount - item.RefundedAmount);
        if (remainingToReverse > allocationCapacity)
        {
            throw new InvalidOperationException("Seçilen iade türü için yeterli taksit mahsup kaydı bulunamadı.");
        }

        foreach (var allocation in allocations)
        {
            if (remainingToReverse <= 0) break;
            var reversible = Math.Min(allocation.Amount - allocation.RefundedAmount, remainingToReverse);
            if (reversible <= 0) continue;
            var installment = await dbContext.FinanceInstallments
                .FirstAsync(item => item.Id == allocation.FinanceInstallmentId, cancellationToken);
            installment.PaidAmount = Math.Max(0, installment.PaidAmount - reversible);
            allocation.RefundedAmount += reversible;
            remainingToReverse -= reversible;

            if (refundType == "ContractReduction")
            {
                installment.Amount = Math.Max(installment.PaidAmount, installment.Amount - reversible);
            }
            installment.Status = installment.PaidAmount <= 0
                ? "Pending"
                : installment.PaidAmount >= installment.Amount ? "Paid" : "Partial";
        }

        if (refundType == "ContractReduction" && source.EnrollmentContractId is Guid contractId)
        {
            var contract = await dbContext.EnrollmentContracts.FirstAsync(item => item.Id == contractId, cancellationToken);
            contract.NetAmount = Math.Max(0, contract.NetAmount - amount);
            contract.DiscountAmount = Math.Min(contract.GrossAmount, contract.DiscountAmount + amount);
            contract.DiscountReason = $"{contract.DiscountReason} | İade kaynaklı fiyat düzeltmesi: {request.Reason.Trim()}".Trim(' ', '|');
        }

        // Peşinat taksitlere dağıtılmadığı için ayrıca izlenir. Kısmi iadede boolean
        // yerine tutar alanı gerçek durumu taşır; eski alan geriye uyum için güncellenir.
        if (source.EnrollmentContractId is Guid downContractId && isDownPayment)
        {
            var contract = await dbContext.EnrollmentContracts.FirstAsync(item => item.Id == downContractId, cancellationToken);
            contract.DownPaymentPaidAmount = Math.Max(0, contract.DownPaymentPaidAmount - amount);
            contract.DownPaymentPaid = contract.DownPaymentPaidAmount >= contract.DownPayment;
        }

        var refund = new FinancePayment
        {
            EnrollmentContractId = source.EnrollmentContractId,
            StudentUserId = source.StudentUserId,
            StudentName = source.StudentName,
            Amount = -amount,
            Method = "İade",
            ReceiptNo = await NextReceiptNoAsync(cancellationToken),
            Currency = source.Currency,
            Note = $"İade: {request.Reason.Trim()}",
            CreatedByUserId = createdByUserId,
            BranchId = source.BranchId,
            PaidAtUtc = DateTime.UtcNow,
            EntryType = "Refund",
            OriginalPaymentId = source.Id,
            RefundType = refundType,
            RefundStatus = "Completed",
            RefundReason = request.Reason.Trim(),
            RefundChannel = request.RefundChannel.Trim(),
            ExternalReference = request.ExternalReference?.Trim() ?? string.Empty,
        };
        await dbContext.FinancePayments.AddAsync(refund, cancellationToken);
        await dbContext.AccountingNotifications.AddAsync(new AccountingNotification
        {
            Title = "Öğrenci iadesi tamamlandı",
            Message = $"{refund.StudentName} için {amount:0.##} {refund.Currency} iade edildi ({refund.RefundChannel} • Kaynak {source.ReceiptNo}).",
            Time = "Bugün",
            Unread = true,
        }, cancellationToken);
        await dbContext.AccountingAuditLogs.AddAsync(new AccountingAuditLog
        {
            Title = "Makbuzdan iade işlendi",
            Detail = $"{refund.StudentName} — {amount:0.##} {refund.Currency}; kaynak {source.ReceiptNo}; tür {refundType}; gerekçe: {refund.RefundReason}.",
            Time = $"{DateTime.Now:dd MMMM yyyy} • {DateTime.Now:HH:mm}",
        }, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        await auditLogService.LogAsync(
            "İade yapıldı",
            "Finance",
            "FinancePayment",
            refund.Id.ToString(),
            $"{refund.StudentName} — {amount:0.##} {refund.Currency} iade edildi. Kaynak makbuz: {source.ReceiptNo}. Tür: {refundType}. Gerekçe: {request.Reason.Trim()}.",
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return MapPayment(refund, 0, 0);
    }

    public async Task<FinanceDashboardDto> GetDashboardAsync(
        string? className,
        DateTime? fromUtc = null,
        DateTime? toUtc = null,
        CancellationToken cancellationToken = default)
    {
        var contractQuery = dbContext.EnrollmentContracts.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(className))
        {
            var normalized = className.Trim();
            contractQuery = contractQuery.Where(item => item.ClassName == normalized);
        }

        var contracts = await contractQuery.ToListAsync(cancellationToken);
        var hasDateRange = fromUtc.HasValue || toUtc.HasValue;
        var dashboardContracts = contracts
            .Where(item =>
                (!fromUtc.HasValue || item.CreatedAtUtc >= fromUtc.Value)
                && (!toUtc.HasValue || item.CreatedAtUtc < toUtc.Value))
            .ToList();
        var contractIds = contracts.Select(item => item.Id).ToHashSet();
        var studentUserIds = contracts
            .Where(item => item.StudentUserId != null)
            .Select(item => item.StudentUserId!.Value)
            .ToHashSet();
        var studentNamesLower = contracts
            .Where(item => !string.IsNullOrWhiteSpace(item.StudentName))
            .Select(item => NormalizeStudentName(item.StudentName))
            .ToHashSet();

        var installments = await dbContext.FinanceInstallments.AsNoTracking()
            .Where(item => contractIds.Contains(item.EnrollmentContractId))
            .ToListAsync(cancellationToken);
        var dashboardInstallments = installments
            .Where(item =>
                (!fromUtc.HasValue || item.DueDateUtc >= fromUtc.Value)
                && (!toUtc.HasValue || item.DueDateUtc < toUtc.Value))
            .ToList();
        // Tahsilatlar sözleşmeye bağlanmamış (peşin/manuel/iade) olabilir; hesap görünümüyle
        // tutarlı kalmak için contract / öğrenci kullanıcı / öğrenci adı (harf duyarsız) üzerinden toplanır.
        var paymentQuery = dbContext.FinancePayments.AsNoTracking()
            .Where(item =>
                (item.EnrollmentContractId != null && contractIds.Contains(item.EnrollmentContractId.Value))
                || (item.StudentUserId != null && studentUserIds.Contains(item.StudentUserId.Value))
                || (item.StudentName != string.Empty && studentNamesLower.Contains(item.StudentName.Trim().ToLower())));
        if (fromUtc.HasValue) paymentQuery = paymentQuery.Where(item => item.PaidAtUtc >= fromUtc.Value);
        if (toUtc.HasValue) paymentQuery = paymentQuery.Where(item => item.PaidAtUtc < toUtc.Value);
        var payments = await paymentQuery.ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        var net = dashboardContracts.Sum(item => item.NetAmount);
        var collected = FinanceTotals.NetCollected(payments.Select(item => item.Amount));
        // Fazla/avans tahsilatta net'ten büyük olabilir; "Bekleyen" negatif gösterilmesin.
        var outstanding = hasDateRange
            ? dashboardInstallments.Sum(item => Math.Max(0, item.Amount - item.PaidAmount))
            : FinanceTotals.Outstanding(net, collected);

        decimal BucketAmount(int minDays, int maxDays) => dashboardInstallments
            .Where(item =>
            {
                var remaining = item.Amount - item.PaidAmount;
                if (remaining <= 0 || item.DueDateUtc >= now) return false;
                var overdueDays = (now - item.DueDateUtc).TotalDays;
                return overdueDays >= minDays && (maxDays < 0 || overdueDays < maxDays);
            })
            .Sum(item => item.Amount - item.PaidAmount);

        int BucketCount(int minDays, int maxDays) => dashboardInstallments
            .Count(item =>
            {
                var remaining = item.Amount - item.PaidAmount;
                if (remaining <= 0 || item.DueDateUtc >= now) return false;
                var overdueDays = (now - item.DueDateUtc).TotalDays;
                return overdueDays >= minDays && (maxDays < 0 || overdueDays < maxDays);
            });

        var aging = new List<AgingBucketDto>
        {
            new("0-30 gün", BucketCount(0, 30), BucketAmount(0, 30)),
            new("30-60 gün", BucketCount(30, 60), BucketAmount(30, 60)),
            new("60-90 gün", BucketCount(60, 90), BucketAmount(60, 90)),
            new("90+ gün", BucketCount(90, -1), BucketAmount(90, -1)),
        };

        var overdueInstallments = dashboardInstallments.Where(item => item.Amount - item.PaidAmount > 0 && item.DueDateUtc < now).ToList();
        var overdueTotal = overdueInstallments.Sum(item => item.Amount - item.PaidAmount);
        var overdueStudents = overdueInstallments
            .Select(item => item.StudentName)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();

        var rateBase = hasDateRange ? collected + outstanding : net;
        var collectionRate = rateBase > 0
            ? (int)Math.Round(Math.Clamp(collected / rateBase, 0, 1) * 100)
            : 0;

        // Ortalama tahsil süresi (DSO yaklaşık): ödeme tarihi - ilgili sözleşme tarihi.
        var contractDateById = contracts.ToDictionary(item => item.Id, item => item.CreatedAtUtc);
        var collectionDays = payments
            .Where(item => item.Amount > 0 && item.EnrollmentContractId != null && contractDateById.ContainsKey(item.EnrollmentContractId.Value))
            .Select(item => (item.PaidAtUtc - contractDateById[item.EnrollmentContractId!.Value]).TotalDays)
            .Where(days => days >= 0)
            .ToList();
        var avgCollectionDays = collectionDays.Count > 0 ? (int)Math.Round(collectionDays.Average()) : 0;

        var monthly = payments
            .Where(item => item.Amount > 0)
            .GroupBy(item => new { item.PaidAtUtc.Year, item.PaidAtUtc.Month })
            .OrderBy(group => group.Key.Year).ThenBy(group => group.Key.Month)
            .Select(group => new MonthlyIncomeDto($"{group.Key.Year}-{group.Key.Month:D2}", group.Sum(payment => payment.Amount)))
            .ToList();

        IReadOnlyList<StudentFinanceSummaryDto> topDebtors;
        if (hasDateRange)
        {
            var contractById = contracts.ToDictionary(item => item.Id);
            topDebtors = dashboardInstallments
                .GroupBy(item => NormalizeStudentName(item.StudentName))
                .Select(group =>
                {
                    var firstInstallment = group.First();
                    var contract = contractById.GetValueOrDefault(firstInstallment.EnrollmentContractId);
                    var due = group.Sum(item => item.Amount);
                    var paid = group.Sum(item => item.PaidAmount);
                    var balance = group.Sum(item => Math.Max(0, item.Amount - item.PaidAmount));
                    return new StudentFinanceSummaryDto(
                        contract?.StudentUserId,
                        firstInstallment.StudentName,
                        contract?.ClassName ?? string.Empty,
                        contract?.Currency ?? "TRY",
                        due,
                        paid,
                        balance,
                        group.Count(item => item.DueDateUtc < now && item.Amount > item.PaidAmount),
                        group.Where(item => item.Amount > item.PaidAmount).MinBy(item => item.DueDateUtc)?.DueDateUtc,
                        ResolveStatus(balance, 0, due));
                })
                .Where(item => item.Balance > 0)
                .OrderByDescending(item => item.Balance)
                .Take(10)
                .ToList();
        }
        else
        {
            var paidByStudent = AttributePaymentsToStudents(contracts, payments);
            topDebtors = contracts
                .GroupBy(ResolveStudentKey)
                .Select(group =>
                {
                    var first = group.First();
                    var groupNet = group.Sum(item => item.NetAmount);
                    var groupPaid = paidByStudent.GetValueOrDefault(group.Key);
                    var groupBalance = FinanceTotals.Outstanding(groupNet, groupPaid);
                    return new StudentFinanceSummaryDto(first.StudentUserId, first.StudentName, first.ClassName, first.Currency,
                        groupNet, groupPaid, groupBalance, 0, null,
                        ResolveStatus(groupBalance, 0, groupNet));
                })
                .Where(item => item.Balance > 0)
                .OrderByDescending(item => item.Balance)
                .Take(10)
                .ToList();
        }

        // Peşinatı beklenen (tahsil edilmemiş) aktif sözleşmeler — dashboard kartı için.
        var pendingDownPayments = dashboardContracts
            .Where(item => item.DownPayment > item.DownPaymentPaidAmount && item.Status == "Active")
            .ToList();
        var pendingDownPaymentTotal = pendingDownPayments.Sum(item => item.DownPayment - item.DownPaymentPaidAmount);
        var refundedTotal = payments.Where(item => item.Amount < 0).Sum(item => -item.Amount);

        var currency = contracts.FirstOrDefault()?.Currency ?? "TRY";
        return new FinanceDashboardDto(
            currency, net, collected, outstanding, overdueTotal, overdueStudents,
            collectionRate, avgCollectionDays, pendingDownPayments.Count, pendingDownPaymentTotal,
            aging, monthly, topDebtors, refundedTotal);
    }

    public async Task<ReminderResultDto> SendDueRemindersAsync(
        int upcomingWindowDays,
        CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var windowEnd = now.AddDays(Math.Max(1, upcomingWindowDays));
        var due = await dbContext.FinanceInstallments.AsNoTracking()
            .Where(item => item.Amount - item.PaidAmount > 0 && item.DueDateUtc <= windowEnd)
            .ToListAsync(cancellationToken);

        var overdueCount = due.Count(item => item.DueDateUtc < now);
        var upcomingCount = due.Count(item => item.DueDateUtc >= now);
        var notified = 0;

        foreach (var group in due.GroupBy(item => item.StudentName))
        {
            if (string.IsNullOrWhiteSpace(group.Key)) continue;
            var totalDue = group.Sum(item => item.Amount - item.PaidAmount);
            var isOverdue = group.Any(item => item.DueDateUtc < now);
            // Veliye hem uygulama içi bildirim hem de telefona push (ParentNotifier
            // öğrencinin velisini çözer ve iki kanaldan bildirir).
            await parentNotifier.NotifyStudentParentAsync(
                group.Key,
                isOverdue ? "Geciken ödeme hatırlatması" : "Yaklaşan ödeme hatırlatması",
                $"{group.Key} için {(isOverdue ? "vadesi geçen" : "yaklaşan")} {MoneyText.Format(totalDue)} taksit bulunuyor.",
                "FinanceReminder",
                cancellationToken);
            notified++;
        }

        return new ReminderResultDto(notified, upcomingCount, overdueCount);
    }

    /// <summary>
    /// Sıradaki makbuz numarası (MKB-yyyyAA-NNNNN).
    ///
    /// Eskiden <c>COUNT(*) + 1</c> ile üretiliyordu; bu üç şeyi birden bozuyordu:
    /// sayaç TÜM kiracılar üzerinden ortaktı (başka kurum tahsilat alınca numara
    /// zıplıyordu), silinen bir kayıt numarayı geri sarıp mükerrer üretiyordu ve
    /// paralel iki tahsilat aynı numarayı alabiliyordu.
    ///
    /// Artık numara kiracının o AYKİ en büyük numarasından türetilir (sıfır dolgulu
    /// sonek sayesinde sözlük sırası = sayısal sıra) ve alınmışsa bir sonrakine
    /// geçilir. Bu, pratikteki çakışmaları kapatır; TAM garanti için veritabanı
    /// tarafında ReceiptNo üzerinde tekil kısıt gerekir (mevcut veride mükerrer
    /// olabileceğinden ayrı bir temizlik + migration adımı ister).
    /// </summary>
    public async Task<string> NextReceiptNumberAsync(CancellationToken cancellationToken = default)
    {
        var prefix = $"MKB-{DateTime.UtcNow:yyyyMM}-";

        // Global query filter kiracıyı zaten süzer; numara kurum içinde sıralıdır.
        var lastReceiptNo = await dbContext.FinancePayments
            .Where(item => item.ReceiptNo != null && item.ReceiptNo.StartsWith(prefix))
            .OrderByDescending(item => item.ReceiptNo)
            .Select(item => item.ReceiptNo)
            .FirstOrDefaultAsync(cancellationToken);

        var lastSequence = 0;
        if (!string.IsNullOrEmpty(lastReceiptNo) && lastReceiptNo.Length > prefix.Length)
        {
            _ = int.TryParse(lastReceiptNo[prefix.Length..], NumberStyles.Integer, CultureInfo.InvariantCulture, out lastSequence);
        }

        for (var attempt = 1; attempt <= 10; attempt++)
        {
            var candidate = $"{prefix}{lastSequence + attempt:D5}";
            var taken = await dbContext.FinancePayments
                .AnyAsync(item => item.ReceiptNo == candidate, cancellationToken);
            if (!taken) return candidate;
        }

        // Sıra kapalıysa numarasız makbuz kesmek yerine çakışmayan bir sonek kullan.
        // DİKKAT: bu numara bilerek FARKLI bir önek taşır ("...AA" + 'X'). Aynı öneki
        // kullansaydı, harf içeren sonek sözlük sırasında rakamların ÜSTÜNE çıkar,
        // yukarıdaki OrderByDescending onu "son numara" sanır, int.TryParse başarısız
        // olur ve o ayın sayacı kalıcı olarak 1'e düşerdi. Ayrı önek bu kaydı max
        // sorgusunun dışında tutar.
        return $"MKB-{DateTime.UtcNow:yyyyMM}X-{Guid.NewGuid():N}"[..24];
    }

    private Task<string> NextReceiptNoAsync(CancellationToken cancellationToken)
        => NextReceiptNumberAsync(cancellationToken);

    /// <summary>
    /// Dağılım tablosundan önce oluşturulmuş tahsilatları, bugün taksitlerde görünen
    /// PaidAmount toplamını aşmadan kronolojik FIFO ile bir kez izlenebilir hale getirir.
    /// Tarihsel veriden bilinmeyen ayrıntı uydurmak yerine mevcut cari gerçeğini korur.
    /// </summary>
    private async Task<List<FinancePaymentAllocation>> CreateLegacyAllocationsAsync(
        FinancePayment source,
        CancellationToken cancellationToken)
    {
        var paymentQuery = dbContext.FinancePayments.Where(item => item.Amount > 0 && item.EntryType != "Refund");
        var installmentQuery = dbContext.FinanceInstallments.AsQueryable();
        if (source.EnrollmentContractId is Guid contractId)
        {
            paymentQuery = paymentQuery.Where(item => item.EnrollmentContractId == contractId);
            installmentQuery = installmentQuery.Where(item => item.EnrollmentContractId == contractId);
        }
        else if (source.StudentUserId is Guid studentUserId)
        {
            paymentQuery = paymentQuery.Where(item => item.StudentUserId == studentUserId);
            installmentQuery = installmentQuery.Where(item => item.StudentUserId == studentUserId);
        }
        else
        {
            var normalizedName = source.StudentName.Trim().ToLower();
            paymentQuery = paymentQuery.Where(item => item.StudentName.Trim().ToLower() == normalizedName);
            installmentQuery = installmentQuery.Where(item => item.StudentName.Trim().ToLower() == normalizedName);
        }

        var payments = await paymentQuery.OrderBy(item => item.PaidAtUtc).ThenBy(item => item.Id).ToListAsync(cancellationToken);
        var installments = await installmentQuery.OrderBy(item => item.DueDateUtc).ThenBy(item => item.Id).ToListAsync(cancellationToken);
        var paymentIds = payments.Select(item => item.Id).ToHashSet();
        var existing = await dbContext.FinancePaymentAllocations
            .Where(item => paymentIds.Contains(item.FinancePaymentId))
            .ToListAsync(cancellationToken);
        var allocatedByInstallment = existing
            .GroupBy(item => item.FinanceInstallmentId)
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Amount - item.RefundedAmount));

        foreach (var payment in payments.Where(item => existing.All(allocation => allocation.FinancePaymentId != item.Id)))
        {
            // Kayıt peşinatı taksit planının dışındadır; yanlışlıkla taksite bağlanmaz.
            if (payment.Note.StartsWith("Kayıt peşinatı", StringComparison.OrdinalIgnoreCase)) continue;
            var remaining = payment.Amount;
            var sequence = 0;
            foreach (var installment in installments)
            {
                if (remaining <= 0) break;
                var availablePaid = Math.Max(0, installment.PaidAmount - allocatedByInstallment.GetValueOrDefault(installment.Id));
                var applied = Math.Min(availablePaid, remaining);
                if (applied <= 0) continue;
                var allocation = new FinancePaymentAllocation
                {
                    FinancePaymentId = payment.Id,
                    FinanceInstallmentId = installment.Id,
                    Amount = applied,
                    Sequence = ++sequence,
                    BranchId = payment.BranchId,
                    TenantId = payment.TenantId,
                    CreatedAtUtc = payment.PaidAtUtc,
                };
                await dbContext.FinancePaymentAllocations.AddAsync(allocation, cancellationToken);
                existing.Add(allocation);
                allocatedByInstallment[installment.Id] = allocatedByInstallment.GetValueOrDefault(installment.Id) + applied;
                remaining -= applied;
            }
        }

        return existing
            .Where(item => item.FinancePaymentId == source.Id)
            .OrderByDescending(item => item.Sequence)
            .ToList();
    }

    private static DateTime FirstDayOfNextMonth(DateTime reference)
    {
        var firstOfThisMonth = new DateTime(reference.Year, reference.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        return firstOfThisMonth.AddMonths(1);
    }

    // Öğrenci adını eşleştirme/gruplama için normalize eder (trim + küçük harf),
    // böylece "Aras Arslan" ile "ARAS ARSLAN" / fazladan boşluklu yazımlar aynı
    // öğrenci sayılır ve manuel tahsilatlar doğru toplama/cariye düşer.
    private static string NormalizeStudentName(string? value) =>
        (value ?? string.Empty).Trim().ToLowerInvariant();

    private static string ResolveStudentKey(EnrollmentContract contract) =>
        contract.StudentUserId is Guid studentUserId
            ? $"user:{studentUserId:N}"
            : string.IsNullOrWhiteSpace(contract.StudentName)
                ? $"contract:{contract.Id:N}"
                : $"name:{NormalizeStudentName(contract.StudentName)}";

    // Tahsilatları öğrenci grubuna (ResolveStudentKey) toplar. Bir ödeme tek bir
    // gruba atanır: önce bağlı olduğu sözleşme, yoksa öğrenci adı, yoksa öğrenci
    // kullanıcı kimliği. Böylece sözleşmeye bağlanmamış ödemeler de doğru öğrenciye
    // yansır ve çift sayım olmaz (GetAccountAsync ile tutarlı).
    private static Dictionary<string, decimal> AttributePaymentsToStudents(
        IReadOnlyList<EnrollmentContract> contracts,
        IReadOnlyList<FinancePayment> payments)
    {
        var studentKeyByContractId = contracts.ToDictionary(item => item.Id, ResolveStudentKey);
        var studentKeyByUserId = contracts
            .Where(item => item.StudentUserId != null)
            .GroupBy(item => item.StudentUserId!.Value)
            .ToDictionary(group => group.Key, group => ResolveStudentKey(group.First()));
        var studentKeyByName = contracts
            .Where(item => !string.IsNullOrWhiteSpace(item.StudentName))
            .GroupBy(item => NormalizeStudentName(item.StudentName))
            .Select(group => new
            {
                Name = group.Key,
                Keys = group.Select(ResolveStudentKey).Distinct().ToList(),
            })
            // Aynı ad iki farklı kullanıcıya aitse adla gelen eski tahsilatı
            // tahmin ederek yanlış hesaba yazma; yalnız tekil eşleşmeyi kabul et.
            .Where(item => item.Keys.Count == 1)
            .ToDictionary(item => item.Name, item => item.Keys[0]);

        return payments
            .Select(payment => new
            {
                Key = payment.EnrollmentContractId is Guid cid && studentKeyByContractId.TryGetValue(cid, out var byContract)
                    ? byContract
                    : payment.StudentUserId is Guid uid && studentKeyByUserId.TryGetValue(uid, out var byUser)
                        ? byUser
                        : !string.IsNullOrWhiteSpace(payment.StudentName)
                            && studentKeyByName.TryGetValue(NormalizeStudentName(payment.StudentName), out var byName)
                            ? byName
                            : null,
                payment.Amount,
            })
            .Where(item => item.Key != null)
            .GroupBy(item => item.Key!)
            .ToDictionary(group => group.Key, group => FinanceTotals.NetCollected(group.Select(item => item.Amount)));
    }

    private static string ResolveStatus(decimal balance, int overdueCount, decimal net)
    {
        if (net <= 0) return "Kayıt yok";
        if (balance <= 0) return "Ödendi";
        if (overdueCount > 0) return "Gecikmiş";
        return "Devam ediyor";
    }

    private static string InstallmentStatus(FinanceInstallment installment, DateTime nowUtc)
    {
        var remaining = installment.Amount - installment.PaidAmount;
        if (remaining <= 0) return "Paid";
        if (installment.DueDateUtc < nowUtc) return "Overdue";
        return installment.PaidAmount > 0 ? "Partial" : "Pending";
    }

    private static EnrollmentContractDto MapContract(EnrollmentContract contract, IReadOnlyList<FinanceInstallment> installments)
    {
        var now = DateTime.UtcNow;
        return new EnrollmentContractDto(
            contract.Id,
            contract.StudentUserId,
            contract.StudentName,
            contract.ClassName,
            contract.AcademicYear,
            contract.GrossAmount,
            contract.DiscountAmount,
            contract.DiscountReason,
            contract.NetAmount,
            contract.DownPayment,
            contract.DownPaymentPaid,
            contract.InstallmentCount,
            contract.Currency,
            contract.Status,
            contract.CreatedAtUtc,
            installments.OrderBy(item => item.SeqNo).Select(item => MapInstallment(item, now)).ToList(),
            contract.DownPaymentPaidAmount,
            contract.DownPayment <= 0 || contract.DownPaymentPaidAmount >= contract.DownPayment
                ? "Ödendi"
                : contract.DownPaymentPaidAmount > 0 ? "Kısmi" : "Bekliyor",
            contract.ScholarshipPercent,
            contract.ScholarshipAmount);
    }

    /// <summary>
    /// İndirim sebebi metnine bursu da yazar; ekstre/sözleşme çıktısında "neden
    /// indirim yapılmış" tek satırda okunabilsin. Burs yoksa metin değişmez.
    /// </summary>
    private static string ComposeDiscountReason(string? reason, decimal scholarshipPercent)
    {
        var text = reason?.Trim() ?? string.Empty;
        if (scholarshipPercent <= 0) return text;
        // Kültüre bağlı biçimlendirme kalıcı metne sızmasın: sunucu kültürü ne olursa
        // olsun "%12,5 burs" yazılır (tr-TR). Aksi hâlde aynı sözleşme sunucuya göre
        // "%12.5" ya da "%12,5" olarak kaydediliyordu.
        var label = $"%{scholarshipPercent.ToString("0.##", CultureInfo.GetCultureInfo("tr-TR"))} burs";
        return string.IsNullOrEmpty(text) ? label : $"{label} + {text}";
    }

    private static FinanceInstallmentDto MapInstallment(FinanceInstallment installment, DateTime nowUtc) =>
        new(
            installment.Id,
            installment.EnrollmentContractId,
            installment.SeqNo,
            installment.Label,
            installment.DueDateUtc,
            installment.Amount,
            installment.PaidAmount,
            installment.Amount - installment.PaidAmount,
            InstallmentStatus(installment, nowUtc),
            installment.Currency);

    private static FinancePaymentDto MapPayment(
        FinancePayment payment,
        decimal refundedAmount = 0,
        decimal refundableAmount = 0,
        decimal allocatedRefundableAmount = 0,
        string collectedByName = "",
        string branchName = "") =>
        new(
            payment.Id,
            payment.EnrollmentContractId,
            payment.FinanceInstallmentId,
            payment.Amount,
            payment.Method,
            payment.ReceiptNo,
            payment.PaidAtUtc,
            payment.Currency,
            payment.Note,
            payment.Amount < 0 ? "Refund" : payment.EntryType,
            payment.OriginalPaymentId,
            refundedAmount,
            refundableAmount,
            payment.RefundType,
            payment.RefundStatus,
            payment.RefundReason,
            payment.RefundChannel,
            payment.ExternalReference,
            allocatedRefundableAmount,
            Math.Max(0, refundableAmount - allocatedRefundableAmount),
            payment.Note.StartsWith("Kayıt peşinatı", StringComparison.OrdinalIgnoreCase),
            collectedByName,
            branchName);
}
