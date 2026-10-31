namespace CourseIntellect.Application.Interfaces;

public interface IFinanceJournalExportService
{
    /// <summary>Dönemdeki tüm para hareketlerinin yevmiye biçiminde CSV'si (UTF-8 BOM, ";" ayraç).</summary>
    Task<byte[]> ExportCsvAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken cancellationToken = default);
}
