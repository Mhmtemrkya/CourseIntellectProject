namespace CourseIntellect.Domain.Services;

/// <summary>Serbest metin ödeme yöntemini kanala indirger (kasa ve mutabakat için).</summary>
public static class FinanceMethods
{
    public static bool IsCash(string? method)
    {
        var text = (method ?? string.Empty).Trim().ToLowerInvariant();
        return text.Contains("nakit") || text.Contains("cash");
    }

    public static bool IsCard(string? method)
    {
        var text = (method ?? string.Empty).Trim().ToLowerInvariant();
        return text.Contains("kart") || text.Contains("card") || text.Contains("pos");
    }

    public static bool IsTransfer(string? method)
    {
        var text = (method ?? string.Empty).Trim().ToLowerInvariant();
        return text.Contains("havale") || text.Contains("eft") || text.Contains("banka") || text.Contains("transfer");
    }
}
