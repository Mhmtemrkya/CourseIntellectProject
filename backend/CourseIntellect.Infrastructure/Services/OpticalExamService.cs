using System.Globalization;
using System.Text.Json;
using CourseIntellect.Application.DTOs.OpticalExams;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Optik deneme aktarımı. Öğrenci eşleştirme: önce okul numarası (baştaki sıfırlar yok sayılır),
/// sonra Türkçe harf katlamalı tam ad. Yalnız ad başlangıcı tutan (optikte kesilmiş ad) eşleşme
/// "ambiguous" sayılır ve öğretmen onayı ister. Öğrenci listesi şube kapsamına tabidir.
/// </summary>
public sealed class OpticalExamService(CourseIntellectDbContext dbContext) : IOpticalExamService
{
    private const int MaxFileBytes = 5_000_000;
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");
    private static readonly StringComparer TrComparer = StringComparer.Create(Tr, ignoreCase: true);
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private sealed record RosterStudent(Guid UserId, string FullName, string ClassName, string SchoolNumber, Guid? BranchId, string NameKey, string NumberKey);

    // ── Şablon ───────────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<OpticalTemplateDto>> ListTemplatesAsync(CancellationToken cancellationToken = default) =>
        (await dbContext.OpticalTemplates.AsNoTracking().ToListAsync(cancellationToken))
            .Select(ToDto)
            .OrderBy(item => item.Name, TrComparer)
            .ToList();

    public async Task<OpticalTemplateDto> SaveTemplateAsync(Guid? id, SaveOpticalTemplateRequest request, CancellationToken cancellationToken = default)
    {
        ValidateTemplate(request);
        var entity = id is Guid existingId
            ? await dbContext.OpticalTemplates.FirstOrDefaultAsync(item => item.Id == existingId, cancellationToken)
                ?? throw new KeyNotFoundException("Şablon bulunamadı.")
            : new OpticalTemplate();
        entity.Name = request.Name.Trim();
        entity.Encoding = NormalizeEncoding(request.Encoding);
        entity.StudentNoStart = request.StudentNoStart;
        entity.StudentNoLength = request.StudentNoLength;
        entity.NameStart = request.NameStart;
        entity.NameLength = request.NameLength;
        entity.ClassStart = request.ClassStart;
        entity.ClassLength = request.ClassLength;
        entity.BookletStart = request.BookletStart;
        entity.BookletLength = request.BookletLength;
        entity.SubjectsJson = JsonSerializer.Serialize(request.Subjects.Select(item => new OpticalSubjectBlockDto(item.Name.Trim(), item.Start, item.Count)), Json);
        entity.UpdatedAtUtc = DateTime.UtcNow;
        if (id is null) dbContext.OpticalTemplates.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(entity);
    }

    public async Task DeleteTemplateAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.OpticalTemplates.FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException("Şablon bulunamadı.");
        if (await dbContext.OpticalExams.IgnoreQueryFilters().AnyAsync(item => item.TemplateId == id, cancellationToken))
        {
            throw new InvalidOperationException("Bu şablonu kullanan deneme var; önce denemeyi silin.");
        }
        dbContext.OpticalTemplates.Remove(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static void ValidateTemplate(SaveOpticalTemplateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name)) throw new ArgumentException("Şablon adı zorunludur.");
        if (request.StudentNoLength <= 0 && request.NameLength <= 0) throw new ArgumentException("Öğrenci numarası ya da ad alanından en az biri tanımlanmalı.");
        if (request.Subjects is null || request.Subjects.Count == 0) throw new ArgumentException("En az bir ders bloğu tanımlanmalı.");
        if (request.Subjects.Select(item => item.Name.Trim()).Distinct(TrComparer).Count() != request.Subjects.Count)
        {
            throw new ArgumentException("Ders adları tekrar edemez.");
        }

        var ranges = new List<(string Name, int Start, int Length)>
        {
            ("Öğrenci no", request.StudentNoStart, request.StudentNoLength),
            ("Ad soyad", request.NameStart, request.NameLength),
            ("Sınıf", request.ClassStart, request.ClassLength),
            ("Kitapçık", request.BookletStart, request.BookletLength),
        };
        foreach (var subject in request.Subjects)
        {
            if (string.IsNullOrWhiteSpace(subject.Name)) throw new ArgumentException("Ders adı boş olamaz.");
            if (subject.Count is < 1 or > 200) throw new ArgumentException($"{subject.Name}: soru sayısı 1-200 arasında olmalı.");
            ranges.Add((subject.Name.Trim(), subject.Start, subject.Count));
        }
        var defined = ranges.Where(item => item.Length > 0).ToList();
        foreach (var range in defined)
        {
            if (range.Start < 1) throw new ArgumentException($"{range.Name}: başlangıç kolonu 1 ya da daha büyük olmalı.");
        }
        for (var i = 0; i < defined.Count; i++)
        {
            for (var j = i + 1; j < defined.Count; j++)
            {
                var a = defined[i];
                var b = defined[j];
                if (a.Start < b.Start + b.Length && b.Start < a.Start + a.Length)
                {
                    throw new ArgumentException($"{a.Name} ile {b.Name} kolonları çakışıyor.");
                }
            }
        }
    }

    private static string NormalizeEncoding(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized is OpticalParser.Utf8 or OpticalParser.Auto ? normalized : OpticalParser.Windows1254;
    }

    private static OpticalTemplateDto ToDto(OpticalTemplate entity)
    {
        var subjects = JsonSerializer.Deserialize<List<OpticalSubjectBlockDto>>(entity.SubjectsJson, Json) ?? [];
        var ends = new[]
        {
            entity.StudentNoStart + entity.StudentNoLength,
            entity.NameStart + entity.NameLength,
            entity.ClassStart + entity.ClassLength,
            entity.BookletStart + entity.BookletLength,
        }.Concat(subjects.Select(item => item.Start + item.Count));
        return new OpticalTemplateDto(entity.Id, entity.Name, entity.Encoding, entity.StudentNoStart, entity.StudentNoLength,
            entity.NameStart, entity.NameLength, entity.ClassStart, entity.ClassLength, entity.BookletStart, entity.BookletLength,
            subjects, Math.Max(0, ends.Max() - 1));
    }

    // ── Deneme ───────────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<OpticalExamSummaryDto>> ListExamsAsync(CancellationToken cancellationToken = default)
    {
        var exams = await dbContext.OpticalExams.AsNoTracking().OrderByDescending(item => item.ExamDateUtc).ToListAsync(cancellationToken);
        var templates = await dbContext.OpticalTemplates.AsNoTracking().ToDictionaryAsync(item => item.Id, item => item.Name, cancellationToken);
        return exams.Select(exam =>
        {
            var keys = ReadKeys(exam);
            var first = keys.FirstOrDefault();
            var questionCount = first?.Subjects.Sum(item => item.Answers.Length) ?? 0;
            var topicCount = first?.Subjects.Sum(item => item.Topics.Count(topic => !string.IsNullOrWhiteSpace(topic))) ?? 0;
            return new OpticalExamSummaryDto(exam.Id, exam.Title, exam.ExamDateUtc, exam.TemplateId,
                templates.GetValueOrDefault(exam.TemplateId) ?? "—", exam.Status, exam.ImportedStudentCount, exam.ImportedAtUtc,
                questionCount, questionCount == 0 ? 0 : (int)Math.Round(topicCount * 100m / questionCount));
        }).ToList();
    }

    public async Task<OpticalExamDto?> GetExamAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var exam = await dbContext.OpticalExams.AsNoTracking().FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        return exam is null ? null : ToDto(exam);
    }

    public async Task<OpticalExamDto> SaveExamAsync(Guid? id, SaveOpticalExamRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Title)) throw new ArgumentException("Deneme adı zorunludur.");
        if (request.WrongPenalty is < 0 or > 10) throw new ArgumentException("Yanlış götürme oranı 0-10 arasında olmalı (LGS 3, TYT/AYT 4, 0 = götürmez).");
        var cancelledMode = request.CancelledMode == "correct" ? "correct" : "exclude";
        var template = await dbContext.OpticalTemplates.AsNoTracking().FirstOrDefaultAsync(item => item.Id == request.TemplateId, cancellationToken)
            ?? throw new ArgumentException("Optik şablon bulunamadı.");
        var keys = NormalizeKeys(request.Keys, ToDto(template));

        var entity = id is Guid existingId
            ? await dbContext.OpticalExams.FirstOrDefaultAsync(item => item.Id == existingId, cancellationToken)
                ?? throw new KeyNotFoundException("Deneme bulunamadı.")
            : new OpticalExam { BranchId = dbContext.EffectiveBranchId };
        entity.Title = request.Title.Trim();
        entity.ExamDateUtc = DateTime.SpecifyKind(request.ExamDateUtc, DateTimeKind.Utc);
        entity.TemplateId = template.Id;
        entity.WrongPenalty = request.WrongPenalty;
        entity.MultiMarkAsWrong = request.MultiMarkAsWrong;
        entity.CancelledMode = cancelledMode;
        entity.KeysJson = JsonSerializer.Serialize(keys, Json);
        if (id is null) dbContext.OpticalExams.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(entity);
    }

    /// <summary>Her kitapçık şablondaki her dersi kapsamalı; anahtar uzunluğu soru sayısına eşit olmalı.</summary>
    private static List<OpticalAnswerKeyDto> NormalizeKeys(IReadOnlyList<OpticalAnswerKeyDto>? keys, OpticalTemplateDto template)
    {
        if (keys is null || keys.Count == 0) throw new ArgumentException("En az bir kitapçık cevap anahtarı gerekir.");
        var result = new List<OpticalAnswerKeyDto>();
        foreach (var key in keys)
        {
            var booklet = (key.Booklet ?? string.Empty).Trim().ToUpperInvariant();
            if (booklet.Length is < 1 or > 2) throw new ArgumentException("Kitapçık türü bir ya da iki karakter olmalı (ör. A, B).");
            if (result.Any(item => item.Booklet == booklet)) throw new ArgumentException($"{booklet} kitapçığı iki kez tanımlanmış.");

            var subjects = new List<OpticalAnswerKeySubjectDto>();
            foreach (var block in template.Subjects)
            {
                var subjectKey = key.Subjects.FirstOrDefault(item => TrComparer.Equals(item.Subject.Trim(), block.Name))
                    ?? throw new ArgumentException($"{booklet} kitapçığında {block.Name} cevap anahtarı eksik.");
                var answers = new string((subjectKey.Answers ?? string.Empty).Where(ch => !char.IsWhiteSpace(ch)).ToArray()).ToUpperInvariant();
                if (answers.Length != block.Count)
                {
                    throw new ArgumentException($"{booklet} / {block.Name}: cevap anahtarı {answers.Length} soru, şablonda {block.Count} soru var.");
                }
                var invalid = answers.FirstOrDefault(ch => ch is not (>= 'A' and <= 'E') and not 'X' and not '*');
                if (invalid != default) throw new ArgumentException($"{booklet} / {block.Name}: cevap anahtarında geçersiz karakter '{invalid}' (A-E, iptal için X).");

                var topics = (subjectKey.Topics ?? []).Select(item => (item ?? string.Empty).Trim()).ToList();
                if (topics.Count > 0 && topics.Count != block.Count)
                {
                    throw new ArgumentException($"{booklet} / {block.Name}: konu listesi {topics.Count} satır, soru sayısı {block.Count}. Her soru için bir satır girin (konu yoksa boş satır).");
                }
                if (topics.Any(item => item.Length > 150)) throw new ArgumentException($"{booklet} / {block.Name}: konu adı en fazla 150 karakter olabilir.");
                subjects.Add(new OpticalAnswerKeySubjectDto(block.Name, answers, topics));
            }
            result.Add(new OpticalAnswerKeyDto(booklet, subjects));
        }
        return result;
    }

    public async Task DeleteExamAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var exam = await dbContext.OpticalExams.FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException("Deneme bulunamadı.");
        await RemoveImportedDataAsync(exam.Id, cancellationToken);
        dbContext.OpticalExams.Remove(exam);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static List<OpticalAnswerKeyDto> ReadKeys(OpticalExam exam) =>
        JsonSerializer.Deserialize<List<OpticalAnswerKeyDto>>(exam.KeysJson, Json) ?? [];

    private static OpticalExamDto ToDto(OpticalExam exam) => new(exam.Id, exam.Title, exam.ExamDateUtc, exam.TemplateId,
        exam.WrongPenalty, exam.MultiMarkAsWrong, exam.CancelledMode, ReadKeys(exam), exam.Status, exam.FileName,
        exam.ImportedStudentCount, exam.ImportedAtUtc);

    // ── Önizleme ve aktarım ──────────────────────────────────────────────────

    private sealed record ParsedFile(
        OpticalExam Exam,
        string Encoding,
        IReadOnlyList<string> SampleLines,
        List<(OpticalRawRow Raw, OpticalScoredRow Scored, OpticalPreviewRowDto Preview)> Rows,
        List<RosterStudent> Roster,
        List<string> Errors);

    private async Task<ParsedFile> ParseAsync(Guid examId, byte[] file, string? encoding, CancellationToken cancellationToken)
    {
        if (file.Length == 0) throw new ArgumentException("Dosya boş.");
        if (file.Length > MaxFileBytes) throw new ArgumentException("Dosya en fazla 5 MB olabilir.");
        var exam = await dbContext.OpticalExams.FirstOrDefaultAsync(item => item.Id == examId, cancellationToken)
            ?? throw new KeyNotFoundException("Deneme bulunamadı.");
        var templateEntity = await dbContext.OpticalTemplates.AsNoTracking().FirstOrDefaultAsync(item => item.Id == exam.TemplateId, cancellationToken)
            ?? throw new InvalidOperationException("Denemenin optik şablonu silinmiş.");
        var template = ToDto(templateEntity);
        var keys = ReadKeys(exam);
        if (keys.Count == 0) throw new InvalidOperationException("Önce cevap anahtarını girin.");

        var (text, used) = OpticalParser.Decode(file, string.IsNullOrWhiteSpace(encoding) ? templateEntity.Encoding : encoding);
        var lines = OpticalParser.Lines(text);
        var errors = new List<string>();
        if (lines.Count == 0) errors.Add("Dosyada okunacak satır yok.");
        var shortLines = lines.Count(item => item.Text.TrimEnd().Length < template.Subjects.Min(subject => subject.Start));
        if (shortLines > 0) errors.Add($"{shortLines} satır, ilk ders bloğunun başladığı kolondan kısa. Şablon kolonlarını kontrol edin.");

        var roster = await LoadRosterAsync(cancellationToken);
        var rows = new List<(OpticalRawRow, OpticalScoredRow, OpticalPreviewRowDto)>();
        foreach (var (lineNo, line) in lines)
        {
            var raw = OpticalParser.ParseRow(lineNo, line, template);
            var scored = OpticalParser.Score(raw, keys, exam.WrongPenalty, exam.MultiMarkAsWrong, exam.CancelledMode);
            var (status, by, matched, candidates) = Match(raw, roster, template.NameLength);
            rows.Add((raw, scored, new OpticalPreviewRowDto(lineNo, raw.StudentNo, raw.Name, raw.ClassName, scored.Booklet,
                status, by, matched?.UserId, matched?.FullName,
                candidates.Select(item => new OpticalStudentCandidateDto(item.UserId, item.FullName, item.ClassName, item.SchoolNumber)).ToList(),
                scored.Scores, scored.Warnings)));
        }

        // Aynı öğrenciye iki satır eşleşirse ikisi de onay ister.
        foreach (var duplicate in rows.Where(item => item.Item3.StudentUserId is not null).GroupBy(item => item.Item3.StudentUserId).Where(group => group.Count() > 1).ToList())
        {
            foreach (var row in duplicate)
            {
                var index = rows.IndexOf(row);
                var preview = row.Item3;
                rows[index] = (row.Item1, row.Item2, preview with
                {
                    MatchStatus = "ambiguous",
                    MatchedBy = null,
                    Warnings = [.. preview.Warnings, "Bu öğrenci dosyada birden fazla satırla eşleşti."],
                    Candidates = preview.Candidates.Count > 0 ? preview.Candidates
                        : [new OpticalStudentCandidateDto(preview.StudentUserId!.Value, preview.StudentName ?? string.Empty, string.Empty, string.Empty)],
                });
            }
        }

        var sample = lines.Take(5).Select(item => item.Text).ToList();
        return new ParsedFile(exam, used, sample, rows, roster, errors);
    }

    public async Task<OpticalPreviewDto> PreviewAsync(Guid examId, byte[] file, string? encoding, CancellationToken cancellationToken = default)
    {
        var parsed = await ParseAsync(examId, file, encoding, cancellationToken);
        var rows = parsed.Rows.Select(item => item.Preview).ToList();
        return new OpticalPreviewDto(parsed.Encoding, parsed.SampleLines, rows.Count,
            rows.Count(item => item.MatchStatus == "matched"),
            rows.Count(item => item.MatchStatus == "ambiguous"),
            rows.Count(item => item.MatchStatus == "unmatched"),
            rows, parsed.Errors);
    }

    public async Task<OpticalImportResultDto> ImportAsync(Guid examId, byte[] file, string? encoding, string fileName,
        IReadOnlyList<OpticalMatchOverrideDto> overrides, Guid? importedByUserId, CancellationToken cancellationToken = default)
    {
        // Sunucu dosyayı yeniden okur; istemcinin gönderdiği puanlara güvenilmez.
        var parsed = await ParseAsync(examId, file, encoding, cancellationToken);
        var byLine = (overrides ?? []).GroupBy(item => item.Line).ToDictionary(group => group.Key, group => group.Last().StudentUserId);
        var rosterById = parsed.Roster.ToDictionary(item => item.UserId);

        var chosen = new List<(OpticalRawRow Raw, OpticalScoredRow Scored, RosterStudent Student)>();
        var skipped = 0;
        foreach (var (raw, scored, preview) in parsed.Rows)
        {
            Guid? studentId = byLine.TryGetValue(raw.Line, out var overridden)
                ? overridden
                : preview.MatchStatus == "matched" ? preview.StudentUserId : null;
            if (studentId is not Guid id)
            {
                skipped++;
                continue;
            }
            if (!rosterById.TryGetValue(id, out var student)) throw new ArgumentException($"{raw.Line}. satır için seçilen öğrenci bulunamadı.");
            chosen.Add((raw, scored, student));
        }
        var duplicate = chosen.GroupBy(item => item.Student.UserId).FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null)
        {
            throw new ArgumentException($"{duplicate.First().Student.FullName} birden fazla satıra atanmış (satır {string.Join(", ", duplicate.Select(item => item.Raw.Line))}).");
        }
        if (chosen.Count == 0) throw new ArgumentException("Aktarılacak eşleşmiş öğrenci yok.");

        var exam = parsed.Exam;
        await using var transaction = dbContext.Database.IsRelational() ? await dbContext.Database.BeginTransactionAsync(cancellationToken) : null;
        await RemoveImportedDataAsync(exam.Id, cancellationToken);

        var answerCount = 0;
        var topicCount = 0;
        var dateLabel = exam.ExamDateUtc.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture);
        foreach (var (raw, scored, student) in chosen)
        {
            foreach (var question in scored.Questions)
            {
                dbContext.OpticalExamAnswers.Add(new OpticalExamAnswer
                {
                    BranchId = student.BranchId,
                    OpticalExamId = exam.Id,
                    StudentUserId = student.UserId,
                    Booklet = scored.Booklet,
                    Subject = question.Subject,
                    QuestionNo = question.QuestionNo,
                    Topic = question.Topic,
                    Outcome = question.Outcome,
                    Marked = question.Marked,
                });
                answerCount++;
                if (question.Topic.Length > 0) topicCount++;
            }
            foreach (var score in scored.Scores)
            {
                var total = score.Correct + score.Wrong + score.Blank;
                var result = new ExamResult
                {
                    ExamTitle = exam.Title,
                    Type = ExamType.MockExam,
                    Subject = score.Subject,
                    DateLabel = dateLabel,
                    StudentName = student.FullName,
                    ClassName = student.ClassName,
                    Score = total == 0 ? 0 : (int)Math.Round(score.Correct * 100m / total),
                    Net = score.Net,
                };
                dbContext.ExamResults.Add(result);
                dbContext.OpticalExamStudentResults.Add(new OpticalExamStudentResult
                {
                    BranchId = student.BranchId,
                    OpticalExamId = exam.Id,
                    StudentUserId = student.UserId,
                    StudentNo = raw.StudentNo,
                    Booklet = scored.Booklet,
                    Subject = score.Subject,
                    Correct = score.Correct,
                    Wrong = score.Wrong,
                    Blank = score.Blank,
                    Net = score.Net,
                    ExamResultId = result.Id,
                });
            }
        }

        exam.Status = "Imported";
        exam.FileName = Path.GetFileName(fileName ?? string.Empty);
        if (exam.FileName.Length > 200) exam.FileName = exam.FileName[..200];
        exam.ImportedStudentCount = chosen.Count;
        exam.ImportedAtUtc = DateTime.UtcNow;
        exam.ImportedByUserId = importedByUserId;
        await dbContext.SaveChangesAsync(cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return new OpticalImportResultDto(chosen.Count, skipped, answerCount, topicCount);
    }

    /// <summary>Yeniden aktarımda ya da silmede önceki cevaplar, ders sonuçları ve ExamResult kayıtları kaldırılır.</summary>
    private async Task RemoveImportedDataAsync(Guid examId, CancellationToken cancellationToken)
    {
        var results = await dbContext.OpticalExamStudentResults.Where(item => item.OpticalExamId == examId).ToListAsync(cancellationToken);
        var examResultIds = results.Where(item => item.ExamResultId != null).Select(item => item.ExamResultId!.Value).ToList();
        if (examResultIds.Count > 0)
        {
            dbContext.ExamResults.RemoveRange(await dbContext.ExamResults.Where(item => examResultIds.Contains(item.Id)).ToListAsync(cancellationToken));
        }
        dbContext.OpticalExamStudentResults.RemoveRange(results);
        dbContext.OpticalExamAnswers.RemoveRange(await dbContext.OpticalExamAnswers.Where(item => item.OpticalExamId == examId).ToListAsync(cancellationToken));
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<OpticalExamResultsDto?> GetResultsAsync(Guid examId, CancellationToken cancellationToken = default)
    {
        var exam = await dbContext.OpticalExams.AsNoTracking().FirstOrDefaultAsync(item => item.Id == examId, cancellationToken);
        if (exam is null) return null;
        var results = await dbContext.OpticalExamStudentResults.AsNoTracking().Where(item => item.OpticalExamId == examId).ToListAsync(cancellationToken);
        var ids = results.Select(item => item.StudentUserId).Distinct().ToList();
        var students = await dbContext.Students.AsNoTracking().Where(item => ids.Contains(item.UserId))
            .ToDictionaryAsync(item => item.UserId, cancellationToken);
        var subjects = ReadKeys(exam).FirstOrDefault()?.Subjects.Select(item => item.Subject).ToList() ?? [];
        var rows = results
            .GroupBy(item => item.StudentUserId)
            .Where(group => students.ContainsKey(group.Key))
            .Select(group => new OpticalExamResultRowDto(
                group.Key,
                students[group.Key].FullName,
                students[group.Key].ClassName,
                group.First().Booklet,
                group.Sum(item => item.Net),
                subjects.Select(subject => group.FirstOrDefault(item => item.Subject == subject) is { } score
                        ? new OpticalSubjectScoreDto(subject, score.Correct, score.Wrong, score.Blank, score.Net)
                        : new OpticalSubjectScoreDto(subject, 0, 0, 0, 0))
                    .ToList()))
            .OrderByDescending(item => item.TotalNet)
            .ThenBy(item => item.FullName, TrComparer)
            .ToList();
        var averages = subjects.Select(subject =>
        {
            var scores = rows.Select(row => row.Scores.First(item => item.Subject == subject)).ToList();
            return scores.Count == 0
                ? new OpticalSubjectScoreDto(subject, 0, 0, 0, 0)
                : new OpticalSubjectScoreDto(subject,
                    (int)Math.Round(scores.Average(item => item.Correct)),
                    (int)Math.Round(scores.Average(item => item.Wrong)),
                    (int)Math.Round(scores.Average(item => item.Blank)),
                    Math.Round(scores.Average(item => item.Net), 2));
        }).ToList();
        return new OpticalExamResultsDto(exam.Id, exam.Title, subjects, rows, averages);
    }

    public async Task<IReadOnlyList<OpticalStudentCandidateDto>> SearchStudentsAsync(string? search, CancellationToken cancellationToken = default)
    {
        var key = MessageParticipantKey.Compare(search);
        var number = OpticalParser.NormalizeStudentNo(search);
        return (await LoadRosterAsync(cancellationToken))
            .Where(item => key.Length == 0 || item.NameKey.Contains(key, StringComparison.Ordinal) || (number.Length > 0 && item.NumberKey == number))
            .OrderBy(item => item.FullName, TrComparer)
            .Take(30)
            .Select(item => new OpticalStudentCandidateDto(item.UserId, item.FullName, item.ClassName, item.SchoolNumber))
            .ToList();
    }

    // ── Eşleştirme ───────────────────────────────────────────────────────────

    private async Task<List<RosterStudent>> LoadRosterAsync(CancellationToken cancellationToken) =>
        (await dbContext.Students.AsNoTracking().ToListAsync(cancellationToken))
            .Select(item => new RosterStudent(item.UserId, item.FullName, item.ClassName.Trim(), item.SchoolNumber.Trim(), item.BranchId,
                NameKey(item.FullName), OpticalParser.NormalizeStudentNo(item.SchoolNumber)))
            .ToList();

    private static string NameKey(string? value) =>
        string.Join(' ', MessageParticipantKey.Compare(value).Split(' ', StringSplitOptions.RemoveEmptyEntries));

    private static (string Status, string? By, RosterStudent? Student, IReadOnlyList<RosterStudent> Candidates) Match(
        OpticalRawRow raw, IReadOnlyList<RosterStudent> roster, int nameFieldLength)
    {
        var number = OpticalParser.NormalizeStudentNo(raw.StudentNo);
        if (number.Length > 0)
        {
            var byNumber = roster.Where(item => item.NumberKey.Length > 0 && item.NumberKey == number).ToList();
            if (byNumber.Count == 1) return ("matched", "Okul no", byNumber[0], []);
            if (byNumber.Count > 1) return ("ambiguous", null, null, byNumber);
        }

        var name = NameKey(raw.Name);
        if (name.Length == 0) return ("unmatched", null, null, []);
        var byName = roster.Where(item => item.NameKey == name).ToList();
        if (byName.Count == 1) return ("matched", "Ad soyad", byName[0], []);
        if (byName.Count > 1)
        {
            // Aynı adlı öğrenciler: sınıf okunduysa ona göre daralt.
            var inClass = byName.Where(item => raw.ClassName.Length > 0 && TrComparer.Equals(item.ClassName, raw.ClassName)).ToList();
            return inClass.Count == 1 ? ("matched", "Ad soyad + sınıf", inClass[0], []) : ("ambiguous", null, null, byName);
        }

        // Optik ad alanı doluysa ad kesilmiş olabilir: baştan tutanlar aday olur ama onay ister.
        if (name.Length >= 3 && raw.Name.Length >= Math.Max(3, nameFieldLength - 1))
        {
            var byPrefix = roster.Where(item => item.NameKey.StartsWith(name, StringComparison.Ordinal)).Take(5).ToList();
            if (byPrefix.Count > 0) return ("ambiguous", null, null, byPrefix);
        }
        return ("unmatched", null, null, []);
    }
}
