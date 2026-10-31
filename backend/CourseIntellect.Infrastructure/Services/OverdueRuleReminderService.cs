using System.Globalization;
using System.Net;
using System.Text.Json;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// "Gecikme Kuralları" ekranında tanımlanan kuralları uygular. Her etkin kural,
/// vadesi kuraldaki gün kadar geçmiş borçlar için öğrencinin velisine kuralın
/// şablonuyla (uygulama içi bildirim ve/veya e-posta) bir kez hatırlatma gönderir.
/// Aynı kural aynı gecikme dönemi için ikinci kez çalışmaz (FinanceReminderLog).
/// </summary>
public sealed class OverdueRuleReminderService(
    CourseIntellectDbContext dbContext,
    IParentNotifier parentNotifier,
    IEmailSender emailSender) : IOverdueRuleReminderService
{
    private const string ConfigurationType = "overdue-rules";

    public sealed record OverdueRule(string Id, string Name, int DaysAfterDue, string Channel, string Template, bool Enabled);

    public async Task<OverdueRuleRunResult> RunAsync(CancellationToken cancellationToken = default)
    {
        var rules = await LoadRulesAsync(cancellationToken);
        var active = rules.Where(rule => rule.Enabled && rule.DaysAfterDue >= 0 && rule.Template.Trim().Length > 0).ToList();
        if (active.Count == 0) return new OverdueRuleRunResult(false, 0);

        var now = DateTime.UtcNow;
        var today = FinanceDates.TodayUtcDate(now);
        var activeContractIds = (await dbContext.EnrollmentContracts.AsNoTracking()
            .Where(item => item.Status == "Active")
            .Select(item => item.Id)
            .ToListAsync(cancellationToken)).ToHashSet();
        var overdue = (await dbContext.FinanceInstallments.AsNoTracking()
                .Where(item => item.Amount - item.PaidAmount > 0 && item.DueDateUtc < today)
                .ToListAsync(cancellationToken))
            // Dondurulmuş/iptal sözleşmenin taksiti hatırlatılmaz.
            .Where(item => activeContractIds.Contains(item.EnrollmentContractId))
            .ToList();
        if (overdue.Count == 0) return new OverdueRuleRunResult(true, 0);

        var sent = 0;
        foreach (var group in overdue.GroupBy(item => item.StudentUserId is Guid id
                     ? $"user:{id:N}"
                     : $"name:{item.StudentName.Trim().ToLowerInvariant()}"))
        {
            var oldest = group.OrderBy(item => item.DueDateUtc).First();
            var daysOverdue = (int)(today - oldest.DueDateUtc.Date).TotalDays;
            var totalDue = group.Sum(item => item.Amount - item.PaidAmount);
            var currency = string.IsNullOrWhiteSpace(oldest.Currency) ? "TRY" : oldest.Currency;
            var profile = await FindStudentAsync(oldest, cancellationToken);

            foreach (var rule in active.Where(rule => daysOverdue >= rule.DaysAfterDue))
            {
                // Gecikme dönemi en eski açık taksitle tanımlanır: taksit ödenip yenisi
                // gecikirse kural yeniden çalışır.
                var dedupeKey = $"overdue-rule:{rule.Id}:{group.Key}:{oldest.Id:N}";
                if (dedupeKey.Length > 200) dedupeKey = dedupeKey[..200];
                if (await dbContext.FinanceReminderLogs.AsNoTracking().AnyAsync(item => item.DedupeKey == dedupeKey, cancellationToken))
                {
                    continue;
                }

                var message = Render(rule.Template, profile?.ParentName, oldest.StudentName, totalDue, currency, oldest.DueDateUtc, daysOverdue);
                var channel = (rule.Channel ?? "notification").Trim().ToLowerInvariant();
                var delivered = false;
                if (channel is "notification" or "both" or "sms")
                {
                    await parentNotifier.NotifyStudentParentAsync(
                        oldest.StudentUserId, oldest.StudentName, rule.Name, message, "FinanceOverdueRule", dedupeKey, cancellationToken);
                    delivered = true;
                }
                if (channel is "email" or "both"
                    && emailSender.IsConfigured
                    && profile is not null
                    && !string.IsNullOrWhiteSpace(profile.ParentEmail))
                {
                    delivered |= await emailSender.SendAsync(
                        profile.ParentEmail.Trim(),
                        rule.Name,
                        $"<p>{WebUtility.HtmlEncode(message)}</p>",
                        cancellationToken);
                }

                if (!delivered) continue;
                await dbContext.FinanceReminderLogs.AddAsync(new FinanceReminderLog
                {
                    DedupeKey = dedupeKey,
                    Channel = channel,
                    StudentName = oldest.StudentName,
                }, cancellationToken);
                await dbContext.SaveChangesAsync(cancellationToken);
                sent++;
            }
        }

        return new OverdueRuleRunResult(true, sent);
    }

    private async Task<IReadOnlyList<OverdueRule>> LoadRulesAsync(CancellationToken cancellationToken)
    {
        var tenantId = dbContext.CurrentTenantId;
        if (tenantId is null) return [];
        var payload = await dbContext.PlatformConfigurations.AsNoTracking()
            .Where(item => item.TenantId == tenantId && item.ConfigurationType == ConfigurationType)
            .Select(item => item.PayloadJson)
            .FirstOrDefaultAsync(cancellationToken);
        return ParseRules(payload);
    }

    public static IReadOnlyList<OverdueRule> ParseRules(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload)) return [];
        try
        {
            using var document = JsonDocument.Parse(payload);
            if (!document.RootElement.TryGetProperty("rules", out var rules) || rules.ValueKind != JsonValueKind.Array) return [];
            var result = new List<OverdueRule>();
            foreach (var rule in rules.EnumerateArray())
            {
                var id = Read(rule, "id") ?? Read(rule, "name") ?? string.Empty;
                var days = rule.TryGetProperty("daysAfterDue", out var daysValue) && daysValue.TryGetInt32(out var parsedDays) ? parsedDays : -1;
                var enabled = !rule.TryGetProperty("enabled", out var enabledValue) || enabledValue.ValueKind != JsonValueKind.False;
                result.Add(new OverdueRule(id, Read(rule, "name") ?? "Ödeme hatırlatması", days, Read(rule, "channel") ?? "notification", Read(rule, "template") ?? string.Empty, enabled));
            }
            return result;
        }
        catch (JsonException)
        {
            return [];
        }
    }

    public static string Render(string template, string? parentName, string studentName, decimal amount, string currency, DateTime dueDateUtc, int days) =>
        template
            .Replace("{parentName}", string.IsNullOrWhiteSpace(parentName) ? "Veli" : parentName.Trim(), StringComparison.OrdinalIgnoreCase)
            .Replace("{studentName}", studentName.Trim(), StringComparison.OrdinalIgnoreCase)
            // Şablonlar "{amount} TL" biçiminde yazıldığı için yalnız sayı basılır.
            .Replace("{amount}", amount.ToString("N2", CultureInfo.GetCultureInfo("tr-TR")), StringComparison.OrdinalIgnoreCase)
            .Replace("{currency}", currency == "TRY" ? "TL" : currency, StringComparison.OrdinalIgnoreCase)
            .Replace("{dueDate}", dueDateUtc.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture), StringComparison.OrdinalIgnoreCase)
            .Replace("{days}", days.ToString(CultureInfo.InvariantCulture), StringComparison.OrdinalIgnoreCase);

    private async Task<StudentProfile?> FindStudentAsync(FinanceInstallment installment, CancellationToken cancellationToken)
    {
        if (installment.StudentUserId is Guid userId)
        {
            return await dbContext.Students.AsNoTracking().FirstOrDefaultAsync(item => item.UserId == userId, cancellationToken);
        }
        var matches = await dbContext.Students.AsNoTracking()
            .Where(item => item.FullName == installment.StudentName)
            .Take(2)
            .ToListAsync(cancellationToken);
        return matches.Count == 1 ? matches[0] : null;
    }

    private static string? Read(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}
