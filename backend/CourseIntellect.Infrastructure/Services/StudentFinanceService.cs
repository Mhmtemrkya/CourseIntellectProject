using System.Globalization;
using CourseIntellect.Application.DTOs.Notifications;
using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class StudentFinanceService(
    CourseIntellectDbContext dbContext,
    INotificationService notificationService,
    IParentNotifier parentNotifier) : IStudentFinanceService
{
    public async Task<EnrollmentContractDto> CreateEnrollmentAsync(
        CreateEnrollmentRequest request,
        Guid? createdByUserId,
        CancellationToken cancellationToken = default)
    {
        var gross = Math.Max(0, request.GrossAmount);
        var discount = Math.Clamp(request.DiscountAmount, 0, gross);
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
            DiscountReason = request.DiscountReason?.Trim() ?? string.Empty,
            NetAmount = net,
            DownPayment = downPayment,
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

        // Peşinat varsa makbuzlu tahsilat olarak kaydedilir (cari bakiyeye yansır)
        // ve manuel tahsilatla parite olması için muhasebe bildirim + audit kaydı düşülür;
        // böylece kayıt peşinatı tahsilat listesinde, makbuzda, özet toplamlarında ve
        // muhasebe aktivite akışında eksiksiz görünür.
        if (downPayment > 0)
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

            var amountLabel = $"₺{downPayment.ToString("N2", CultureInfo.GetCultureInfo("tr-TR"))}";
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
            .GroupBy(item => item.EnrollmentContractId!.Value)
            .Select(group => new { Id = group.Key, Paid = group.Sum(x => x.Amount) })
            .ToListAsync(cancellationToken))
            .ToDictionary(item => item.Id, item => item.Paid);

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
        var paid = payments.Sum(item => item.Amount);
        var currency = contracts.FirstOrDefault()?.Currency
            ?? installments.FirstOrDefault()?.Currency
            ?? "TRY";
        var overdue = installments.Count(item => item.Amount - item.PaidAmount > 0 && item.DueDateUtc < now);
        var nextDue = installments
            .Where(item => item.Amount - item.PaidAmount > 0)
            .OrderBy(item => item.DueDateUtc)
            .Select(item => (DateTime?)item.DueDateUtc)
            .FirstOrDefault();

        var installmentsByContract = installments
            .GroupBy(item => item.EnrollmentContractId)
            .ToDictionary(group => group.Key, group => group.ToList());

        return new StudentFinanceAccountDto(
            studentUserId,
            name,
            currency,
            net,
            paid,
            net - paid,
            overdue,
            nextDue,
            contracts.Select(item => MapContract(item, installmentsByContract.GetValueOrDefault(item.Id) ?? [])).ToList(),
            installments.Select(item => MapInstallment(item, now)).ToList(),
            payments.Select(MapPayment).ToList());
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

        Guid? contractId = request.EnrollmentContractId;
        var currency = "TRY";

        // Ödemeyi belirli bir taksite ya da en eski ödenmemiş taksitlere (FIFO) mahsup et.
        var remainingToAllocate = amount;
        var targetInstallments = new List<FinanceInstallment>();
        if (request.FinanceInstallmentId is Guid installmentId)
        {
            var installment = await dbContext.FinanceInstallments
                .FirstOrDefaultAsync(item => item.Id == installmentId, cancellationToken);
            if (installment != null)
            {
                targetInstallments.Add(installment);
                contractId ??= installment.EnrollmentContractId;
            }
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
            installment.Status = installment.PaidAmount >= installment.Amount ? "Paid" : "Partial";
            currency = installment.Currency;
            contractId ??= installment.EnrollmentContractId;
        }

        // Borçtan fazla ödeme: artan tutar hiçbir taksite gitmez; "Avans" olarak işaretle.
        var baseNote = request.Note?.Trim() ?? string.Empty;
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
            PaidAtUtc = DateTime.UtcNow,
        };
        await dbContext.FinancePayments.AddAsync(payment, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

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
            account.Balance,
            account.OverdueCount,
            account.NextDueDateUtc,
            ResolveStatus(account.Balance, account.OverdueCount, account.NetTotal));
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
                return new StudentFinanceSummaryDto(
                    first.StudentUserId,
                    first.StudentName,
                    first.ClassName,
                    first.Currency,
                    net,
                    paid,
                    net - paid,
                    overdue,
                    nextDue,
                    ResolveStatus(net - paid, overdue, net));
            })
            .ToList();
    }

    public async Task<FinancePaymentDto> RefundPaymentAsync(
        RefundRequest request,
        Guid? createdByUserId,
        CancellationToken cancellationToken = default)
    {
        var amount = Math.Abs(request.Amount);
        var name = request.StudentName.Trim();
        var nameLower = name.ToLowerInvariant();

        // İade tutarını öğrencinin ödenmiş taksitlerine TERS dağıt: en son ödenen
        // (vadesi en geç) taksitten başlayarak PaidAmount'u düş, durumu geri al.
        // Böylece "Bekleyen" ile taksit-detayı tutarlı kalır ve aging borcu tekrar görür.
        var query = dbContext.FinanceInstallments.AsQueryable();
        query = request.EnrollmentContractId is Guid rcid
            ? query.Where(item => item.EnrollmentContractId == rcid)
            : request.StudentUserId is Guid rsid
                ? query.Where(item => item.StudentUserId == rsid)
                : query.Where(item => item.StudentName.Trim().ToLower() == nameLower);
        var paidInstallments = await query
            .Where(item => item.PaidAmount > 0)
            .OrderByDescending(item => item.DueDateUtc)
            .ToListAsync(cancellationToken);

        var remainingToReverse = amount;
        foreach (var installment in paidInstallments)
        {
            if (remainingToReverse <= 0) break;
            var reversible = Math.Min(installment.PaidAmount, remainingToReverse);
            installment.PaidAmount -= reversible;
            remainingToReverse -= reversible;
            installment.Status = installment.PaidAmount <= 0
                ? "Pending"
                : (installment.PaidAmount >= installment.Amount ? "Paid" : "Partial");
        }

        // İade, negatif tutarlı bir tahsilat kaydı olarak işlenir (cari bakiyeyi artırır).
        var refund = new FinancePayment
        {
            EnrollmentContractId = request.EnrollmentContractId,
            StudentUserId = request.StudentUserId,
            StudentName = name,
            Amount = -amount,
            Method = "İade",
            ReceiptNo = await NextReceiptNoAsync(cancellationToken),
            Currency = "TRY",
            Note = string.IsNullOrWhiteSpace(request.Reason) ? "İade" : $"İade: {request.Reason.Trim()}",
            CreatedByUserId = createdByUserId,
            PaidAtUtc = DateTime.UtcNow,
        };
        await dbContext.FinancePayments.AddAsync(refund, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
        return MapPayment(refund);
    }

    public async Task<FinanceDashboardDto> GetDashboardAsync(
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
        // Tahsilatlar sözleşmeye bağlanmamış (peşin/manuel/iade) olabilir; hesap görünümüyle
        // tutarlı kalmak için contract / öğrenci kullanıcı / öğrenci adı (harf duyarsız) üzerinden toplanır.
        var payments = await dbContext.FinancePayments.AsNoTracking()
            .Where(item =>
                (item.EnrollmentContractId != null && contractIds.Contains(item.EnrollmentContractId.Value))
                || (item.StudentUserId != null && studentUserIds.Contains(item.StudentUserId.Value))
                || (item.StudentName != string.Empty && studentNamesLower.Contains(item.StudentName.Trim().ToLower())))
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        var net = contracts.Sum(item => item.NetAmount);
        var collected = payments.Sum(item => item.Amount);
        // Fazla/avans tahsilatta net'ten büyük olabilir; "Bekleyen" negatif gösterilmesin.
        var outstanding = Math.Max(0, net - collected);

        decimal BucketAmount(int minDays, int maxDays) => installments
            .Where(item =>
            {
                var remaining = item.Amount - item.PaidAmount;
                if (remaining <= 0 || item.DueDateUtc >= now) return false;
                var overdueDays = (now - item.DueDateUtc).TotalDays;
                return overdueDays >= minDays && (maxDays < 0 || overdueDays < maxDays);
            })
            .Sum(item => item.Amount - item.PaidAmount);

        int BucketCount(int minDays, int maxDays) => installments
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

        var overdueInstallments = installments.Where(item => item.Amount - item.PaidAmount > 0 && item.DueDateUtc < now).ToList();
        var overdueTotal = overdueInstallments.Sum(item => item.Amount - item.PaidAmount);
        var overdueStudents = overdueInstallments
            .Select(item => item.StudentName)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Count();

        var collectionRate = net > 0 ? (int)Math.Round(Math.Clamp(collected / net, 0, 1) * 100) : 0;

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

        var paidByStudent = AttributePaymentsToStudents(contracts, payments);
        var topDebtors = contracts
            .GroupBy(ResolveStudentKey)
            .Select(group =>
            {
                var first = group.First();
                var groupNet = group.Sum(item => item.NetAmount);
                var groupPaid = paidByStudent.GetValueOrDefault(group.Key);
                return new StudentFinanceSummaryDto(first.StudentUserId, first.StudentName, first.ClassName, first.Currency,
                    groupNet, groupPaid, groupNet - groupPaid, 0, null,
                    ResolveStatus(groupNet - groupPaid, 0, groupNet));
            })
            .Where(item => item.Balance > 0)
            .OrderByDescending(item => item.Balance)
            .Take(10)
            .ToList();

        var currency = contracts.FirstOrDefault()?.Currency ?? "TRY";
        return new FinanceDashboardDto(
            currency, net, collected, outstanding, overdueTotal, overdueStudents,
            collectionRate, avgCollectionDays, aging, monthly, topDebtors);
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
                $"{group.Key} için {(isOverdue ? "vadesi geçen" : "yaklaşan")} {totalDue.ToString("N2")} ₺ taksit bulunuyor.",
                "FinanceReminder",
                cancellationToken);
            notified++;
        }

        return new ReminderResultDto(notified, upcomingCount, overdueCount);
    }

    private async Task<string> NextReceiptNoAsync(CancellationToken cancellationToken)
    {
        var count = await dbContext.FinancePayments.CountAsync(cancellationToken);
        return $"MKB-{DateTime.UtcNow:yyyyMM}-{count + 1:D5}";
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
        string.IsNullOrWhiteSpace(contract.StudentName)
            ? contract.Id.ToString()
            : NormalizeStudentName(contract.StudentName);

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

        return payments
            .Select(payment => new
            {
                Key = payment.EnrollmentContractId is Guid cid && studentKeyByContractId.TryGetValue(cid, out var byContract)
                    ? byContract
                    : !string.IsNullOrWhiteSpace(payment.StudentName)
                        ? NormalizeStudentName(payment.StudentName)
                        : payment.StudentUserId is Guid uid && studentKeyByUserId.TryGetValue(uid, out var byUser)
                            ? byUser
                            : null,
                payment.Amount,
            })
            .Where(item => item.Key != null)
            .GroupBy(item => item.Key!)
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Amount));
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
            contract.InstallmentCount,
            contract.Currency,
            contract.Status,
            contract.CreatedAtUtc,
            installments.OrderBy(item => item.SeqNo).Select(item => MapInstallment(item, now)).ToList());
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

    private static FinancePaymentDto MapPayment(FinancePayment payment) =>
        new(
            payment.Id,
            payment.EnrollmentContractId,
            payment.FinanceInstallmentId,
            payment.Amount,
            payment.Method,
            payment.ReceiptNo,
            payment.PaidAtUtc,
            payment.Currency,
            payment.Note);
}
