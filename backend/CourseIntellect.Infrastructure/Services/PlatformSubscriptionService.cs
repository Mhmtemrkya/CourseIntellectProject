using CourseIntellect.Application.DTOs.PlatformSubscriptions;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

public sealed class PlatformSubscriptionService(CourseIntellectDbContext dbContext) : IPlatformSubscriptionService
{
    public async Task<PlatformSubscriptionInvoiceDto> CreateAsync(
        Guid? actorUserId,
        Guid tenantId,
        CreatePlatformSubscriptionInvoiceRequest request,
        bool autoApprove,
        CancellationToken cancellationToken = default)
    {
        if (tenantId == Guid.Empty)
        {
            throw new InvalidOperationException("Tenant kimliği belirlenemedi.");
        }

        var tenant = await dbContext.TenantWorkspaces
            .FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken)
            ?? throw new InvalidOperationException("Kurum bulunamadı.");

        if (request.Amount < 0)
        {
            throw new InvalidOperationException("Tutar geçersiz.");
        }

        var billingPeriod = string.IsNullOrWhiteSpace(request.BillingPeriod) ? "Aylık" : request.BillingPeriod.Trim();
        var now = DateTime.UtcNow;
        var periodEnd = string.Equals(billingPeriod, "Yıllık", StringComparison.OrdinalIgnoreCase)
            ? now.AddYears(1)
            : now.AddMonths(1);

        var invoiceNumber = await GenerateInvoiceNumberAsync(now.Year, cancellationToken);

        var invoice = new PlatformSubscriptionInvoice
        {
            TenantId = tenant.Id,
            TenantName = tenant.Name,
            TenantContactEmail = tenant.ContactEmail,
            InvoiceNumber = invoiceNumber,
            PlanId = request.PlanId.Trim(),
            PlanName = string.IsNullOrWhiteSpace(request.PlanName) ? request.PlanId : request.PlanName.Trim(),
            Amount = request.Amount,
            Currency = string.IsNullOrWhiteSpace(request.Currency) ? "TRY" : request.Currency.Trim().ToUpperInvariant(),
            BillingPeriod = billingPeriod,
            PeriodStartUtc = now,
            PeriodEndUtc = periodEnd,
            Status = autoApprove ? "paid" : "pending",
            IssuedAtUtc = now,
            DueAtUtc = now.AddDays(14),
            PaidAtUtc = autoApprove ? now : null,
            Notes = request.Notes,
        };

        dbContext.PlatformSubscriptionInvoices.Add(invoice);

        // Auto-approve sürecinde kurum planını da güncelle
        if (autoApprove && !string.IsNullOrWhiteSpace(invoice.PlanName))
        {
            tenant.Plan = invoice.PlanName;
            tenant.MonthlyFee = string.Equals(billingPeriod, "Yıllık", StringComparison.OrdinalIgnoreCase)
                ? invoice.Amount / 12m
                : invoice.Amount;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return ToDto(invoice);
    }

    public async Task<IReadOnlyList<PlatformSubscriptionInvoiceDto>> GetAllAsync(
        string? statusFilter = null,
        string? search = null,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.PlatformSubscriptionInvoices.AsQueryable();

        if (!string.IsNullOrWhiteSpace(statusFilter) && !string.Equals(statusFilter, "all", StringComparison.OrdinalIgnoreCase))
        {
            var s = statusFilter.Trim().ToLowerInvariant();
            query = query.Where(i => i.Status == s);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(i =>
                EF.Functions.ILike(i.InvoiceNumber, $"%{term}%") ||
                EF.Functions.ILike(i.TenantName, $"%{term}%") ||
                EF.Functions.ILike(i.PlanName, $"%{term}%"));
        }

        var list = await query
            .OrderByDescending(i => i.IssuedAtUtc)
            .ToListAsync(cancellationToken);

        return list.Select(ToDto).ToList();
    }

    public async Task<IReadOnlyList<PlatformSubscriptionInvoiceDto>> GetForTenantAsync(
        Guid tenantId,
        CancellationToken cancellationToken = default)
    {
        var list = await dbContext.PlatformSubscriptionInvoices
            .Where(i => i.TenantId == tenantId)
            .OrderByDescending(i => i.IssuedAtUtc)
            .ToListAsync(cancellationToken);

        return list.Select(ToDto).ToList();
    }

    public async Task<PlatformSubscriptionInvoiceDto?> GetByIdAsync(
        Guid invoiceId,
        CancellationToken cancellationToken = default)
    {
        var invoice = await dbContext.PlatformSubscriptionInvoices
            .FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken);
        return invoice is null ? null : ToDto(invoice);
    }

    public async Task<PlatformSubscriptionInvoiceDto?> MarkPaidAsync(
        Guid invoiceId,
        MarkPlatformInvoicePaidRequest request,
        CancellationToken cancellationToken = default)
    {
        var invoice = await dbContext.PlatformSubscriptionInvoices
            .FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken);
        if (invoice is null) return null;

        invoice.Status = "paid";
        invoice.PaidAtUtc = request.PaidAtUtc ?? DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(request.Notes))
        {
            invoice.Notes = request.Notes;
        }

        // Tenant plan'ını ödeme onaylanınca güncelle
        var tenant = await dbContext.TenantWorkspaces.FirstOrDefaultAsync(t => t.Id == invoice.TenantId, cancellationToken);
        if (tenant is not null && !string.IsNullOrWhiteSpace(invoice.PlanName))
        {
            tenant.Plan = invoice.PlanName;
            tenant.MonthlyFee = string.Equals(invoice.BillingPeriod, "Yıllık", StringComparison.OrdinalIgnoreCase)
                ? invoice.Amount / 12m
                : invoice.Amount;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(invoice);
    }

    public async Task<PlatformSubscriptionInvoiceDto?> CancelAsync(
        Guid invoiceId,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var invoice = await dbContext.PlatformSubscriptionInvoices
            .FirstOrDefaultAsync(i => i.Id == invoiceId, cancellationToken);
        if (invoice is null) return null;

        invoice.Status = "cancelled";
        if (!string.IsNullOrWhiteSpace(notes))
        {
            invoice.Notes = notes;
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(invoice);
    }

    private async Task<string> GenerateInvoiceNumberAsync(int year, CancellationToken cancellationToken)
    {
        var prefix = $"CI-{year}-";
        var lastNumber = await dbContext.PlatformSubscriptionInvoices
            .Where(i => i.InvoiceNumber.StartsWith(prefix))
            .OrderByDescending(i => i.InvoiceNumber)
            .Select(i => i.InvoiceNumber)
            .FirstOrDefaultAsync(cancellationToken);

        var seq = 1;
        if (!string.IsNullOrEmpty(lastNumber) && lastNumber.Length > prefix.Length)
        {
            var tail = lastNumber[prefix.Length..];
            if (int.TryParse(tail, out var parsed))
            {
                seq = parsed + 1;
            }
        }

        return $"{prefix}{seq:D6}";
    }

    private static PlatformSubscriptionInvoiceDto ToDto(PlatformSubscriptionInvoice x) => new(
        x.Id,
        x.TenantId,
        x.TenantName,
        x.TenantContactEmail,
        x.InvoiceNumber,
        x.PlanId,
        x.PlanName,
        x.Amount,
        x.Currency,
        x.BillingPeriod,
        x.PeriodStartUtc,
        x.PeriodEndUtc,
        x.Status,
        x.IssuedAtUtc,
        x.DueAtUtc,
        x.PaidAtUtc,
        x.Notes
    );
}
