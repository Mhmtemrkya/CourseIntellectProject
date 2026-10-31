using System.Text;
using CourseIntellect.Application.DTOs.OpticalExams;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>Optik satırından okunan ham alanlar (kolonlar şablondan).</summary>
public sealed record OpticalRawRow(int Line, string StudentNo, string Name, string ClassName, string Booklet, IReadOnlyDictionary<string, string> Marks);

public sealed record OpticalQuestionResult(string Subject, int QuestionNo, string Topic, string Outcome, string Marked);

public sealed record OpticalScoredRow(
    string Booklet,
    IReadOnlyList<OpticalQuestionResult> Questions,
    IReadOnlyList<OpticalSubjectScoreDto> Scores,
    IReadOnlyList<string> Warnings);

/// <summary>
/// Sabit genişlikli optik okuyucu çıktısını okur ve puanlar. Saf (veritabanı yok) — test edilebilir.
/// Kurallar: boşluk = boş; A-E = işaret; * = çoklu işaret (ayara göre yanlış ya da boş); tanınmayan
/// karakter uyarı verir ve boş sayılır. Cevap anahtarında X/* iptal edilmiş sorudur.
/// </summary>
public static class OpticalParser
{
    public const string Windows1254 = "windows-1254";
    public const string Utf8 = "utf-8";
    public const string Auto = "auto";

    static OpticalParser()
    {
        // Türkçe Windows (1254) gibi kod sayfaları .NET'te ayrıca kaydedilir.
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
    }

    /// <summary>
    /// Metni çözer. auto: geçerli UTF-8 ise UTF-8, değilse Türkçe Windows (çoğu optik yazılımın çıktısı).
    /// Kolonlar ancak doğru çözümden sonra kesilir: 1254 dosyası UTF-8 okunursa harfler ve kolonlar kayar.
    /// </summary>
    public static (string Text, string Encoding) Decode(byte[] bytes, string? encoding)
    {
        var requested = (encoding ?? Auto).Trim().ToLowerInvariant();
        var hasBom = bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF;
        if (requested == Utf8 || (requested == Auto && (hasBom || IsValidUtf8(bytes))))
        {
            var text = new UTF8Encoding(false).GetString(bytes);
            return (text.TrimStart('﻿'), Utf8);
        }
        return (Encoding.GetEncoding(1254).GetString(bytes), Windows1254);
    }

    private static bool IsValidUtf8(byte[] bytes)
    {
        try
        {
            new UTF8Encoding(false, throwOnInvalidBytes: true).GetString(bytes);
            return true;
        }
        catch (DecoderFallbackException)
        {
            return false;
        }
    }

    public static IReadOnlyList<(int Line, string Text)> Lines(string text) => text
        .Replace("\r\n", "\n").Replace('\r', '\n')
        .Split('\n')
        .Select((line, index) => (Line: index + 1, Text: line.TrimEnd('\u001A')))
        .Where(item => item.Text.Trim().Length > 0)
        .ToList();

    /// <summary>1'den başlayan kolon; satır kısaysa eksik kısım boşluk sayılır.</summary>
    public static string Slice(string line, int start, int length)
    {
        if (start <= 0 || length <= 0) return string.Empty;
        var from = start - 1;
        if (from >= line.Length) return new string(' ', length);
        var available = Math.Min(length, line.Length - from);
        var part = line.Substring(from, available);
        return available < length ? part + new string(' ', length - available) : part;
    }

    public static OpticalRawRow ParseRow(int lineNo, string line, OpticalTemplateDto template)
    {
        var marks = template.Subjects.ToDictionary(
            subject => subject.Name,
            subject => Slice(line, subject.Start, subject.Count));
        return new OpticalRawRow(
            lineNo,
            Slice(line, template.StudentNoStart, template.StudentNoLength).Trim(),
            CollapseSpaces(Slice(line, template.NameStart, template.NameLength)),
            Slice(line, template.ClassStart, template.ClassLength).Trim(),
            Slice(line, template.BookletStart, template.BookletLength).Trim().ToUpperInvariant(),
            marks);
    }

    private static string CollapseSpaces(string value) => string.Join(' ', value.Split(' ', StringSplitOptions.RemoveEmptyEntries));

    public static OpticalScoredRow Score(
        OpticalRawRow row,
        IReadOnlyList<OpticalAnswerKeyDto> keys,
        int wrongPenalty,
        bool multiMarkAsWrong,
        string cancelledMode)
    {
        var warnings = new List<string>();
        var key = keys.FirstOrDefault(item => string.Equals(item.Booklet, row.Booklet, StringComparison.OrdinalIgnoreCase));
        if (key is null)
        {
            key = keys[0];
            warnings.Add(row.Booklet.Length == 0
                ? $"Kitapçık türü okunamadı; {key.Booklet} kitapçığı kabul edildi."
                : $"Tanımsız kitapçık '{row.Booklet}'; {key.Booklet} kitapçığı kabul edildi.");
        }

        var questions = new List<OpticalQuestionResult>();
        var scores = new List<OpticalSubjectScoreDto>();
        foreach (var subjectKey in key.Subjects)
        {
            if (!row.Marks.TryGetValue(subjectKey.Subject, out var marks)) continue;
            int correct = 0, wrong = 0, blank = 0;
            for (var index = 0; index < subjectKey.Answers.Length; index++)
            {
                var answer = char.ToUpperInvariant(subjectKey.Answers[index]);
                var mark = index < marks.Length ? marks[index] : ' ';
                var normalized = char.ToUpperInvariant(mark);
                var topic = index < subjectKey.Topics.Count ? subjectKey.Topics[index].Trim() : string.Empty;

                string outcome;
                if (answer is 'X' or '*')
                {
                    if (cancelledMode != "correct") continue;
                    outcome = "Correct";
                }
                else if (normalized == ' ')
                {
                    outcome = "Blank";
                }
                else if (normalized == '*')
                {
                    outcome = multiMarkAsWrong ? "Wrong" : "Blank";
                }
                else if (normalized is >= 'A' and <= 'E')
                {
                    outcome = normalized == answer ? "Correct" : "Wrong";
                }
                else
                {
                    warnings.Add($"{subjectKey.Subject} {index + 1}. soruda tanınmayan işaret '{mark}' (boş sayıldı).");
                    outcome = "Blank";
                }

                switch (outcome)
                {
                    case "Correct": correct++; break;
                    case "Wrong": wrong++; break;
                    default: blank++; break;
                }
                questions.Add(new OpticalQuestionResult(subjectKey.Subject, index + 1, topic, outcome, mark == ' ' ? string.Empty : mark.ToString()));
            }
            var net = wrongPenalty > 0 ? correct - (decimal)wrong / wrongPenalty : correct;
            scores.Add(new OpticalSubjectScoreDto(subjectKey.Subject, correct, wrong, blank, Math.Round(net, 2)));
        }
        return new OpticalScoredRow(key.Booklet, questions, scores, warnings);
    }

    /// <summary>Okul numarası karşılaştırması: boşluk ve baştaki sıfırlar yok sayılır.</summary>
    public static string NormalizeStudentNo(string? value)
    {
        var trimmed = new string((value ?? string.Empty).Where(ch => !char.IsWhiteSpace(ch)).ToArray()).TrimStart('0');
        return trimmed;
    }
}
