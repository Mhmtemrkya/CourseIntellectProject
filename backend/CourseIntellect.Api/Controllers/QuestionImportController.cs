using System.Globalization;
using System.IO.Compression;
using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using CourseIntellect.Api.Hubs;
using CourseIntellect.Application.DTOs.QuestionBank;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize(Roles = "Teacher,Admin")]
[Route("api/question-import")]
public sealed partial class QuestionImportController(
    IFileStorageService fileStorageService,
    IQuestionBankService questionBankService,
    CourseIntellectDbContext dbContext,
    IHubContext<QuestionImportHub> hubContext,
    IDocumentIntelligenceService documentIntelligence) : ControllerBase
{
    private const string SectionKey = "question-import-jobs";
    private const int MaxPreviewQuestions = 10000;

    private static readonly HashSet<string> SupportedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".docx", ".xlsx", ".csv", ".tsv", ".txt", ".zip", ".png", ".jpg", ".jpeg", ".webp"
    };

    [HttpPost("upload")]
    [RequestSizeLimit(10L * 1024 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 10L * 1024 * 1024 * 1024)]
    public async Task<IActionResult> Upload([FromForm] IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length <= 0)
        {
            return BadRequest(new { message = "Boş dosya yüklenemez." });
        }

        var extension = Path.GetExtension(file.FileName);
        if (!SupportedExtensions.Contains(extension))
        {
            return BadRequest(new { message = "Bu dosya tipi desteklenmiyor." });
        }

        await using var source = file.OpenReadStream();
        using var buffer = new MemoryStream();
        await source.CopyToAsync(buffer, cancellationToken);
        var bytes = buffer.ToArray();

        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        await using var storageStream = new MemoryStream(bytes);
        var asset = await fileStorageService.SaveAsync(
            storageStream,
            file.FileName,
            file.ContentType,
            "question-imports",
            baseUrl,
            cancellationToken);

        var now = DateTime.UtcNow;
        var job = new QuestionImportJobSnapshot
        {
            Id = Guid.NewGuid(),
            FileName = file.FileName,
            FileUrl = asset.FileUrl,
            ContentType = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
            SizeBytes = file.Length,
            UploadedAtUtc = now,
            UploadedBy = ResolveUserName(),
            UploadedByUsername = User.Identity?.Name ?? string.Empty,
            Status = "Analyzing",
            Progress = 12,
            EstimatedSeconds = Math.Max(5, (int)Math.Ceiling(file.Length / 250000d)),
            Logs =
            [
                new QuestionImportLogSnapshot(now, "Upload", "Dosya kalıcı depolamaya kaydedildi."),
                new QuestionImportLogSnapshot(now, "Analysis", "İçerik analizi başlatıldı.")
            ]
        };

        await SaveJobAsync(job, cancellationToken);
        await PublishProgressAsync(job, cancellationToken);

        var analysis = await AnalyzeFileAsync(file.FileName, bytes, cancellationToken);
        ApplyAnalysis(job, analysis);
        if (analysis.UsedOcr)
        {
            job.Logs.Add(new QuestionImportLogSnapshot(
                DateTime.UtcNow,
                "OCR",
                "Azure Document Intelligence ile metin ve düzen çıkarıldı."));
        }
        job.Status = job.Questions.Count > 0 ? "Ready" : "NeedsReview";
        job.Progress = 100;
        job.CompletedAtUtc = DateTime.UtcNow;
        job.Logs.Add(new QuestionImportLogSnapshot(
            job.CompletedAtUtc.Value,
            "Analysis",
            job.Questions.Count > 0
                ? $"{job.Questions.Count} soru analiz edilerek önizlemeye hazırlandı."
                : "Dosya saklandı; otomatik soru ayrıştırma için metin katmanı bulunamadı."));

        await SaveJobAsync(job, cancellationToken);
        await PublishProgressAsync(job, cancellationToken);
        return Ok(job);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var job = await FindJobAsync(id, cancellationToken);
        if (job is null)
        {
            return NotFound();
        }

        await PublishProgressAsync(job, cancellationToken);
        return Ok(job);
    }

    [HttpGet("history")]
    public async Task<IActionResult> History(CancellationToken cancellationToken)
    {
        var jobs = await LoadJobsAsync(cancellationToken);
        return Ok(jobs
            .OrderByDescending(item => item.UploadedAtUtc)
            .Select(item => new QuestionImportHistoryItem(
                item.Id,
                item.FileName,
                item.FileUrl,
                item.UploadedAtUtc,
                item.UploadedBy,
                item.Status,
                item.TotalQuestions,
                item.ImportedQuestionCount,
                item.FailedQuestionCount,
                item.SizeBytes))
            .ToList());
    }

    [HttpPut("{id:guid}/questions/{questionId:guid}")]
    public async Task<IActionResult> UpdateQuestion(Guid id, Guid questionId, [FromBody] QuestionImportQuestionUpdateRequest request, CancellationToken cancellationToken)
    {
        var jobs = await LoadJobsAsync(cancellationToken);
        var job = jobs.FirstOrDefault(item => item.Id == id);
        var question = job?.Questions.FirstOrDefault(item => item.Id == questionId);
        if (job is null || question is null)
        {
            return NotFound();
        }

        ApplyQuestionUpdate(question, request);
        job.UpdatedAtUtc = DateTime.UtcNow;
        job.Status = "Ready";
        job.Logs.Add(new QuestionImportLogSnapshot(DateTime.UtcNow, "Update", $"{question.Order}. soru güncellendi."));
        await SaveJobsAsync(jobs, cancellationToken);
        await PublishProgressAsync(job, cancellationToken);
        return Ok(question);
    }

    [HttpDelete("{id:guid}/questions/{questionId:guid}")]
    public async Task<IActionResult> DeleteQuestion(Guid id, Guid questionId, CancellationToken cancellationToken)
    {
        var jobs = await LoadJobsAsync(cancellationToken);
        var job = jobs.FirstOrDefault(item => item.Id == id);
        if (job is null)
        {
            return NotFound();
        }

        var removed = job.Questions.RemoveAll(item => item.Id == questionId);
        if (removed <= 0)
        {
            return NotFound();
        }

        ReorderQuestions(job);
        job.Status = "Ready";
        job.UpdatedAtUtc = DateTime.UtcNow;
        job.Logs.Add(new QuestionImportLogSnapshot(DateTime.UtcNow, "Delete", "Önizlemeden bir soru kaldırıldı."));
        await SaveJobsAsync(jobs, cancellationToken);
        await PublishProgressAsync(job, cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/questions/{questionId:guid}/duplicate")]
    public async Task<IActionResult> DuplicateQuestion(Guid id, Guid questionId, CancellationToken cancellationToken)
    {
        var jobs = await LoadJobsAsync(cancellationToken);
        var job = jobs.FirstOrDefault(item => item.Id == id);
        var source = job?.Questions.FirstOrDefault(item => item.Id == questionId);
        if (job is null || source is null)
        {
            return NotFound();
        }

        var clone = source.Clone();
        clone.Id = Guid.NewGuid();
        clone.Order = job.Questions.Count + 1;
        clone.ImportStatus = "Pending";
        job.Questions.Add(clone);
        job.Status = "Ready";
        job.UpdatedAtUtc = DateTime.UtcNow;
        job.Logs.Add(new QuestionImportLogSnapshot(DateTime.UtcNow, "Duplicate", $"{source.Order}. soru kopyalandı."));
        await SaveJobsAsync(jobs, cancellationToken);
        await PublishProgressAsync(job, cancellationToken);
        return Ok(clone);
    }

    [HttpPost("{id:guid}/bulk-update")]
    public async Task<IActionResult> BulkUpdate(Guid id, [FromBody] QuestionImportBulkUpdateRequest request, CancellationToken cancellationToken)
    {
        var jobs = await LoadJobsAsync(cancellationToken);
        var job = jobs.FirstOrDefault(item => item.Id == id);
        if (job is null)
        {
            return NotFound();
        }

        var selected = request.QuestionIds is { Count: > 0 }
            ? job.Questions.Where(item => request.QuestionIds.Contains(item.Id)).ToList()
            : job.Questions.ToList();

        foreach (var question in selected)
        {
            ApplyBulkUpdate(question, request);
        }

        job.Status = "Ready";
        job.UpdatedAtUtc = DateTime.UtcNow;
        job.Logs.Add(new QuestionImportLogSnapshot(DateTime.UtcNow, "BulkUpdate", $"{selected.Count} soru için kategori bilgileri güncellendi."));
        await SaveJobsAsync(jobs, cancellationToken);
        await PublishProgressAsync(job, cancellationToken);
        return Ok(job);
    }

    [HttpPost("{id:guid}/commit")]
    public async Task<IActionResult> Commit(Guid id, [FromBody] QuestionImportCommitRequest request, CancellationToken cancellationToken)
    {
        var jobs = await LoadJobsAsync(cancellationToken);
        var job = jobs.FirstOrDefault(item => item.Id == id);
        if (job is null)
        {
            return NotFound();
        }

        var selected = request.QuestionIds is { Count: > 0 }
            ? job.Questions.Where(item => request.QuestionIds.Contains(item.Id)).ToList()
            : job.Questions.ToList();

        if (selected.Count == 0)
        {
            return BadRequest(new { message = "Aktarılacak soru bulunamadı." });
        }

        var imported = new List<object>();
        var failed = 0;
        var setKey = $"import-{job.Id:N}";
        foreach (var question in selected)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(question.QuestionText))
                {
                    failed += 1;
                    question.ImportStatus = "Failed";
                    question.ImportError = "Soru metni boş.";
                    continue;
                }

                var created = await questionBankService.CreateQuestionAsync(new CreateQuestionBankItemRequest(
                    Normalize(question.Subject, "Genel"),
                    Normalize(question.Topic, "Genel"),
                    Normalize(question.Difficulty, "Orta"),
                    Normalize(question.Type, "Çoktan Seçmeli"),
                    question.QuestionText.Trim(),
                    ResolveUserName(),
                    question.ImageUrl,
                    "Top",
                    question.Options.Select(option => option.Text).Where(text => !string.IsNullOrWhiteSpace(text)).ToList(),
                    ResolveCorrectOptionIndex(question),
                    NormalizeClassTargets(question.Grade),
                    null,
                    null,
                    true,
                    question.Explanation,
                    null,
                    null,
                    JsonSerializer.Serialize(new
                    {
                        importId = job.Id,
                        sourceFile = job.FileName,
                        unit = question.Unit,
                        topic = question.Topic,
                        outcome = question.LearningOutcome,
                        points = question.Points,
                        target = request.Target
                    }),
                    "Published",
                    setKey,
                    job.FileName,
                    question.Order),
                    cancellationToken);

                question.ImportStatus = "Imported";
                question.ImportedQuestionBankItemId = created.Id;
                question.ImportError = null;
                imported.Add(new { sourceQuestionId = question.Id, questionBankItemId = created.Id });
            }
            catch (Exception ex)
            {
                failed += 1;
                question.ImportStatus = "Failed";
                question.ImportError = ex.Message;
            }
        }

        job.ImportedQuestionCount = job.Questions.Count(item => item.ImportStatus == "Imported");
        job.FailedQuestionCount = failed;
        job.Status = failed == 0 ? "Imported" : "PartiallyImported";
        job.ImportedAtUtc = DateTime.UtcNow;
        job.Logs.Add(new QuestionImportLogSnapshot(DateTime.UtcNow, "Commit", $"{imported.Count} soru soru bankasına aktarıldı."));

        await SaveJobsAsync(jobs, cancellationToken);
        await PublishProgressAsync(job, cancellationToken);
        return Ok(new QuestionImportCommitResponse(job.Id, job.Status, imported.Count, failed, imported));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteImport(Guid id, CancellationToken cancellationToken)
    {
        var jobs = await LoadJobsAsync(cancellationToken);
        var removed = jobs.RemoveAll(item => item.Id == id);
        if (removed <= 0)
        {
            return NotFound();
        }

        await SaveJobsAsync(jobs, cancellationToken);
        return NoContent();
    }

    private async Task<QuestionImportJobSnapshot?> FindJobAsync(Guid id, CancellationToken cancellationToken)
    {
        var jobs = await LoadJobsAsync(cancellationToken);
        return jobs.FirstOrDefault(item => item.Id == id);
    }

    private async Task SaveJobAsync(QuestionImportJobSnapshot job, CancellationToken cancellationToken)
    {
        var jobs = await LoadJobsAsync(cancellationToken);
        var index = jobs.FindIndex(item => item.Id == job.Id);
        if (index >= 0)
        {
            jobs[index] = job;
        }
        else
        {
            jobs.Add(job);
        }

        await SaveJobsAsync(jobs, cancellationToken);
    }

    private async Task<List<QuestionImportJobSnapshot>> LoadJobsAsync(CancellationToken cancellationToken)
    {
        return await CompatibilitySnapshotStore.LoadListAsync<QuestionImportJobSnapshot>(dbContext, SectionKey, cancellationToken);
    }

    private async Task SaveJobsAsync(IReadOnlyList<QuestionImportJobSnapshot> jobs, CancellationToken cancellationToken)
    {
        await CompatibilitySnapshotStore.SaveListAsync(dbContext, SectionKey, jobs, ResolveUserName(), cancellationToken);
    }

    private Task PublishProgressAsync(QuestionImportJobSnapshot job, CancellationToken cancellationToken)
    {
        return hubContext.Clients
            .Group(QuestionImportHub.BuildImportGroup(job.Id.ToString()))
            .SendAsync("QuestionImportProgress", job, cancellationToken);
    }

    private string ResolveUserName()
    {
        return User.FindFirstValue("name")
            ?? User.FindFirstValue(ClaimTypes.Name)
            ?? User.Identity?.Name
            ?? "Öğretmen";
    }

    private static void ApplyAnalysis(QuestionImportJobSnapshot job, QuestionImportAnalysisResult analysis)
    {
        job.ImageCount = analysis.ImageCount;
        job.TableCount = analysis.TableCount;
        job.FormulaCount = analysis.FormulaCount;
        job.RawTextPreview = TrimToLength(analysis.RawText, 4000);
        job.Questions = analysis.Questions.Take(MaxPreviewQuestions).ToList();
        ReorderQuestions(job);
    }

    private async Task<QuestionImportAnalysisResult> AnalyzeFileAsync(string fileName, byte[] bytes, CancellationToken cancellationToken)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return extension switch
        {
            ".csv" => AnalyzeDelimitedText(ReadText(bytes), fileName, ','),
            ".tsv" => AnalyzeDelimitedText(ReadText(bytes), fileName, '\t'),
            ".txt" => AnalyzePlainText(ReadText(bytes), fileName),
            ".xlsx" => AnalyzeDelimitedText(ExtractXlsxText(bytes), fileName, '\t'),
            ".docx" or ".pdf" or ".png" or ".jpg" or ".jpeg" or ".webp"
                => await AnalyzeWithOcrAsync(fileName, bytes, extension, cancellationToken),
            ".zip" => await AnalyzeZipAsync(bytes, cancellationToken),
            _ => new QuestionImportAnalysisResult(string.Empty, [], 0, 0, 0),
        };
    }

    // Azure DI yapılandırıldıysa temiz metin + düzen çıkarır; aksi halde
    // mevcut yerel çıkarıma (Word/PDF regex) güvenli şekilde düşer. Görsellerde
    // yerel OCR olmadığından Azure yoksa metin bulunamaz (NeedsReview).
    private async Task<QuestionImportAnalysisResult> AnalyzeWithOcrAsync(
        string fileName, byte[] bytes, string extension, CancellationToken cancellationToken)
    {
        var isImage = extension is ".png" or ".jpg" or ".jpeg" or ".webp";

        if (await documentIntelligence.IsEnabledAsync(cancellationToken))
        {
            var layout = await documentIntelligence.AnalyzeLayoutAsync(bytes, fileName, cancellationToken);
            if (layout.Succeeded && !string.IsNullOrWhiteSpace(layout.Text))
            {
                var parsed = AnalyzePlainText(layout.Text, fileName);
                return parsed with
                {
                    UsedOcr = true,
                    ImageCount = isImage ? Math.Max(1, parsed.ImageCount) : parsed.ImageCount,
                    TableCount = Math.Max(parsed.TableCount, layout.TableCount),
                };
            }
        }

        return extension switch
        {
            ".docx" => AnalyzePlainText(ExtractDocxText(bytes), fileName),
            ".pdf" => AnalyzePlainText(ExtractPdfText(bytes), fileName),
            _ => new QuestionImportAnalysisResult(string.Empty, [], 1, 0, 0),
        };
    }

    private async Task<QuestionImportAnalysisResult> AnalyzeZipAsync(byte[] bytes, CancellationToken cancellationToken)
    {
        using var stream = new MemoryStream(bytes);
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
        var questions = new List<QuestionImportQuestionSnapshot>();
        var raw = new StringBuilder();
        var imageCount = 0;
        var tableCount = 0;
        var formulaCount = 0;
        var usedOcr = false;

        foreach (var entry in archive.Entries)
        {
            var extension = Path.GetExtension(entry.FullName).ToLowerInvariant();
            if (entry.Length <= 0)
            {
                continue;
            }

            if (!SupportedExtensions.Contains(extension) || extension == ".zip")
            {
                continue;
            }

            using var entryStream = entry.Open();
            using var buffer = new MemoryStream();
            await entryStream.CopyToAsync(buffer, cancellationToken);
            var result = await AnalyzeFileAsync(entry.FullName, buffer.ToArray(), cancellationToken);
            raw.AppendLine(result.RawText);
            questions.AddRange(result.Questions);
            imageCount += result.ImageCount;
            tableCount += result.TableCount;
            formulaCount += result.FormulaCount;
            usedOcr = usedOcr || result.UsedOcr;
        }

        return new QuestionImportAnalysisResult(raw.ToString(), questions, imageCount, tableCount, formulaCount)
        {
            UsedOcr = usedOcr,
        };
    }

    private static QuestionImportAnalysisResult AnalyzeDelimitedText(string text, string fileName, char delimiter)
    {
        var rows = ParseDelimitedRows(text, delimiter);
        if (rows.Count <= 1)
        {
            return AnalyzePlainText(text, fileName);
        }

        var headers = rows[0].Select(NormalizeKey).ToList();
        var questionIndex = FindHeader(headers, "question", "questiontext", "soru", "sorumetni");
        if (questionIndex < 0)
        {
            return AnalyzePlainText(text, fileName);
        }

        var subjectIndex = FindHeader(headers, "subject", "ders", "course");
        var topicIndex = FindHeader(headers, "topic", "konu");
        var unitIndex = FindHeader(headers, "unit", "unite", "ünite");
        var gradeIndex = FindHeader(headers, "grade", "sinif", "sınıf");
        var difficultyIndex = FindHeader(headers, "difficulty", "zorluk");
        var correctIndex = FindHeader(headers, "correct", "answer", "dogrucevap", "doğrucevap");
        var outcomeIndex = FindHeader(headers, "outcome", "kazanim", "kazanım");
        var typeIndex = FindHeader(headers, "type", "sorutipi", "questiontype");
        var pointsIndex = FindHeader(headers, "points", "puan");

        var optionIndexes = headers
            .Select((header, index) => new { header, index })
            .Where(item => OptionHeaderRegex().IsMatch(item.header))
            .OrderBy(item => item.header)
            .Select(item => item.index)
            .ToList();

        var questions = new List<QuestionImportQuestionSnapshot>();
        for (var rowIndex = 1; rowIndex < rows.Count; rowIndex++)
        {
            var row = rows[rowIndex];
            var questionText = GetCell(row, questionIndex);
            if (string.IsNullOrWhiteSpace(questionText))
            {
                continue;
            }

            var options = optionIndexes
                .Select((index, optionOrder) => new QuestionImportOptionSnapshot(ToOptionLetter(optionOrder), GetCell(row, index), false))
                .Where(item => !string.IsNullOrWhiteSpace(item.Text))
                .ToList();
            var correct = NormalizeCorrectAnswer(GetCell(row, correctIndex));
            foreach (var option in options)
            {
                option.IsCorrect = string.Equals(option.Label, correct, StringComparison.OrdinalIgnoreCase);
            }

            questions.Add(new QuestionImportQuestionSnapshot
            {
                Id = Guid.NewGuid(),
                Order = questions.Count + 1,
                QuestionText = questionText.Trim(),
                Subject = Normalize(GetCell(row, subjectIndex), GuessSubject(fileName)),
                Grade = Normalize(GetCell(row, gradeIndex), "Tüm Sınıflar"),
                Unit = Normalize(GetCell(row, unitIndex), string.Empty),
                Topic = Normalize(GetCell(row, topicIndex), "Genel"),
                LearningOutcome = Normalize(GetCell(row, outcomeIndex), string.Empty),
                Difficulty = Normalize(GetCell(row, difficultyIndex), "Orta"),
                Type = Normalize(GetCell(row, typeIndex), options.Count > 0 ? "Çoktan Seçmeli" : "Açık Uçlu"),
                Points = ParseInt(GetCell(row, pointsIndex), 1),
                Options = options,
                CorrectAnswer = correct,
                ImportStatus = "Pending"
            });
        }

        return new QuestionImportAnalysisResult(text, questions, 0, CountTableHints(text), CountFormulaHints(text));
    }

    private static QuestionImportAnalysisResult AnalyzePlainText(string text, string fileName)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return new QuestionImportAnalysisResult(string.Empty, [], 0, 0, 0);
        }

        var cleanText = WebUtility.HtmlDecode(text)
            .Replace("\r\n", "\n")
            .Replace('\r', '\n');
        var lines = cleanText.Split('\n')
            .Select(line => Regex.Replace(line.Trim(), @"\s+", " "))
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .ToList();

        var blocks = SplitQuestionBlocks(lines);
        var questions = blocks
            .Select((block, index) => BuildQuestionFromBlock(block, index + 1, fileName))
            .Where(question => !string.IsNullOrWhiteSpace(question.QuestionText))
            .ToList();

        if (questions.Count == 0 && cleanText.Trim().Length > 12)
        {
            questions.Add(new QuestionImportQuestionSnapshot
            {
                Id = Guid.NewGuid(),
                Order = 1,
                QuestionText = TrimToLength(cleanText.Trim(), 2000),
                Subject = GuessSubject(fileName),
                Grade = "Tüm Sınıflar",
                Topic = "Genel",
                Difficulty = "Orta",
                Type = "Açık Uçlu",
                Points = 1,
                ImportStatus = "Pending"
            });
        }

        return new QuestionImportAnalysisResult(cleanText, questions, CountImageHints(cleanText), CountTableHints(cleanText), CountFormulaHints(cleanText));
    }

    private static List<List<string>> ParseDelimitedRows(string text, char delimiter)
    {
        var rows = new List<List<string>>();
        var row = new List<string>();
        var cell = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < text.Length; i++)
        {
            var ch = text[i];
            if (ch == '"')
            {
                if (inQuotes && i + 1 < text.Length && text[i + 1] == '"')
                {
                    cell.Append('"');
                    i += 1;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (!inQuotes && ch == delimiter)
            {
                row.Add(cell.ToString());
                cell.Clear();
                continue;
            }

            if (!inQuotes && (ch == '\n' || ch == '\r'))
            {
                if (ch == '\r' && i + 1 < text.Length && text[i + 1] == '\n') i += 1;
                row.Add(cell.ToString());
                cell.Clear();
                if (row.Any(value => !string.IsNullOrWhiteSpace(value)))
                {
                    rows.Add(row);
                }
                row = [];
                continue;
            }

            cell.Append(ch);
        }

        row.Add(cell.ToString());
        if (row.Any(value => !string.IsNullOrWhiteSpace(value)))
        {
            rows.Add(row);
        }

        return rows;
    }

    private static List<List<string>> SplitQuestionBlocks(IReadOnlyList<string> lines)
    {
        var blocks = new List<List<string>>();
        var current = new List<string>();

        foreach (var line in lines)
        {
            var startsQuestion = QuestionStartRegex().IsMatch(line);
            if (startsQuestion && current.Count > 0)
            {
                blocks.Add(current);
                current = [];
            }

            current.Add(line);
        }

        if (current.Count > 0)
        {
            blocks.Add(current);
        }

        if (blocks.Count <= 1)
        {
            blocks = [];
            current = [];
            foreach (var line in lines)
            {
                current.Add(line);
                if (line.EndsWith('?') && current.Count > 0)
                {
                    blocks.Add(current);
                    current = [];
                }
            }
            if (current.Count > 0) blocks.Add(current);
        }

        return blocks;
    }

    private static QuestionImportQuestionSnapshot BuildQuestionFromBlock(IReadOnlyList<string> block, int order, string fileName)
    {
        var options = new List<QuestionImportOptionSnapshot>();
        var questionLines = new List<string>();
        var correctAnswer = string.Empty;

        foreach (var rawLine in block)
        {
            var line = rawLine.Trim();
            var correctMatch = CorrectAnswerRegex().Match(line);
            if (correctMatch.Success)
            {
                correctAnswer = NormalizeCorrectAnswer(correctMatch.Groups[1].Value);
                continue;
            }

            var optionMatch = OptionLineRegex().Match(line);
            if (optionMatch.Success)
            {
                var label = optionMatch.Groups[1].Value.ToUpperInvariant();
                var optionText = optionMatch.Groups[2].Value.Trim();
                options.Add(new QuestionImportOptionSnapshot(label, optionText, false));
                continue;
            }

            questionLines.Add(QuestionStartRegex().Replace(line, string.Empty).Trim());
        }

        if (string.IsNullOrWhiteSpace(correctAnswer))
        {
            var marked = options.FirstOrDefault(option => option.Text.Contains('*', StringComparison.Ordinal));
            if (marked is not null)
            {
                correctAnswer = marked.Label;
                marked.Text = marked.Text.Replace("*", string.Empty).Trim();
            }
        }

        foreach (var option in options)
        {
            option.IsCorrect = !string.IsNullOrWhiteSpace(correctAnswer)
                && string.Equals(option.Label, correctAnswer, StringComparison.OrdinalIgnoreCase);
        }

        return new QuestionImportQuestionSnapshot
        {
            Id = Guid.NewGuid(),
            Order = order,
            QuestionText = string.Join(" ", questionLines).Trim(),
            Subject = GuessSubject(fileName),
            Grade = "Tüm Sınıflar",
            Unit = string.Empty,
            Topic = GuessTopic(fileName),
            LearningOutcome = string.Empty,
            Difficulty = "Orta",
            Type = options.Count > 0 ? "Çoktan Seçmeli" : "Açık Uçlu",
            Points = 1,
            Options = options,
            CorrectAnswer = correctAnswer,
            ImportStatus = "Pending"
        };
    }

    private static string ExtractDocxText(byte[] bytes)
    {
        using var stream = new MemoryStream(bytes);
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
        var entry = archive.GetEntry("word/document.xml");
        if (entry is null) return string.Empty;

        using var entryStream = entry.Open();
        var document = XDocument.Load(entryStream);
        XNamespace w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
        return string.Join("\n", document.Descendants(w + "p")
            .Select(paragraph => string.Concat(paragraph.Descendants(w + "t").Select(text => text.Value)).Trim())
            .Where(value => !string.IsNullOrWhiteSpace(value)));
    }

    private static string ExtractXlsxText(byte[] bytes)
    {
        using var stream = new MemoryStream(bytes);
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read);
        var sharedStrings = ReadSharedStrings(archive);
        var rows = new List<string>();
        XNamespace spreadsheet = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

        foreach (var entry in archive.Entries.Where(entry => entry.FullName.StartsWith("xl/worksheets/sheet", StringComparison.OrdinalIgnoreCase)))
        {
            using var entryStream = entry.Open();
            var document = XDocument.Load(entryStream);
            foreach (var row in document.Descendants(spreadsheet + "row"))
            {
                var cells = row.Elements(spreadsheet + "c")
                    .Select(cell => ReadCellValue(cell, sharedStrings, spreadsheet))
                    .ToList();
                rows.Add(string.Join("\t", cells));
            }
        }

        return string.Join("\n", rows);
    }

    private static List<string> ReadSharedStrings(ZipArchive archive)
    {
        var entry = archive.GetEntry("xl/sharedStrings.xml");
        if (entry is null) return [];

        XNamespace spreadsheet = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        using var stream = entry.Open();
        var document = XDocument.Load(stream);
        return document.Descendants(spreadsheet + "si")
            .Select(item => string.Concat(item.Descendants(spreadsheet + "t").Select(text => text.Value)))
            .ToList();
    }

    private static string ReadCellValue(XElement cell, IReadOnlyList<string> sharedStrings, XNamespace spreadsheet)
    {
        var type = cell.Attribute("t")?.Value;
        var raw = cell.Element(spreadsheet + "v")?.Value ?? cell.Element(spreadsheet + "is")?.Value ?? string.Empty;
        if (type == "s" && int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var index) && index >= 0 && index < sharedStrings.Count)
        {
            return sharedStrings[index];
        }

        return raw;
    }

    private static string ExtractPdfText(byte[] bytes)
    {
        var raw = Encoding.Latin1.GetString(bytes);
        var matches = PdfTextRegex().Matches(raw);
        if (matches.Count == 0)
        {
            return string.Empty;
        }

        return string.Join("\n", matches
            .Select(match => UnescapePdfText(match.Groups[1].Value))
            .Where(value => !string.IsNullOrWhiteSpace(value)));
    }

    private static string UnescapePdfText(string value)
    {
        return value
            .Replace(@"\(", "(")
            .Replace(@"\)", ")")
            .Replace(@"\n", "\n")
            .Replace(@"\r", "\n")
            .Replace(@"\t", "\t")
            .Replace(@"\\", @"\")
            .Trim();
    }

    private static string ReadText(byte[] bytes)
    {
        if (bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF)
        {
            return Encoding.UTF8.GetString(bytes, 3, bytes.Length - 3);
        }

        return Encoding.UTF8.GetString(bytes);
    }

    private static void ApplyQuestionUpdate(QuestionImportQuestionSnapshot question, QuestionImportQuestionUpdateRequest request)
    {
        question.QuestionText = Normalize(request.QuestionText, question.QuestionText);
        question.Subject = Normalize(request.Subject, question.Subject);
        question.Grade = Normalize(request.Grade, question.Grade);
        question.Unit = Normalize(request.Unit, question.Unit);
        question.Topic = Normalize(request.Topic, question.Topic);
        question.LearningOutcome = Normalize(request.LearningOutcome, question.LearningOutcome);
        question.Difficulty = Normalize(request.Difficulty, question.Difficulty);
        question.Type = Normalize(request.Type, question.Type);
        question.Points = request.Points ?? question.Points;
        question.CorrectAnswer = NormalizeCorrectAnswer(request.CorrectAnswer ?? question.CorrectAnswer);
        question.Explanation = request.Explanation ?? question.Explanation;
        question.ImageUrl = request.ImageUrl ?? question.ImageUrl;
        if (request.Options is not null)
        {
            question.Options = request.Options
                .Select((item, index) => new QuestionImportOptionSnapshot(
                    Normalize(item.Label, ToOptionLetter(index)),
                    Normalize(item.Text, string.Empty),
                    item.IsCorrect))
                .ToList();
        }

        if (question.Options.Count > 0 && !question.Options.Any(item => item.IsCorrect) && !string.IsNullOrWhiteSpace(question.CorrectAnswer))
        {
            foreach (var option in question.Options)
            {
                option.IsCorrect = string.Equals(option.Label, question.CorrectAnswer, StringComparison.OrdinalIgnoreCase);
            }
        }
    }

    private static void ApplyBulkUpdate(QuestionImportQuestionSnapshot question, QuestionImportBulkUpdateRequest request)
    {
        question.Subject = Normalize(request.Subject, question.Subject);
        question.Grade = Normalize(request.Grade, question.Grade);
        question.Unit = Normalize(request.Unit, question.Unit);
        question.Topic = Normalize(request.Topic, question.Topic);
        question.LearningOutcome = Normalize(request.LearningOutcome, question.LearningOutcome);
        question.Difficulty = Normalize(request.Difficulty, question.Difficulty);
        question.Type = Normalize(request.Type, question.Type);
        question.Points = request.Points ?? question.Points;
    }

    private static void ReorderQuestions(QuestionImportJobSnapshot job)
    {
        for (var index = 0; index < job.Questions.Count; index++)
        {
            job.Questions[index].Order = index + 1;
        }
        job.TotalQuestions = job.Questions.Count;
    }

    private static int? ResolveCorrectOptionIndex(QuestionImportQuestionSnapshot question)
    {
        var option = question.Options.FirstOrDefault(item => item.IsCorrect);
        if (option is not null)
        {
            return question.Options.IndexOf(option);
        }

        if (string.IsNullOrWhiteSpace(question.CorrectAnswer))
        {
            return null;
        }

        var index = question.Options.FindIndex(item => string.Equals(item.Label, question.CorrectAnswer, StringComparison.OrdinalIgnoreCase));
        return index >= 0 ? index : null;
    }

    private static IReadOnlyList<string> NormalizeClassTargets(string? grade)
    {
        return string.IsNullOrWhiteSpace(grade) || grade.Equals("Tüm Sınıflar", StringComparison.OrdinalIgnoreCase)
            ? ["Tüm Sınıflar"]
            : [grade.Trim()];
    }

    private static string GetCell(IReadOnlyList<string> row, int index)
    {
        return index >= 0 && index < row.Count ? row[index] : string.Empty;
    }

    private static int FindHeader(IReadOnlyList<string> headers, params string[] keys)
    {
        for (var index = 0; index < headers.Count; index++)
        {
            if (keys.Any(key => headers[index] == NormalizeKey(key)))
            {
                return index;
            }
        }

        return -1;
    }

    private static string NormalizeKey(string? value)
    {
        return CompatibilitySnapshotStore.NormalizeText(value)
            .Replace("_", string.Empty)
            .Replace(".", string.Empty);
    }

    private static string NormalizeCorrectAnswer(string? value)
    {
        var trimmed = (value ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(trimmed)) return string.Empty;
        var match = Regex.Match(trimmed, "[A-Ea-e]");
        return match.Success ? match.Value.ToUpperInvariant() : trimmed;
    }

    private static string Normalize(string? value, string fallback)
    {
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }

    private static int ParseInt(string? value, int fallback)
    {
        return int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed) ? parsed : fallback;
    }

    private static string TrimToLength(string value, int maxLength)
    {
        return value.Length <= maxLength ? value : value[..maxLength];
    }

    private static string GuessSubject(string fileName)
    {
        var key = CompatibilitySnapshotStore.NormalizeText(Path.GetFileNameWithoutExtension(fileName));
        if (key.Contains("mat")) return "Matematik";
        if (key.Contains("turk")) return "Türkçe";
        if (key.Contains("fen")) return "Fen Bilimleri";
        if (key.Contains("ing")) return "İngilizce";
        if (key.Contains("sosyal")) return "Sosyal Bilgiler";
        return "Genel";
    }

    private static string GuessTopic(string fileName)
    {
        var name = Path.GetFileNameWithoutExtension(fileName).Replace('-', ' ').Replace('_', ' ').Trim();
        return string.IsNullOrWhiteSpace(name) ? "Genel" : name;
    }

    private static string ToOptionLetter(int index)
    {
        return ((char)('A' + Math.Clamp(index, 0, 25))).ToString();
    }

    private static int CountImageHints(string text) => Regex.Matches(text, @"\b(görsel|resim|şekil|grafik|image|figure)\b", RegexOptions.IgnoreCase).Count;
    private static int CountTableHints(string text) => Regex.Matches(text, @"\b(tablo|table)\b|\t", RegexOptions.IgnoreCase).Count;
    private static int CountFormulaHints(string text) => Regex.Matches(text, @"(\^|√|∫|lim|x²|x\^|frac|sqrt|=|≤|≥)", RegexOptions.IgnoreCase).Count;

    [GeneratedRegex(@"^\s*(\d{1,4})[\.\)]\s+")]
    private static partial Regex QuestionStartRegex();

    [GeneratedRegex(@"^\s*([A-Ea-e])[\)\.\-:]\s*(.+)$")]
    private static partial Regex OptionLineRegex();

    [GeneratedRegex(@"(?:doğru|dogru|correct)\s*(?:cevap|answer)?\s*[:\-]?\s*([A-Ea-e])", RegexOptions.IgnoreCase)]
    private static partial Regex CorrectAnswerRegex();

    [GeneratedRegex(@"^option[a-e]$|^secenek[a-e]$|^şık[a-e]$|^[a-e]$", RegexOptions.IgnoreCase)]
    private static partial Regex OptionHeaderRegex();

    [GeneratedRegex(@"\(([^()\r\n]{2,240})\)\s*T[Jj]")]
    private static partial Regex PdfTextRegex();
}

public sealed record QuestionImportHistoryItem(
    Guid Id,
    string FileName,
    string FileUrl,
    DateTime UploadedAtUtc,
    string UploadedBy,
    string Status,
    int TotalQuestions,
    int ImportedQuestionCount,
    int FailedQuestionCount,
    long SizeBytes);

public sealed record QuestionImportOptionUpdateRequest(string? Label, string? Text, bool IsCorrect);

public sealed record QuestionImportQuestionUpdateRequest(
    string? QuestionText,
    string? Subject,
    string? Grade,
    string? Unit,
    string? Topic,
    string? LearningOutcome,
    string? Difficulty,
    string? Type,
    int? Points,
    string? CorrectAnswer,
    string? Explanation,
    string? ImageUrl,
    IReadOnlyList<QuestionImportOptionUpdateRequest>? Options);

public sealed record QuestionImportBulkUpdateRequest(
    IReadOnlyList<Guid>? QuestionIds,
    string? Subject,
    string? Grade,
    string? Unit,
    string? Topic,
    string? LearningOutcome,
    string? Difficulty,
    string? Type,
    int? Points);

public sealed record QuestionImportCommitRequest(IReadOnlyList<Guid>? QuestionIds, string? Target);

public sealed record QuestionImportCommitResponse(Guid ImportId, string Status, int ImportedCount, int FailedCount, IReadOnlyList<object> Items);

internal sealed record QuestionImportAnalysisResult(
    string RawText,
    List<QuestionImportQuestionSnapshot> Questions,
    int ImageCount,
    int TableCount,
    int FormulaCount)
{
    public bool UsedOcr { get; init; }
}

public sealed class QuestionImportJobSnapshot
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public DateTime UploadedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public DateTime? ImportedAtUtc { get; set; }
    public string UploadedBy { get; set; } = string.Empty;
    public string UploadedByUsername { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public int Progress { get; set; }
    public int TotalQuestions { get; set; }
    public int ImageCount { get; set; }
    public int TableCount { get; set; }
    public int FormulaCount { get; set; }
    public int EstimatedSeconds { get; set; }
    public int ImportedQuestionCount { get; set; }
    public int FailedQuestionCount { get; set; }
    public string? RawTextPreview { get; set; }
    public List<QuestionImportQuestionSnapshot> Questions { get; set; } = [];
    public List<QuestionImportLogSnapshot> Logs { get; set; } = [];
}

public sealed record QuestionImportLogSnapshot(DateTime CreatedAtUtc, string Type, string Message);

public sealed class QuestionImportQuestionSnapshot
{
    public Guid Id { get; set; }
    public int Order { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public string Subject { get; set; } = "Genel";
    public string Grade { get; set; } = "Tüm Sınıflar";
    public string Unit { get; set; } = string.Empty;
    public string Topic { get; set; } = "Genel";
    public string LearningOutcome { get; set; } = string.Empty;
    public string Difficulty { get; set; } = "Orta";
    public string Type { get; set; } = "Çoktan Seçmeli";
    public int Points { get; set; } = 1;
    public string CorrectAnswer { get; set; } = string.Empty;
    public string? Explanation { get; set; }
    public string? ImageUrl { get; set; }
    public string ImportStatus { get; set; } = "Pending";
    public Guid? ImportedQuestionBankItemId { get; set; }
    public string? ImportError { get; set; }
    public List<QuestionImportOptionSnapshot> Options { get; set; } = [];

    public QuestionImportQuestionSnapshot Clone()
    {
        return new QuestionImportQuestionSnapshot
        {
            Id = Id,
            Order = Order,
            QuestionText = QuestionText,
            Subject = Subject,
            Grade = Grade,
            Unit = Unit,
            Topic = Topic,
            LearningOutcome = LearningOutcome,
            Difficulty = Difficulty,
            Type = Type,
            Points = Points,
            CorrectAnswer = CorrectAnswer,
            Explanation = Explanation,
            ImageUrl = ImageUrl,
            ImportStatus = ImportStatus,
            ImportedQuestionBankItemId = ImportedQuestionBankItemId,
            ImportError = ImportError,
            Options = Options.Select(option => new QuestionImportOptionSnapshot(option.Label, option.Text, option.IsCorrect)).ToList()
        };
    }
}

public sealed class QuestionImportOptionSnapshot(string label, string text, bool isCorrect)
{
    public string Label { get; set; } = label;
    public string Text { get; set; } = text;
    public bool IsCorrect { get; set; } = isCorrect;
}
