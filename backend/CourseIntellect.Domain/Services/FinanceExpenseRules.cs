namespace CourseIntellect.Domain.Services;

/// <summary>
/// Pano, analiz grafiği, kasa ve mutabakattaki "Gider"in tek kaynağı. Tahsilat
/// nakit esaslı (ödendiği gün) sayıldığı için gider de öyledir:
///   • bordro yalnız ÖDENDİĞİNDE, ödendiği tarihte gider olur;
///   • fatura yalnız ÖDENDİĞİNDE ve iptal/ret edilmemişse, ödendiği tarihte;
///   • gider defteri kaydı yalnız ONAYLANMIŞSA, gider tarihinde.
/// Ödenmemiş fatura/bordro muhasebe ekranında borç olarak görünür ama kasadan
/// çıkmadığı için gider toplamına girmez.
/// </summary>
public static class FinanceExpenseRules
{
    public const string Paid = "Ödendi";
    public const string Rejected = "Reddedildi";
    public const string Cancelled = "İptal";
    public const string AwaitingApproval = "Bekliyor";
    public const string Approved = "Onaylandı";

    public static bool SalaryCountsAsExpense(string? status) => Is(status, Paid);

    public static bool InvoiceCountsAsExpense(string? status) => Is(status, Paid);

    public static bool ExpenseCountsAsExpense(string? approvalStatus) => Is(approvalStatus, Approved);

    /// <summary>Ödendi işaretlenmiş ama ödeme anı bilinmeyen eski kayıtlarda yedek tarih kullanılır.</summary>
    public static DateTime SalaryExpenseDate(DateTime? paidAtUtc, DateTime createdAtUtc) => paidAtUtc ?? createdAtUtc;

    public static DateTime InvoiceExpenseDate(DateTime? paidAtUtc, DateTime issueDateUtc) => paidAtUtc ?? issueDateUtc;

    private static bool Is(string? value, string expected) =>
        string.Equals(value?.Trim(), expected, StringComparison.OrdinalIgnoreCase);
}
