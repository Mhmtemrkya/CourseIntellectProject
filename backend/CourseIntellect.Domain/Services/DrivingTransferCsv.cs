using System.Text;

namespace CourseIntellect.Domain.Services;

/// <summary>Türkçe Excel uyumlu CSV üretir; formül enjeksiyonu ve satır kırma saldırılarını etkisizleştirir.</summary>
public static class DrivingTransferCsv
{
    public static byte[] Build(IReadOnlyList<string> headers, IReadOnlyList<string[]> rows)
    {
        var builder = new StringBuilder();
        builder.AppendLine(string.Join(';', headers.Select(Escape)));
        foreach (var row in rows) builder.AppendLine(string.Join(';', row.Select(Escape)));
        var encoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: true);
        return encoding.GetPreamble().Concat(encoding.GetBytes(builder.ToString())).ToArray();
    }

    public static string Escape(string? value)
    {
        var text = (value ?? string.Empty).Replace("\r", " ").Replace("\n", " ");
        if (text.Length > 0 && "=+-@\t".Contains(text[0])) text = "'" + text;
        return $"\"{text.Replace("\"", "\"\"")}\"";
    }
}
