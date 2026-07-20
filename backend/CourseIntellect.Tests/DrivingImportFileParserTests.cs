using System.IO.Compression;
using System.Text;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

public sealed class DrivingImportFileParserTests
{
    private readonly DrivingImportFileParser _parser = new();

    [Fact]
    public async Task ParseAsync_ReadsTurkishSemicolonCsvAndQuotedValues()
    {
        await using var input = new MemoryStream(Encoding.UTF8.GetBytes(
            "TC Kimlik No;Ad Soyad;Sonuç\n12345678901;\"Ayşe; Yılmaz\";Geçti"));

        var table = await _parser.ParseAsync(input, "adaylar.csv");

        Assert.Equal(3, table.Headers.Count);
        Assert.Single(table.Rows);
        Assert.Equal("Ayşe; Yılmaz", table.Rows[0]["Ad Soyad"]);
        Assert.Equal("Geçti", table.Rows[0]["Sonuç"]);
    }

    [Fact]
    public async Task ParseAsync_ReadsSharedStringsFromMacroFreeXlsx()
    {
        await using var input = BuildXlsx(includeMacro: false);

        var table = await _parser.ParseAsync(input, "sinav-sonuclari.xlsx");

        Assert.Equal(["TC Kimlik No", "Sonuç"], table.Headers);
        Assert.Single(table.Rows);
        Assert.Equal("12345678901", table.Rows[0]["TC Kimlik No"]);
        Assert.Equal("Geçti", table.Rows[0]["Sonuç"]);
    }

    [Fact]
    public async Task ParseAsync_RejectsMacroEnabledWorkbookContents()
    {
        await using var input = BuildXlsx(includeMacro: true);

        var error = await Assert.ThrowsAsync<InvalidDataException>(() => _parser.ParseAsync(input, "adaylar.xlsx"));

        Assert.Contains("Makro", error.Message);
    }

    [Fact]
    public async Task ParseAsync_RejectsUnsupportedExtension()
    {
        await using var input = new MemoryStream([1, 2, 3]);
        await Assert.ThrowsAsync<InvalidDataException>(() => _parser.ParseAsync(input, "adaylar.xls"));
    }

    private static MemoryStream BuildXlsx(bool includeMacro)
    {
        var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            Write(archive, "xl/sharedStrings.xml", """
                <?xml version="1.0" encoding="UTF-8"?>
                <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <si><t>TC Kimlik No</t></si><si><t>Sonuç</t></si><si><t>Geçti</t></si>
                </sst>
                """);
            Write(archive, "xl/worksheets/sheet1.xml", """
                <?xml version="1.0" encoding="UTF-8"?>
                <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
                  <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
                  <row r="2"><c r="A2"><v>12345678901</v></c><c r="B2" t="s"><v>2</v></c></row>
                </sheetData></worksheet>
                """);
            if (includeMacro) Write(archive, "xl/vbaProject.bin", "unsafe");
        }
        output.Position = 0;
        return output;
    }

    private static void Write(ZipArchive archive, string path, string content)
    {
        var entry = archive.CreateEntry(path);
        using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
        writer.Write(content);
    }
}
