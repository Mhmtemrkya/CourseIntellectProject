using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using CourseIntellect.Application.Interfaces;

namespace CourseIntellect.Infrastructure.Services;

public sealed class DrivingImportFileParser : IDrivingImportFileParser
{
    private const int MaxRows = 10_000;
    private const int MaxColumns = 100;
    private const long MaxExpandedBytes = 25L * 1024 * 1024;

    public async Task<DrivingImportTable> ParseAsync(Stream stream, string fileName, CancellationToken cancellationToken = default)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        if (extension == ".csv") return await ParseCsvAsync(stream, cancellationToken);
        if (extension == ".xlsx") return ParseXlsx(stream);
        throw new InvalidDataException("Yalnızca .csv ve makrosuz .xlsx dosyaları desteklenir.");
    }

    private static async Task<DrivingImportTable> ParseCsvAsync(Stream stream, CancellationToken ct)
    {
        using var reader = new StreamReader(stream, new UTF8Encoding(false, true), detectEncodingFromByteOrderMarks: true, leaveOpen: true);
        var lines = new List<string>();
        while (await reader.ReadLineAsync(ct) is { } line)
        {
            if (lines.Count > MaxRows) throw new InvalidDataException($"Dosya {MaxRows} satır sınırını aşıyor.");
            if (line.Length > 32_000) throw new InvalidDataException("CSV satırı izin verilen uzunluğu aşıyor.");
            if (line.Length > 0) lines.Add(line);
        }
        if (lines.Count < 2) throw new InvalidDataException("Dosyada başlık ve en az bir veri satırı bulunmalıdır.");
        var delimiter = lines[0].Count(x => x == ';') >= lines[0].Count(x => x == ',') ? ';' : ',';
        var parsed = lines.Select(x => ParseCsvLine(x, delimiter)).ToList();
        return BuildTable(parsed);
    }

    private static List<string> ParseCsvLine(string line, char delimiter)
    {
        var result = new List<string>(); var current = new StringBuilder(); var quoted = false;
        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (ch == '"') { if (quoted && i + 1 < line.Length && line[i + 1] == '"') { current.Append('"'); i++; } else quoted = !quoted; }
            else if (ch == delimiter && !quoted) { result.Add(current.ToString().Trim()); current.Clear(); }
            else current.Append(ch);
        }
        if (quoted) throw new InvalidDataException("CSV dosyasında kapatılmamış tırnak bulundu.");
        result.Add(current.ToString().Trim());
        if (result.Count > MaxColumns) throw new InvalidDataException($"Dosya {MaxColumns} sütun sınırını aşıyor.");
        return result;
    }

    private static DrivingImportTable ParseXlsx(Stream stream)
    {
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);
        if (archive.Entries.Any(x => x.FullName.EndsWith("vbaProject.bin", StringComparison.OrdinalIgnoreCase)))
            throw new InvalidDataException("Makro içeren Excel dosyaları güvenlik nedeniyle kabul edilmez.");
        if (archive.Entries.Sum(x => x.Length) > MaxExpandedBytes) throw new InvalidDataException("Excel dosyasının açılmış boyutu güvenli sınırı aşıyor.");
        var shared = ReadSharedStrings(archive.GetEntry("xl/sharedStrings.xml"));
        var sheet = archive.GetEntry("xl/worksheets/sheet1.xml") ?? throw new InvalidDataException("Excel dosyasının ilk çalışma sayfası bulunamadı.");
        var rows = new List<List<string>>();
        using var input = sheet.Open();
        using var reader = XmlReader.Create(input, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = MaxExpandedBytes });
        var document = XDocument.Load(reader, LoadOptions.None);
        foreach (var rowElement in document.Descendants().Where(x => x.Name.LocalName == "row"))
        {
            if (rows.Count >= MaxRows + 1) throw new InvalidDataException($"Excel {MaxRows} satır sınırını aşıyor.");
            var row = new List<string>();
            foreach (var cell in rowElement.Elements().Where(x => x.Name.LocalName == "c"))
            {
                var cellType = cell.Attribute("t")?.Value ?? "";
                var cellIndex = ColumnIndex(cell.Attribute("r")?.Value);
                if (cellIndex >= MaxColumns) throw new InvalidDataException($"Excel {MaxColumns} sütun sınırını aşıyor.");
                while (row.Count <= cellIndex) row.Add(string.Empty);
                var value = cell.Descendants().FirstOrDefault(x => x.Name.LocalName is "v" or "t")?.Value ?? string.Empty;
                row[cellIndex] = cellType == "s" && int.TryParse(value, out var index) && index >= 0 && index < shared.Count ? shared[index] : value;
            }
            rows.Add(row);
        }
        return BuildTable(rows);
    }

    private static List<string> ReadSharedStrings(ZipArchiveEntry? entry)
    {
        var result = new List<string>(); if (entry is null) return result;
        using var input = entry.Open(); using var reader = XmlReader.Create(input, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = MaxExpandedBytes });
        var document = XDocument.Load(reader, LoadOptions.None);
        result.AddRange(document.Descendants().Where(x => x.Name.LocalName == "si")
            .Select(item => string.Concat(item.Descendants().Where(x => x.Name.LocalName == "t").Select(x => x.Value))));
        return result;
    }

    private static int ColumnIndex(string? reference)
    {
        var value = 0; foreach (var ch in reference?.TakeWhile(char.IsLetter) ?? []) value = value * 26 + (char.ToUpperInvariant(ch) - 'A' + 1);
        return Math.Max(0, value - 1);
    }

    private static DrivingImportTable BuildTable(IReadOnlyList<List<string>> raw)
    {
        if (raw.Count < 2) throw new InvalidDataException("Dosyada başlık ve en az bir veri satırı bulunmalıdır.");
        var headers = raw[0].Select((x, i) => string.IsNullOrWhiteSpace(x) ? $"Sütun{i + 1}" : x.Trim()).ToList();
        if (headers.Select(Normalize).Distinct().Count() != headers.Count) throw new InvalidDataException("Dosyada yinelenen sütun başlığı bulunuyor.");
        var rows = raw.Skip(1).Where(x => x.Any(v => !string.IsNullOrWhiteSpace(v))).Select(values =>
        {
            var item = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (var i = 0; i < headers.Count; i++) item[headers[i]] = i < values.Count ? values[i].Trim() : string.Empty;
            return (IReadOnlyDictionary<string, string>)item;
        }).ToList();
        if (rows.Count == 0) throw new InvalidDataException("Dosyada veri satırı bulunamadı.");
        return new(headers, rows);
    }

    private static string Normalize(string value) => new(value.Normalize(NormalizationForm.FormD).Where(x => CharUnicodeInfo.GetUnicodeCategory(x) != UnicodeCategory.NonSpacingMark && char.IsLetterOrDigit(x)).Select(char.ToLowerInvariant).ToArray());
}
