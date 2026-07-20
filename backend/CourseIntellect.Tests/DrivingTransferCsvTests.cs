using CourseIntellect.Domain.Services;
using System.Text;

namespace CourseIntellect.Tests;

public sealed class DrivingTransferCsvTests
{
    [Theory]
    [InlineData("=1+1", "\"'=1+1\"")]
    [InlineData("+SUM(A1:A2)", "\"'+SUM(A1:A2)\"")]
    [InlineData("-10", "\"'-10\"")]
    [InlineData("@command", "\"'@command\"")]
    public void Escape_NeutralizesSpreadsheetFormulas(string input, string expected)
        => Assert.Equal(expected, DrivingTransferCsv.Escape(input));

    [Fact]
    public void Escape_RemovesLineBreaksAndDoublesQuotes()
        => Assert.Equal("\"ad \"\"soyad\"\"\"", DrivingTransferCsv.Escape("ad\n\"soyad\""));

    [Fact]
    public void Build_EmitsUtf8BomAndSemicolonSeparatedRows()
    {
        var bytes = DrivingTransferCsv.Build(["Ad", "No"], [["Öğrenci", "42"]]);
        Assert.Equal([0xEF, 0xBB, 0xBF], bytes.Take(3).ToArray());
        Assert.Contains("\"Ad\";\"No\"", Encoding.UTF8.GetString(bytes));
    }
}
