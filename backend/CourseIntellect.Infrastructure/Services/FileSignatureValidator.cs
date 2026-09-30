using System.Text;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Yüklenen dosyanın İÇERİĞİNİN uzantısıyla uyuştuğunu (sihirli bayt) denetler.
/// Uzantı beyaz listesi tek başına yetmez: ".pdf" adıyla rastgele/zararlı içerik
/// saklanabiliyordu. İmzası olmayan metin türlerinde ikili içerik reddedilir.
/// "bin" (nötr ikili) serbesttir; o tür her zaman indirilir ve sandbox CSP alır.
/// </summary>
public static class FileSignatureValidator
{
    /// <summary>Denetim için okunacak baş kısım.</summary>
    public const int HeaderLength = 1024;

    public static bool Matches(string extension, ReadOnlySpan<byte> header)
    {
        var ext = extension.TrimStart('.').ToLowerInvariant();
        return ext switch
        {
            "jpg" or "jpeg" => StartsWith(header, 0xFF, 0xD8, 0xFF),
            "png" => StartsWith(header, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A),
            "gif" => StartsWithAscii(header, "GIF87a") || StartsWithAscii(header, "GIF89a"),
            "webp" => StartsWithAscii(header, "RIFF") && AsciiAt(header, 8, "WEBP"),
            "bmp" => StartsWithAscii(header, "BM"),
            "ico" => StartsWith(header, 0x00, 0x00, 0x01, 0x00),
            "heic" or "heif" or "avif" or "mp4" or "m4v" or "m4a" => AsciiAt(header, 4, "ftyp"),
            "mov" => AsciiAt(header, 4, "ftyp") || AsciiAt(header, 4, "moov") || AsciiAt(header, 4, "wide")
                || AsciiAt(header, 4, "mdat") || AsciiAt(header, 4, "free") || AsciiAt(header, 4, "skip"),
            "webm" or "mkv" => StartsWith(header, 0x1A, 0x45, 0xDF, 0xA3),
            "avi" => StartsWithAscii(header, "RIFF") && AsciiAt(header, 8, "AVI "),
            "wav" => StartsWithAscii(header, "RIFF") && AsciiAt(header, 8, "WAVE"),
            "mp3" => StartsWithAscii(header, "ID3") || IsMpegAudioFrame(header),
            "aac" => StartsWithAscii(header, "ADIF") || IsAdtsFrame(header) || StartsWithAscii(header, "ID3"),
            "ogg" or "oga" => StartsWithAscii(header, "OggS"),
            "flac" => StartsWithAscii(header, "fLaC"),
            "pdf" => ContainsAscii(header, "%PDF-"),
            "rtf" => StartsWithAscii(SkipBom(header), "{\\rtf"),
            "zip" or "docx" or "xlsx" or "pptx" or "odt" or "ods" or "odp"
                => StartsWith(header, 0x50, 0x4B, 0x03, 0x04) || StartsWith(header, 0x50, 0x4B, 0x05, 0x06),
            "doc" or "xls" or "ppt" => StartsWith(header, 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1),
            "rar" => StartsWithAscii(header, "Rar!"),
            "7z" => StartsWith(header, 0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C),
            "txt" or "csv" or "tsv" => IsText(header),
            "svg" => IsText(header) && ContainsAscii(header, "<"),
            "bin" => true,
            _ => false,
        };
    }

    private static bool StartsWith(ReadOnlySpan<byte> header, params byte[] signature)
        => header.Length >= signature.Length && header[..signature.Length].SequenceEqual(signature);

    private static bool StartsWithAscii(ReadOnlySpan<byte> header, string text) => AsciiAt(header, 0, text);

    private static bool AsciiAt(ReadOnlySpan<byte> header, int offset, string text)
    {
        var bytes = Encoding.ASCII.GetBytes(text);
        return header.Length >= offset + bytes.Length && header.Slice(offset, bytes.Length).SequenceEqual(bytes);
    }

    private static bool ContainsAscii(ReadOnlySpan<byte> header, string text)
        => header.IndexOf(Encoding.ASCII.GetBytes(text)) >= 0;

    private static bool IsMpegAudioFrame(ReadOnlySpan<byte> header)
        => header.Length >= 2 && header[0] == 0xFF && (header[1] & 0xE0) == 0xE0;

    private static bool IsAdtsFrame(ReadOnlySpan<byte> header)
        => header.Length >= 2 && header[0] == 0xFF && (header[1] & 0xF6) == 0xF0;

    private static ReadOnlySpan<byte> SkipBom(ReadOnlySpan<byte> header)
        => StartsWith(header, 0xEF, 0xBB, 0xBF) ? header[3..] : header;

    /// <summary>Metin dosyası: UTF-16 BOM'u varsa kabul; yoksa NUL bayt içermemeli.</summary>
    private static bool IsText(ReadOnlySpan<byte> header)
    {
        if (StartsWith(header, 0xFF, 0xFE) || StartsWith(header, 0xFE, 0xFF)) return true;
        return header.IndexOf((byte)0) < 0;
    }
}
