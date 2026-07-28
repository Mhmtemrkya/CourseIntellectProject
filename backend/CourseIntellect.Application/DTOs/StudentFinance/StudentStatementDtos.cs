namespace CourseIntellect.Application.DTOs.StudentFinance;

/// <summary>Ekstre satırı: borç (fatura/taksit/ek ücret) veya alacak (tahsilat).</summary>
public sealed record StudentStatementLineDto(
    DateTime DateUtc,
    string EntryType,
    string Description,
    string DocumentNo,
    decimal Debit,
    decimal Credit,
    decimal Balance);

/// <summary>
/// Cari hesap ekstresinin tamamı: kurum künyesi, cari kartı, tarih aralığı,
/// tarih sıralı hareketler ve dönem sonu bakiyesi. Belgeye basılan her değer
/// sunucuda üretilir; istemci yalnızca biçimlendirir.
/// </summary>
public sealed record StudentStatementDto(
    string InstitutionName,
    string InstitutionAddress,
    string InstitutionLocation,
    string InstitutionPhone,
    string InstitutionEmail,
    string InstitutionWebsite,
    /// <summary>"Vergi D.: … • VKN: …" satırı; künyede yoksa boş.</summary>
    string InstitutionTaxInfo,
    string AccountCode,
    string StudentName,
    string StudentPhone,
    string StudentAddress,
    string ParentName,
    string ClassName,
    string Currency,
    DateTime FromUtc,
    DateTime ToUtc,
    DateTime GeneratedAtUtc,
    decimal OpeningBalance,
    decimal DebitTotal,
    decimal CreditTotal,
    decimal ClosingBalance,
    string ClosingBalanceInWords,
    IReadOnlyList<StudentStatementLineDto> Lines,
    string Note);
