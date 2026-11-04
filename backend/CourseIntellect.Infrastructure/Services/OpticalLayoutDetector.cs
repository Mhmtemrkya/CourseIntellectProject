using System.Text.RegularExpressions;
using CourseIntellect.Application.DTOs.OpticalExams;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>Yerel modele gönderilen aday bölüm: yalnız konum, tür ve maskeli şekil (ham veri yok).</summary>
public sealed record OpticalLayoutSegment(string Id, string Kind, int Start, int Length, double Fill, int DistinctValues, IReadOnlyList<string> Shapes);

public sealed record OpticalLayoutDetection(OpticalTemplateSuggestionDto Suggestion, IReadOnlyList<OpticalLayoutSegment> Segments, bool Ambiguous);

/// <summary>
/// Sabit genişlikli optik çıktısından şablon önerisi — tamamen kurallı ve saf (veritabanı, ağ yok).
/// Dosya önce OpticalParser ile çözülür; konumlar karakter üzerinden hesaplanır (UTF-8 çok baytlı
/// harfler kaymaz). Satırlar trim edilmez. Dosyanın farklı bölümlerinden örnek satırlarla sütun profili
/// çıkarılır, sonra önerilen alanlar dosyanın tamamında doğrulanır ve güven bu ölçümlerden gelir.
/// Bulunamayan alan uydurulmaz; ders adı, soru dağılımı ve cevap anahtarı önerilmez.
/// </summary>
public static partial class OpticalLayoutDetector
{
    public const int MaxSampledLines = 400;
    public const int MaxLineLength = 2000;
    private const int MaxFlaggedLines = 25;

    private enum Cls { Space, Digit, Answer, Star, Letter, Other }

    private static Cls Classify(char ch) => ch switch
    {
        ' ' => Cls.Space,
        >= '0' and <= '9' => Cls.Digit,
        >= 'A' and <= 'E' => Cls.Answer,
        '*' => Cls.Star,
        _ when char.IsLetter(ch) => Cls.Letter,
        _ => Cls.Other,
    };

    private static char At(string line, int column) => column < line.Length ? line[column] : ' ';

    private sealed class Column
    {
        public int Space, Digit, Answer, Star, Letter, Other;
        public int NonSpace => Digit + Answer + Star + Letter + Other;
        public readonly Dictionary<char, int> Values = [];
    }

    private sealed record Range(int Start, int Length)
    {
        public int End => Start + Length - 1;
        public bool Contains(int column) => column >= Start && column <= End;
    }

    public static OpticalLayoutDetection Detect(byte[] bytes, string? encoding)
    {
        var (text, usedEncoding) = OpticalParser.Decode(bytes, string.IsNullOrWhiteSpace(encoding) ? OpticalParser.Auto : encoding);
        var all = OpticalParser.Lines(text);
        if (all.Count == 0) return Unsupported(usedEncoding, "empty", 0, "Dosyada dolu satır bulunamadı. Şablonu elle girin.");

        var delimited = DetectDelimiter(all);
        if (delimited is { } delimiter)
        {
            return Unsupported(usedEncoding, "delimited", all.Count,
                $"Dosyadaki bilgiler {delimiter} ile ayrılmış görünüyor (CSV benzeri). Mevcut optik okuyucu yalnız sabit genişlikli dosyaları "
                + "okur: her bilgi her satırda aynı karakter aralığında olmalı. Cihazdan sabit genişlikli TXT/DAT çıktısı alın ya da şablonu elle girin.");
        }
        if (all.Max(item => item.Text.Length) > MaxLineLength)
        {
            return Unsupported(usedEncoding, "too-wide", all.Count, $"Satırlar {MaxLineLength} karakterden uzun; bu bir optik okuyucu çıktısına benzemiyor. Şablonu elle girin.");
        }

        var lengths = all.Select(item => item.Text.Length).OrderBy(x => x).ToList();
        var typical = lengths[lengths.Count / 2];
        var flagged = new Dictionary<int, OpticalFlaggedLineDto>();
        foreach (var (line, value) in all)
        {
            if (HeaderRegex().IsMatch(RuleBasedAssistantIntentResolver.Fold(value)))
                flagged[line] = new(line, "header", "Başlık ya da açıklama satırı olabilir (alan adı gibi sözcükler içeriyor). Öğrenci satırı olarak sayılmadı; doğrulayın.");
            else if (value.Length < typical * 0.6 || value.Length > typical * 1.4)
                flagged[line] = new(line, "length", $"Satır {value.Length} karakter; satırların çoğu {typical} karakter. Farklı bir kayıt türü olabilir; doğrulayın.");
        }

        // Dosyanın baştan sona farklı bölümlerinden örnek: büyük dosyada arayüzü/sunucuyu yormamak için sınırlı.
        var candidates = all.Where(item => !flagged.ContainsKey(item.Line)).ToList();
        var sample = Spread(candidates, MaxSampledLines);

        var layout = Analyze(sample);
        // Ad ve numara boş, cevaplar eksiksiz → cevap anahtarı satırı olabilir; çıkarıp yeniden profil çıkarılır.
        var keyLines = AnswerKeyLines(candidates, layout);
        if (keyLines.Count > 0)
        {
            foreach (var line in keyLines)
                flagged[line] = new(line, "answer-key", "Ad ve numara boş, cevaplar eksiksiz: cevap anahtarı satırı olabilir. Öğrenci satırı olarak sayılmadı; doğrulayın.");
            candidates = candidates.Where(item => !flagged.ContainsKey(item.Line)).ToList();
            sample = Spread(candidates, MaxSampledLines);
            layout = Analyze(sample);
        }
        foreach (var line in OddLines(candidates, layout))
            flagged.TryAdd(line, new(line, "other", "Bu satırın düzeni diğer satırlardan belirgin biçimde farklı; farklı bir kayıt türü olabilir. Doğrulayın."));

        return Build(usedEncoding, all.Count, sample.Count, typical, lengths[0], lengths[^1], candidates.Where(item => !flagged.ContainsKey(item.Line)).ToList(), layout, flagged);
    }

    // ─── Sütun profili ve alanlar ────────────────────────────────────────────

    private sealed class Layout
    {
        public int Width;
        public int Lines;
        public Column[] Columns = [];
        public Range? Name;
        public Range? ClassName;
        public Range? Booklet;
        public string BookletReason = string.Empty;
        public string BookletConfidence = "none";
        public List<Range> Answers = [];
        public List<Range> Numbers = [];
        public List<Range> Combined = [];
        public Range? StudentNo;
        public List<Range> Unknown = [];
    }

    private static Layout Analyze(IReadOnlyList<(int Line, string Text)> sample)
    {
        var layout = new Layout { Lines = sample.Count, Width = sample.Count == 0 ? 0 : sample.Max(item => item.Text.Length) };
        layout.Columns = Enumerable.Range(0, layout.Width).Select(_ => new Column()).ToArray();
        foreach (var (_, text) in sample)
        {
            for (var c = 0; c < layout.Width; c++)
            {
                var ch = At(text, c);
                var column = layout.Columns[c];
                switch (Classify(ch))
                {
                    case Cls.Space: column.Space++; break;
                    case Cls.Digit: column.Digit++; break;
                    case Cls.Answer: column.Answer++; break;
                    case Cls.Star: column.Star++; break;
                    case Cls.Letter: column.Letter++; break;
                    default: column.Other++; break;
                }
                if (ch != ' ') column.Values[ch] = column.Values.GetValueOrDefault(ch) + 1;
            }
        }
        if (layout.Lines == 0) return layout;

        // Sınıf önce: "10-A" harfi bir sonraki kitapçık/cevap sütunuyla bitişik olabilir; rakamla başladığı için cevap sanılmaz.
        FindClass(layout, sample);
        FindAnswerBlocks(layout, sample);
        FindNumbers(layout, sample);
        FindName(layout);
        FindUnknown(layout);
        return layout;
    }

    private static bool Assigned(Layout layout, int c) =>
        layout.Answers.Any(r => r.Contains(c)) || (layout.Booklet?.Contains(c) ?? false) || (layout.ClassName?.Contains(c) ?? false)
        || layout.Numbers.Any(r => r.Contains(c)) || (layout.Name?.Contains(c) ?? false);

    /// <summary>Cevap sütunu: yalnız A–E, boşluk ve çoklu işaret (*). Harf/rakam görülürse cevap değildir.</summary>
    private static bool AnswerValid(Column column) => column.NonSpace > 0 && column.Digit + column.Letter + column.Other == 0;

    private static void FindAnswerBlocks(Layout layout, IReadOnlyList<(int Line, string Text)> sample)
    {
        var n = layout.Lines;
        var c = 0;
        while (c < layout.Width)
        {
            if (!AnswerValid(layout.Columns[c]) || Assigned(layout, c)) { c++; continue; }
            var start = c;
            var end = c;
            var gap = 0;
            for (var k = c + 1; k < layout.Width; k++)
            {
                var column = layout.Columns[k];
                if (Assigned(layout, k)) break;
                if (AnswerValid(column)) { end = k; gap = 0; continue; }
                // Tek boş sütun (herkesin boş bıraktığı soru) bloğu bölmez; iki ve fazlası böler.
                if (column.NonSpace == 0 && ++gap < 2) continue;
                break;
            }
            var length = end - start + 1;
            var dense = Enumerable.Range(start, length).Count(k => layout.Columns[k].NonSpace >= n * 0.5);
            if (length >= 5 && dense >= length * 0.6) layout.Answers.Add(new Range(start, length));
            c = end + 1;
        }

        // Kitapçık: bloğun ilk sütunu yalnız A–D ise, boş ve çoklu işaret yoksa, seyrek değer yoksa aday.
        for (var i = 0; i < layout.Answers.Count; i++)
        {
            var block = layout.Answers[i];
            var first = layout.Columns[block.Start];
            if (!LooksLikeBooklet(first, n)) continue;
            var lift = Lift(sample, block.Start, block.Start + 1, Math.Min(block.End, block.Start + 60));
            var neighbors = Enumerable.Range(block.Start + 1, Math.Min(5, block.Length - 1))
                .Select(j => Lift(sample, j, block.Start + 1, Math.Min(block.End, block.Start + 60))).DefaultIfEmpty(0).Max();
            var distinct = first.Values.Count;
            if (distinct == 1)
            {
                layout.BookletConfidence = n >= 10 ? "medium" : "low";
                layout.BookletReason = $"Cevaplardan hemen önceki sütun bütün satırlarda aynı harf ({first.Values.Keys.First()}); tek kitapçık türü olabilir. Bunun bir cevap sütunu olmadığını doğrulayın.";
            }
            else
            {
                var clear = n >= 20 && lift >= 0.15 && lift >= neighbors * 1.3;
                layout.BookletConfidence = clear ? "high" : "medium";
                layout.BookletReason = clear
                    ? $"{distinct} farklı tür ({string.Join(", ", first.Values.Keys.OrderBy(x => x))}), boş ya da çoklu işaret yok, E yok; bu sütuna göre gruplanınca cevaplar belirgin biçimde benzeşiyor."
                    : $"{distinct} farklı tür ({string.Join(", ", first.Values.Keys.OrderBy(x => x))}), boş ya da çoklu işaret yok, E yok; ancak cevap sütunlarından yalnız konumu ve değerleriyle ayrılıyor. Doğrulayın.";
            }
            layout.Booklet = new Range(block.Start, 1);
            layout.Answers[i] = new Range(block.Start + 1, block.Length - 1);
            break;
        }
    }

    private static bool LooksLikeBooklet(Column column, int lines)
    {
        if (column.Space > 0 || column.Star > 0 || column.NonSpace != lines) return false;
        if (column.Values.Keys.Any(ch => ch is not ('A' or 'B' or 'C' or 'D'))) return false;
        return column.Values.Count == 1 ? lines >= 3 : column.Values.Values.All(count => count >= Math.Max(2, lines * 0.05));
    }

    /// <summary>Satırlar aday sütuna göre gruplanınca cevap sütunlarındaki çoğunluk payı ne kadar artıyor.</summary>
    private static double Lift(IReadOnlyList<(int Line, string Text)> sample, int candidate, int from, int to)
    {
        var columns = Enumerable.Range(from, Math.Max(0, to - from + 1)).Where(c => c != candidate).ToList();
        if (columns.Count == 0) return 0;
        double Agreement(IEnumerable<string> rows)
        {
            var list = rows.ToList();
            var total = 0.0;
            foreach (var c in columns)
            {
                var values = list.Select(row => At(row, c)).Where(ch => ch != ' ').ToList();
                if (values.Count > 0) total += values.GroupBy(ch => ch).Max(g => g.Count()) / (double)values.Count;
            }
            return total / columns.Count;
        }
        var texts = sample.Select(item => item.Text).ToList();
        var groups = texts.GroupBy(row => At(row, candidate)).Where(g => g.Count() >= 3).ToList();
        if (groups.Count < 2) return 0;
        var conditional = groups.Sum(g => Agreement(g) * g.Count()) / groups.Sum(g => g.Count());
        return conditional - Agreement(texts);
    }

    [GeneratedRegex(@"^\d{1,2}\s?[-/.]?\s?[A-ZÇĞİÖŞÜ]{1,2}$")]
    private static partial Regex ClassRegex();

    /// <summary>Sınıf: "10-A", "8B", "12/F" gibi kısa rakam+harf. Bulunamazsa alan önerilmez.</summary>
    private static void FindClass(Layout layout, IReadOnlyList<(int Line, string Text)> sample)
    {
        var n = layout.Lines;
        (Range Range, double Score)? best = null;
        for (var s = 0; s < layout.Width; s++)
        {
            if (Assigned(layout, s)) continue;
            var leftOk = s == 0 || layout.Columns[s - 1].Digit + layout.Columns[s - 1].Letter + layout.Columns[s - 1].Answer <= n * 0.1;
            if (!leftOk || layout.Columns[s].Digit < n * 0.5) continue;
            // En dar uyan genişlik: sağdaki sütun kitapçık/cevap harfi olabilir, onu yutmamak için.
            for (var w = 2; w <= 6; w++)
            {
                if (s + w > layout.Width || Enumerable.Range(s, w).Any(c => Assigned(layout, c))) continue;
                var right = s + w;
                var rightOk = right >= layout.Width || layout.Columns[right].Digit <= n * 0.1;
                if (!rightOk) continue;
                var values = sample.Select(item => Slice(item.Text, s, w).Trim()).Where(v => v.Length > 0).ToList();
                if (values.Count < n * 0.8) continue;
                var matched = values.Count(v => ClassRegex().IsMatch(v)) / (double)values.Count;
                if (matched < 0.9) continue;
                if (best is null || matched > best.Value.Score) best = (new Range(s, w), matched);
                break;
            }
        }
        if (best is { } found) layout.ClassName = Trim(layout, found.Range);
    }

    /// <summary>Rakam sütunları: her kesintisiz rakam bölgesi ayrı aday. Hangisinin öğrenci numarası olduğuna burada karar verilmez.</summary>
    private static void FindNumbers(Layout layout, IReadOnlyList<(int Line, string Text)> sample)
    {
        bool IsDigit(int c) => !Assigned(layout, c) && layout.Columns[c].NonSpace > 0 && layout.Columns[c].Digit >= layout.Columns[c].NonSpace * 0.9;
        var c = 0;
        while (c < layout.Width)
        {
            if (!IsDigit(c)) { c++; continue; }
            var start = c;
            while (c + 1 < layout.Width && IsDigit(c + 1)) c++;
            var range = new Range(start, c - start + 1);
            c++;
            if (range.Length < 3) continue;
            // Bitişik "kurum kodu + numara": baştaki sabit (sıfırdan farklı) sütunlar ayrı aday olur.
            // Birleşik hâli de aday olarak kalır; hangisinin numara olduğu görünüşten kesinleşmez.
            var prefix = 0;
            while (prefix < range.Length && layout.Columns[range.Start + prefix].Values.Count == 1 && layout.Columns[range.Start + prefix].NonSpace == layout.Lines) prefix++;
            // Sıfırla başlayan sabit kısım numaranın baştaki sıfırlarıdır (ör. 0000001234); ayrılmaz.
            var leadingZero = prefix > 0 && layout.Columns[range.Start].Values.ContainsKey('0');
            if (prefix >= 2 && range.Length - prefix >= 3 && !leadingZero)
            {
                layout.Numbers.Add(new Range(range.Start, prefix));
                layout.Numbers.Add(new Range(range.Start + prefix, range.Length - prefix));
                layout.Combined.Add(range);
            }
            else
            {
                layout.Numbers.Add(range);
            }
        }
        var varying = layout.Numbers
            .Select(range => (Range: range, Values: sample.Select(item => Slice(item.Text, range.Start, range.Length).Trim()).Where(v => v.Length > 0).ToList()))
            .Where(item => item.Values.Count > 0 && item.Values.Distinct().Count() > 1)
            .OrderByDescending(item => item.Values.Distinct().Count() / (double)item.Values.Count)
            .ThenByDescending(item => item.Range.Length)
            .ToList();
        layout.StudentNo = varying.FirstOrDefault().Range;
    }

    /// <summary>Ad soyad: harf ve boşluk ağırlıklı bölge; genişlik bir sonraki alana kadar uzar (kısa isimlerde kalan kısım boşluktur).</summary>
    private static void FindName(Layout layout)
    {
        bool Textual(int c)
        {
            var column = layout.Columns[c];
            return !Assigned(layout, c) && column.NonSpace > 0 && column.Letter + column.Answer + column.Other >= column.NonSpace * 0.8 && column.Digit <= column.NonSpace * 0.05;
        }
        var clusters = new List<(int Start, int End, int Weight, bool HasLetters)>();
        var c = 0;
        while (c < layout.Width)
        {
            if (!Textual(c)) { c++; continue; }
            var start = c;
            var end = c;
            var gap = 0;
            for (var k = c + 1; k < layout.Width; k++)
            {
                if (Assigned(layout, k)) break;
                if (Textual(k)) { end = k; gap = 0; continue; }
                if (layout.Columns[k].NonSpace == 0 && ++gap <= 2) continue;
                break;
            }
            var weight = Enumerable.Range(start, end - start + 1).Sum(k => layout.Columns[k].NonSpace);
            var letters = Enumerable.Range(start, end - start + 1).Any(k => layout.Columns[k].Letter > 0);
            clusters.Add((start, end, weight, letters));
            c = end + 1;
        }
        var best = clusters.Where(item => item.HasLetters && item.End - item.Start >= 2).OrderByDescending(item => item.Weight).FirstOrDefault();
        if (best == default) return;
        // Sağdaki boş sütunlar (kısa isimlerin doldurma boşluğu) bir sonraki dolu sütuna kadar alana dahildir.
        var last = best.End;
        while (last + 1 < layout.Width && !Assigned(layout, last + 1) && layout.Columns[last + 1].NonSpace == 0 && last + 1 - best.End <= 10) last++;
        if (last + 1 >= layout.Width || layout.Columns[last + 1].NonSpace == 0) last = best.End;
        layout.Name = new Range(best.Start, last - best.Start + 1);
    }

    private static void FindUnknown(Layout layout)
    {
        var c = 0;
        while (c < layout.Width)
        {
            if (Assigned(layout, c) || layout.Columns[c].NonSpace == 0) { c++; continue; }
            var start = c;
            while (c + 1 < layout.Width && !Assigned(layout, c + 1) && layout.Columns[c + 1].NonSpace > 0) c++;
            layout.Unknown.Add(new Range(start, c - start + 1));
            c++;
        }
    }

    private static Range Trim(Layout layout, Range range)
    {
        var start = range.Start;
        var end = range.End;
        while (start < end && layout.Columns[start].NonSpace == 0) start++;
        while (end > start && layout.Columns[end].NonSpace == 0) end--;
        return new Range(start, end - start + 1);
    }

    private static string Slice(string line, int start, int length) => OpticalParser.Slice(line, start + 1, length);

    // ─── Şüpheli satırlar ────────────────────────────────────────────────────

    [GeneratedRegex(@"\b(cevap|anahtar|kitapcik|ad soyad|adi soyadi|ogrenci no|ogr no|numara|sinif|soru|ders)\b")]
    private static partial Regex HeaderRegex();

    private static List<int> AnswerKeyLines(IReadOnlyList<(int Line, string Text)> lines, Layout layout)
    {
        if (layout.Answers.Count == 0 || (layout.Name is null && layout.StudentNo is null)) return [];
        return lines.Where(item =>
        {
            var nameBlank = layout.Name is null || Slice(item.Text, layout.Name.Start, layout.Name.Length).Trim().Length == 0;
            var numberBlank = layout.StudentNo is null || Slice(item.Text, layout.StudentNo.Start, layout.StudentNo.Length).Trim().Length == 0;
            // Anahtarda kitapçık sütunu boş kalabilir; blok onu da kapsıyorsa tek boşluk hoş görülür.
            var full = layout.Answers.All(block => Slice(item.Text, block.Start, block.Length).Count(ch => ch is not (>= 'A' and <= 'E')) <= 1);
            return nameBlank && numberBlank && full;
        }).Select(item => item.Line).ToList();
    }

    /// <summary>Önerilen alanların karakter türüne %30'dan fazla uymayan satırlar.</summary>
    private static IEnumerable<int> OddLines(IReadOnlyList<(int Line, string Text)> lines, Layout layout)
    {
        foreach (var (line, text) in lines)
        {
            var checkedCount = 0;
            var wrong = 0;
            void Count(Range? range, Func<char, bool> ok)
            {
                if (range is null) return;
                foreach (var ch in Slice(text, range.Start, range.Length))
                {
                    if (ch == ' ') continue;
                    checkedCount++;
                    if (!ok(ch)) wrong++;
                }
            }
            Count(layout.StudentNo, char.IsDigit);
            Count(layout.Name, ch => !char.IsDigit(ch));
            foreach (var block in layout.Answers) Count(block, ch => ch is (>= 'A' and <= 'E') or '*');
            if (checkedCount >= 5 && wrong > checkedCount * 0.3) yield return line;
        }
    }

    // ─── Sonuç ───────────────────────────────────────────────────────────────

    private static OpticalLayoutDetection Build(
        string encoding, int total, int sampled, int typical, int min, int max,
        IReadOnlyList<(int Line, string Text)> rows, Layout layout, Dictionary<int, OpticalFlaggedLineDto> flagged)
    {
        var n = rows.Count;
        var warnings = new List<string>();
        var confirmations = new List<string>();
        var fields = new List<OpticalSuggestedFieldDto>();
        static int One(int column) => column + 1;
        static string Level(double ratio, int lines, double high = 0.98, double medium = 0.9) =>
            lines < 5 ? "low" : ratio >= high && lines >= 10 ? "high" : ratio >= medium ? "medium" : "low";
        double Share(Range range, Func<string, bool> ok) => n == 0 ? 0 : rows.Count(item => ok(Slice(item.Text, range.Start, range.Length))) / (double)n;
        const string Missing = "Algılanamadı / Dosyada bulunmuyor olabilir.";

        // Öğrenci numarası adayları (konum + ölçüm); karar kesin değilse kullanıcıya sunulur.
        var numberCandidates = layout.Numbers.Select((range, index) =>
        {
            var values = rows.Select(item => Slice(item.Text, range.Start, range.Length).Trim()).Where(v => v.Length > 0).ToList();
            var distinct = values.Distinct().Count();
            var constant = distinct <= 1;
            var leading = values.Any(v => v.Length > 1 && v[0] == '0');
            var note = constant
                ? "Bütün satırlarda aynı değer: kurum ya da sınav kodu olabilir."
                : distinct < values.Count ? $"{values.Count} satırda {distinct} farklı değer; bazı değerler tekrar ediyor." : $"{values.Count} satırın hepsinde farklı.";
            if (leading) note += " Baştaki sıfırlar korunur.";
            return new OpticalNumberCandidateDto($"n{index + 1}", One(range.Start), range.Length, distinct, constant, leading, note);
        }).ToList();
        // Birleşik aday ayrı bir alan değil, aynı rakamların başka okunuşu: belirsizlik sayımına girmez.
        var varyingCount = numberCandidates.Count(item => !item.Constant);
        foreach (var range in layout.Combined)
        {
            numberCandidates.Add(new OpticalNumberCandidateDto($"n{numberCandidates.Count + 1}", One(range.Start), range.Length,
                rows.Select(item => Slice(item.Text, range.Start, range.Length).Trim()).Distinct().Count(), false, false,
                "Bitişik iki rakam alanının birleşimi: kurum/okul kodu numaranın parçası olabilir. Okul numaranız böyle yazılıyorsa bunu seçin."));
            warnings.Add($"{One(range.Start)}–{One(range.End)}. karakterlerde bitişik rakamlar var; sabit baş kısmı ({One(range.Start)}–{One(range.Start) + layout.Numbers.First(r => r.Start == range.Start).Length - 1}) ayrı aday olarak gösterildi.");
            confirmations.Add("Bitişik rakam alanı ikiye ayrıldı. Öğrenci numarasının sabit baş kısmı içerip içermediğini aday listesinden doğrulayın.");
        }

        if (layout.StudentNo is { } number)
        {
            var values = rows.Select(item => Slice(item.Text, number.Start, number.Length).Trim()).Where(v => v.Length > 0).ToList();
            var unique = values.Count == 0 ? 0 : values.Distinct().Count() / (double)values.Count;
            var digits = Share(number, v => v.Trim().All(char.IsDigit));
            var level = varyingCount > 1 ? "low" : Level(Math.Min(unique, digits), n, 0.98, 0.9);
            var reason = $"{One(number.Start)}–{One(number.End)}. karakterler satırların %{Percent(digits)}'inde yalnız rakam; değerlerin %{Percent(unique)}'i farklı.";
            if (varyingCount > 1) reason += $" Dosyada {varyingCount} farklı rakam alanı var; hangisinin öğrenci numarası olduğunu aday listesinden doğrulayın.";
            if (values.Any(v => v.Length > 1 && v[0] == '0')) reason += " Baştaki sıfırlar alana dahil.";
            fields.Add(new("studentNo", "Öğrenci no", One(number.Start), number.Length, level, reason));
            if (varyingCount > 1) confirmations.Add("Birden fazla rakam alanı bulundu. Öğrenci numarası olarak seçilen alanı doğrulayın; diğeri kurum ya da sınav kodu olabilir.");
        }
        else
        {
            fields.Add(new("studentNo", "Öğrenci no", 1, 0, "none",
                numberCandidates.Count > 0 ? $"{Missing} Bulunan rakam alanları bütün satırlarda aynı (kurum ya da sınav kodu olabilir)." : Missing));
        }

        if (layout.Name is { } name)
        {
            var valid = Share(name, v => NameRegex().IsMatch(v));
            var longest = rows.Select(item => Slice(item.Text, name.Start, name.Length).TrimEnd().Length).DefaultIfEmpty(0).Max();
            var reason = $"{One(name.Start)}–{One(name.End)}. karakterler satırların %{Percent(valid)}'inde yalnız harf ve boşluk; en uzun isim {longest} karakter, alan {name.Length} karakter.";
            if (longest >= name.Length) reason += " Bazı isimler alanı tamamen dolduruyor; cihaz uzun isimleri kesiyor olabilir.";
            fields.Add(new("name", "Ad soyad", One(name.Start), name.Length, Level(valid, n, 0.97, 0.85), reason));
        }
        else
        {
            fields.Add(new("name", "Ad soyad", 1, 0, "none", Missing));
        }

        if (layout.ClassName is { } className)
        {
            var valid = Share(className, v => ClassRegex().IsMatch(v.Trim()));
            fields.Add(new("class", "Sınıf", One(className.Start), className.Length, Level(valid, n, 0.97, 0.85),
                $"{One(className.Start)}–{One(className.End)}. karakterler satırların %{Percent(valid)}'inde “10-A” gibi sınıf biçiminde."));
        }
        else
        {
            fields.Add(new("class", "Sınıf", 1, 0, "none", Missing));
        }

        var booklets = new List<string>();
        if (layout.Booklet is { } booklet)
        {
            booklets = rows.Select(item => Slice(item.Text, booklet.Start, 1).Trim()).Where(v => v.Length > 0).Distinct().OrderBy(x => x).ToList();
            fields.Add(new("booklet", "Kitapçık", One(booklet.Start), 1, n < 5 ? "low" : layout.BookletConfidence, layout.BookletReason));
            if (booklets.Count > 1)
                warnings.Add($"Dosyada {booklets.Count} kitapçık türü var ({string.Join(", ", booklets)}). Kitapçıkların soru sıralarının aynı olduğu varsayılmadı; her kitapçığın cevap anahtarını ayrıca girin.");
        }
        else
        {
            fields.Add(new("booklet", "Kitapçık", 1, 0, "none", Missing));
        }

        var blocks = new List<OpticalAnswerBlockDto>();
        for (var i = 0; i < layout.Answers.Count; i++)
        {
            var block = layout.Answers[i];
            var valid = Share(block, v => v.All(ch => ch is (>= 'A' and <= 'E') or '*' or ' '));
            var blanks = rows.Sum(item => Slice(item.Text, block.Start, block.Length).Count(ch => ch == ' '));
            var multi = rows.Sum(item => Slice(item.Text, block.Start, block.Length).Count(ch => ch == '*'));
            var nextField = layout.Answers.Skip(i + 1).Select(r => r.Start).DefaultIfEmpty(int.MaxValue).Min();
            // Bloktan sonra (sonraki alana ya da satır sonuna kadar) yalnız boşluk varsa son sorular boş bırakılmış olabilir.
            var trailing = rows.Count(item => item.Text.Length > block.End + 1 && item.Text[(block.End + 1)..Math.Min(item.Text.Length, nextField)].Trim().Length == 0);
            var shortLines = rows.Count(item => item.Text.Length <= block.End);
            var lastFill = Enumerable.Range(Math.Max(block.Start, block.End - 2), Math.Min(3, block.Length)).Average(c => layout.Columns[c].NonSpace / (double)Math.Max(1, layout.Lines));
            var confirm = trailing > n * 0.5 || shortLines > 0 || lastFill < 0.5;
            var reason = $"{One(block.Start)}–{One(block.End)}. karakterler satırların %{Percent(valid)}'inde yalnız A–E, boşluk (boş cevap) ya da * (çoklu işaret); {blanks} boş, {multi} çoklu işaret.";
            if (confirm)
            {
                var detail = shortLines > 0 ? $"{shortLines} satır bloğun sonuna ulaşmıyor" : "cevapların ardından yalnız boşluk var";
                confirmations.Add($"Cevap bloğu {i + 1}: {block.Length} soru önerildi ama {detail}; son sorular boş bırakılmış olabilir. Gerçek soru sayısını doğrulayın.");
            }
            blocks.Add(new($"Cevap bloğu {i + 1}", One(block.Start), block.Length, confirm ? (n < 5 ? "low" : "medium") : Level(valid, n), reason, confirm));
        }
        if (blocks.Count == 1)
            warnings.Add("Tek bir cevap dizisi bulundu ve “Cevap bloğu 1” olarak önerildi. Dosyada ders adı ya da soru dağılımı yok; ders seçin ya da bloğu derslere bölün.");

        foreach (var range in layout.Unknown)
        {
            if (range.Length < 1) continue;
            warnings.Add($"{One(range.Start)}–{One(range.End)}. karakterlerde tanınmayan bilgi var (ör. kurum/sınav kodu ya da cihazın eklediği bilgi). Şablona eklenmedi.");
        }
        foreach (var candidate in numberCandidates.Where(item => item.Constant))
            warnings.Add($"{candidate.Start}–{candidate.Start + candidate.Length - 1}. karakterler bütün satırlarda aynı rakam: kurum ya da sınav kodu olabilir; öğrenci numarası olarak önerilmedi.");

        var manual = blocks.Count == 0 || (layout.Name is null && layout.StudentNo is null) || n < 2;
        var message = manual
            ? "Güvenilir bir öneri üretilemedi. Değerleri cihazın çıktı düzenine göre elle girin; aşağıdaki önizleme yardımcı olur."
            : "Öneri hazır. Değerleri önizlemede kontrol edip gerekirse düzeltin; şablon yalnız Kaydet’e bastığınızda kaydedilir.";
        if (blocks.Count == 0) warnings.Add("Cevap bloğu bulunamadı: A–E harflerinden oluşan uzun bir dizi yok.");

        var ambiguous = varyingCount > 1 || layout.Unknown.Count > 0 || fields.Any(item => item.Confidence == "low");
        var suggestion = new OpticalTemplateSuggestionDto(
            true, message, encoding, "fixed", total, sampled, typical, min, max,
            fields, numberCandidates, blocks, booklets,
            flagged.Values.OrderBy(item => item.Line).Take(MaxFlaggedLines).ToList(),
            flagged.Count > MaxFlaggedLines ? [.. warnings, $"Toplam {flagged.Count} şüpheli satır var; ilk {MaxFlaggedLines} tanesi listelendi."] : warnings,
            confirmations, "not-needed", [], manual);
        return new OpticalLayoutDetection(suggestion, Segments(layout, rows), ambiguous);
    }

    private static string Percent(double ratio) => Math.Round(ratio * 100).ToString("0", System.Globalization.CultureInfo.InvariantCulture);

    [GeneratedRegex(@"^[\p{L} .'’\-]*$")]
    private static partial Regex NameRegex();

    /// <summary>Model için maskeli şekiller: harf → X, rakam → 9, boşluk → _ ; A–E cevap bölgesinde aynen kalmaz (a).</summary>
    private static List<OpticalLayoutSegment> Segments(Layout layout, IReadOnlyList<(int Line, string Text)> rows)
    {
        var list = new List<(string Kind, Range Range)>();
        if (layout.Name is { } name) list.Add(("text", name));
        if (layout.ClassName is { } className) list.Add(("class-like", className));
        if (layout.Booklet is { } booklet) list.Add(("single-letter", booklet));
        list.AddRange(layout.Numbers.Select(range => ("digits", range)));
        list.AddRange(layout.Answers.Select(range => ("answers", range)));
        list.AddRange(layout.Unknown.Select(range => ("unknown", range)));
        var shapesFrom = Spread(rows, 4);
        return list.OrderBy(item => item.Range.Start).Select((item, index) =>
        {
            var values = rows.Select(row => Slice(row.Text, item.Range.Start, item.Range.Length)).ToList();
            var fill = values.Count == 0 ? 0 : values.Count(v => v.Trim().Length > 0) / (double)values.Count;
            var shapes = shapesFrom.Select(row => Mask(Slice(row.Text, item.Range.Start, Math.Min(item.Range.Length, 40)))).ToList();
            return new OpticalLayoutSegment($"s{index + 1}", item.Kind, item.Range.Start + 1, item.Range.Length, Math.Round(fill, 2), values.Select(v => v.Trim()).Distinct().Count(), shapes);
        }).ToList();
    }

    private static string Mask(string value) => new(value.Select(ch => ch switch
    {
        ' ' => '_',
        >= '0' and <= '9' => '9',
        >= 'A' and <= 'E' => 'a',
        '*' => '*',
        _ when char.IsLetter(ch) => 'X',
        _ => '?',
    }).ToArray());

    // ─── Yardımcılar ─────────────────────────────────────────────────────────

    private static List<(int Line, string Text)> Spread(IReadOnlyList<(int Line, string Text)> lines, int max)
    {
        if (lines.Count <= max) return [.. lines];
        return Enumerable.Range(0, max).Select(i => lines[(int)((long)i * (lines.Count - 1) / (max - 1))]).ToList();
    }

    private static string? DetectDelimiter(IReadOnlyList<(int Line, string Text)> lines)
    {
        var probe = Spread(lines, 200);
        foreach (var (delimiter, name) in new[] { ('\t', "sekme"), (';', "noktalı virgül"), (',', "virgül"), ('|', "dikey çizgi") })
        {
            var counts = probe.Select(item => item.Text.Count(ch => ch == delimiter)).ToList();
            var mode = counts.GroupBy(x => x).OrderByDescending(g => g.Count()).First();
            if (mode.Key >= 2 && mode.Count() >= counts.Count * 0.8) return name;
        }
        return null;
    }

    private static OpticalLayoutDetection Unsupported(string encoding, string format, int total, string message) => new(
        new OpticalTemplateSuggestionDto(false, message, encoding, format, total, 0, 0, 0, 0, [], [], [], [], [], [], [], "not-needed", [], true),
        [], false);
}
