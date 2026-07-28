namespace CourseIntellect.Domain.Services;

/// <summary>Ekstreye girecek tek hareket: ya borç ya alacak tarafı doludur.</summary>
public sealed record StatementMovement(
    DateTime DateUtc,
    string EntryType,
    string Description,
    string DocumentNo,
    decimal Debit,
    decimal Credit);

/// <summary>Yürüyen bakiyesi hesaplanmış ekstre satırı.</summary>
public sealed record StatementLedgerLine(
    DateTime DateUtc,
    string EntryType,
    string Description,
    string DocumentNo,
    decimal Debit,
    decimal Credit,
    decimal Balance);

/// <summary>Devir + dönem hareketleri + dönem sonu bakiyesi.</summary>
public sealed record StatementLedgerResult(
    decimal OpeningBalance,
    decimal DebitTotal,
    decimal CreditTotal,
    decimal ClosingBalance,
    IReadOnlyList<StatementLedgerLine> Lines);

/// <summary>
/// Cari hesap ekstresinin tek doğru kaynağı: hareketleri tarih sırasına dizer,
/// dönem başı devrini ayırır ve her satır için yürüyen bakiyeyi üretir.
/// Saf fonksiyon olduğu için veritabanı olmadan test edilebilir; borç/alacak
/// toplamları yalnızca <paramref name="fromUtc"/>–<paramref name="toUtcExclusive"/>
/// aralığındaki hareketleri kapsar.
/// </summary>
public static class StatementLedger
{
    public static StatementLedgerResult Build(
        IEnumerable<StatementMovement> movements,
        DateTime fromUtc,
        DateTime toUtcExclusive)
    {
        // Aynı güne düşen borç ve tahsilat için borç önce yazılır; aksi halde
        // "önce ödedi sonra borçlandı" gibi okunan negatif bakiye satırı çıkar.
        var ordered = movements
            .Where(item => item.Debit != 0 || item.Credit != 0)
            .OrderBy(item => item.DateUtc)
            .ThenByDescending(item => item.Debit)
            .ThenBy(item => item.DocumentNo)
            .ToList();

        var opening = ordered
            .Where(item => item.DateUtc < fromUtc)
            .Sum(item => item.Debit - item.Credit);

        var balance = opening;
        var lines = new List<StatementLedgerLine>();
        var debitTotal = 0m;
        var creditTotal = 0m;

        foreach (var item in ordered.Where(item => item.DateUtc >= fromUtc && item.DateUtc < toUtcExclusive))
        {
            balance += item.Debit - item.Credit;
            debitTotal += item.Debit;
            creditTotal += item.Credit;
            lines.Add(new StatementLedgerLine(
                item.DateUtc,
                item.EntryType,
                item.Description,
                item.DocumentNo,
                item.Debit,
                item.Credit,
                balance));
        }

        return new StatementLedgerResult(opening, debitTotal, creditTotal, balance, lines);
    }
}
