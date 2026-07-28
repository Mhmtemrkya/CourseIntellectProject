using CourseIntellect.Application.DTOs.StudentFinance;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

public sealed class StudentStatementTests
{
    private static DateTime Utc(int year, int month, int day) => new(year, month, day, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Ledger_RunsBalanceForwardInDateOrder()
    {
        var movements = new[]
        {
            new StatementMovement(Utc(2026, 2, 10), "Fatura", "Şubat Taksiti", string.Empty, 4500, 0),
            new StatementMovement(Utc(2026, 2, 10), "Tahsilat", "Şubat tahsilatı", "MKB-1", 0, 4500),
            new StatementMovement(Utc(2026, 3, 10), "Fatura", "Mart Taksiti", string.Empty, 4500, 0),
        };

        var result = StatementLedger.Build(movements, Utc(2026, 1, 1), Utc(2026, 4, 1));

        Assert.Equal(0, result.OpeningBalance);
        Assert.Equal(9000, result.DebitTotal);
        Assert.Equal(4500, result.CreditTotal);
        Assert.Equal(4500, result.ClosingBalance);
        // Aynı gün: önce borç, sonra tahsilat — bakiye sırayla 4500 → 0 → 4500.
        Assert.Equal([4500m, 0m, 4500m], result.Lines.Select(line => line.Balance));
    }

    [Fact]
    public void Ledger_MovesEarlierMovementsIntoOpeningBalance()
    {
        var movements = new[]
        {
            new StatementMovement(Utc(2025, 12, 1), "Fatura", "Eski borç", string.Empty, 1000, 0),
            new StatementMovement(Utc(2026, 1, 15), "Tahsilat", "Ocak tahsilatı", "MKB-9", 0, 400),
        };

        var result = StatementLedger.Build(movements, Utc(2026, 1, 1), Utc(2026, 2, 1));

        Assert.Equal(1000, result.OpeningBalance);
        Assert.Equal(0, result.DebitTotal);
        Assert.Equal(400, result.CreditTotal);
        Assert.Equal(600, result.ClosingBalance);
        Assert.Single(result.Lines);
    }

    [Fact]
    public void Ledger_ExcludesMovementsAfterWindow()
    {
        var movements = new[]
        {
            new StatementMovement(Utc(2026, 1, 5), "Fatura", "Ocak Taksiti", string.Empty, 500, 0),
            new StatementMovement(Utc(2026, 5, 5), "Taksit (Vade)", "Mayıs Taksiti", string.Empty, 500, 0),
        };

        var result = StatementLedger.Build(movements, Utc(2026, 1, 1), Utc(2026, 2, 1));

        Assert.Equal(500, result.ClosingBalance);
        Assert.Single(result.Lines);
    }

    [Theory]
    [InlineData(12450, "OnikiBinDörtYüzElli TL")]
    [InlineData(0, "Sıfır TL")]
    [InlineData(1000, "Bin TL")]
    [InlineData(2000, "İkiBin TL")]
    [InlineData(105, "YüzBeş TL")]
    [InlineData(1_250_000, "BirMilyonİkiYüzElliBin TL")]
    public void MoneyWords_WritesTurkishAmount(decimal amount, string expected)
    {
        Assert.Equal(expected, TurkishMoneyWords.Format(amount));
    }

    [Fact]
    public void MoneyWords_WritesKurusSeparately()
    {
        // Onlar ve birler tek kelime yazılır: "otuz dört" → "Otuzdört".
        Assert.Equal("BinİkiYüzOtuzdört TL Ellialtı Kr", TurkishMoneyWords.Format(1234.56m));
    }

    [Fact]
    public void MoneyWords_MarksNegativeBalance()
    {
        Assert.StartsWith("Eksi ", TurkishMoneyWords.Format(-250m));
    }

    [Fact]
    public void Pdf_RendersStatementWithLinesAndTotals()
    {
        var service = new StudentStatementPdfService();
        var bytes = service.Generate(new StudentStatementPdfModel(SampleStatement(), "SchoolAsist", null, "#0F4C81"));

        Assert.True(bytes.Length > 5_000);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));

        var previewPath = Environment.GetEnvironmentVariable("STATEMENT_PREVIEW_PATH");
        if (!string.IsNullOrWhiteSpace(previewPath)) File.WriteAllBytes(previewPath, bytes);
    }

    [Fact]
    public void Pdf_RendersWhenOptionalFieldsAreEmpty()
    {
        var service = new StudentStatementPdfService();
        var empty = SampleStatement() with
        {
            InstitutionAddress = string.Empty,
            InstitutionLocation = string.Empty,
            InstitutionPhone = string.Empty,
            InstitutionEmail = string.Empty,
            InstitutionWebsite = string.Empty,
            InstitutionTaxInfo = string.Empty,
            StudentPhone = string.Empty,
            StudentAddress = string.Empty,
            ParentName = string.Empty,
            ClassName = string.Empty,
            Lines = [],
        };

        var bytes = service.Generate(new StudentStatementPdfModel(empty, "SchoolAsist", null, "not-a-color"));

        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
    }

    private static StudentStatementDto SampleStatement() => new(
        "ERZURUM KOLEJİ",
        "Ömer Nasuhi Bilmen Mah. No:45",
        "Yakutiye / ERZURUM",
        "(0442) 123 45 67",
        "info@erzurumkoleji.k12.tr",
        "www.erzurumkoleji.k12.tr",
        "Vergi D.: Yakutiye • VKN: 1234567890",
        "CR-000123",
        "Ahmet Arslan",
        "0555 123 45 67",
        "Yakutiye / ERZURUM",
        "Ahmet Arslan",
        "9-A",
        "TL",
        Utc(2026, 1, 1),
        Utc(2026, 5, 31),
        Utc(2026, 5, 15),
        0,
        22_500,
        10_050,
        12_450,
        TurkishMoneyWords.Format(12_450),
        [
            new StudentStatementLineDto(Utc(2026, 2, 10), "Fatura", "Şubat Ayı Okul Ücreti", string.Empty, 4500, 0, 4500),
            new StudentStatementLineDto(Utc(2026, 2, 10), "Tahsilat", "Şubat Ayı Okul Ücreti", "MKB-2026-0001", 0, 4500, 0),
            new StudentStatementLineDto(Utc(2026, 3, 10), "Fatura", "Mart Ayı Okul Ücreti", string.Empty, 4500, 0, 4500),
        ],
        "Bu belge bilgilendirme amaçlıdır.");
}
