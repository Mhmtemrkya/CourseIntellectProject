namespace CourseIntellect.Domain.Services;

/// <summary>
/// Pano ve analiz grafiğindeki "Gider" toplamına hangi bordro/fatura kaydının
/// gireceğinin tek kaynağı. Reddedilmiş kayıtlar hiç gider değildir; yönetici
/// onayı bekleyen bordro henüz kesinleşmemiştir. Faturalar fatura tarihine göre
/// (muhasebe ekranıyla aynı) döneme yazılır.
/// </summary>
public static class FinanceExpenseRules
{
    public const string Rejected = "Reddedildi";
    public const string AwaitingApproval = "Bekliyor";

    public static bool SalaryCountsAsExpense(string? status) =>
        !string.Equals(status?.Trim(), Rejected, StringComparison.OrdinalIgnoreCase)
        && !string.Equals(status?.Trim(), AwaitingApproval, StringComparison.OrdinalIgnoreCase);

    public static bool InvoiceCountsAsExpense(string? status) =>
        !string.Equals(status?.Trim(), Rejected, StringComparison.OrdinalIgnoreCase);
}
