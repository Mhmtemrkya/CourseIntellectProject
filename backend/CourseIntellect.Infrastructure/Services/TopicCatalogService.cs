using System.Globalization;
using System.Text.Json;
using CourseIntellect.Application.DTOs.OpticalExams;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Services;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>
/// Ders konusu listesi (optik deneme cevap anahtarı ve soru stüdyosu ortak kullanır): hazır katalog
/// (<see cref="OpticalTopicCatalog"/>), kurumun eklediği konular ve kurumda daha önce yazılmış konular
/// (deneme cevap anahtarları + soru bankası). Konular kayıtlarda düz metin kalır; bu servis yalnız seçim listesini besler.
/// </summary>
public sealed class TopicCatalogService(CourseIntellectDbContext dbContext) : ITopicCatalogService
{
    private static readonly CultureInfo Tr = CultureInfo.GetCultureInfo("tr-TR");
    private static readonly StringComparer TrComparer = StringComparer.Create(Tr, ignoreCase: true);
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private const int MaxTopicLength = 150;

    public async Task<OpticalTopicCatalogDto> GetTopicsAsync(string? level, IReadOnlyList<string> subjects, CancellationToken cancellationToken = default)
    {
        var levelKey = OpticalTopicCatalog.IsLevel(level) ? level! : string.Empty;
        var names = subjects.Select(item => (item ?? string.Empty).Trim()).Where(item => item.Length > 0).Distinct().Take(30).ToList();

        var custom = await dbContext.OpticalCustomTopics.AsNoTracking()
            .Where(item => names.Contains(item.Subject))
            .OrderBy(item => item.Name)
            .ToListAsync(cancellationToken);
        // Eski serbest kayıtlar: kurumun denemelerinde ve soru bankasında yazılmış konular (listede olmayanlar ayrıca gösterilir).
        var used = new Dictionary<string, Dictionary<string, string>>(StringComparer.Ordinal);
        void Use(string subject, string topic)
        {
            if (string.IsNullOrWhiteSpace(topic)) return;
            var bucket = used.TryGetValue(subject, out var existing) ? existing : used[subject] = new(StringComparer.Ordinal);
            bucket.TryAdd(OpticalTopicCatalog.Fold(topic), topic.Trim());
        }
        var keysJson = await dbContext.OpticalExams.AsNoTracking().Select(item => item.KeysJson).ToListAsync(cancellationToken);
        foreach (var json in keysJson)
        {
            List<OpticalAnswerKeyDto> keys;
            try { keys = JsonSerializer.Deserialize<List<OpticalAnswerKeyDto>>(json, Json) ?? []; }
            catch (JsonException) { continue; }
            foreach (var subject in keys.SelectMany(key => key.Subjects).Where(item => names.Contains(item.Subject)))
                foreach (var topic in subject.Topics) Use(subject.Subject, topic);
        }
        var bankTopics = await dbContext.QuestionBankItems.AsNoTracking()
            .Where(item => names.Contains(item.Subject) && item.Topic != string.Empty)
            .Select(item => new { item.Subject, item.Topic }).Distinct().Take(2000)
            .ToListAsync(cancellationToken);
        foreach (var item in bankTopics) Use(item.Subject, item.Topic);

        var result = names.Select(subject =>
        {
            var groups = OpticalTopicCatalog.For(levelKey, subject);
            // Seviye seçiliyken kurumun o seviyeye ve "her seviye"ye eklediği konular; seviye yoksa hepsi.
            var mine = custom.Where(item => item.Subject == subject && (levelKey.Length == 0 || item.Level.Length == 0 || item.Level == levelKey))
                .Select(ToTopicDto).ToList();
            var known = new HashSet<string>(groups.SelectMany(group => group.Topics).Concat(mine.Select(item => item.Name)).Select(OpticalTopicCatalog.Fold), StringComparer.Ordinal);
            // Seviye seçiliyken başka seviyenin hazır konusu "daha önce kullanılan"a düşmesin.
            var anyLevel = OpticalTopicCatalog.For(null, subject).SelectMany(group => group.Topics).Select(OpticalTopicCatalog.Fold).ToHashSet(StringComparer.Ordinal);
            var legacy = used.TryGetValue(subject, out var bucket)
                ? bucket.Where(pair => !known.Contains(pair.Key) && !anyLevel.Contains(pair.Key) && !custom.Any(item => item.Subject == subject && item.NormalizedName == pair.Key))
                    .Select(pair => pair.Value).OrderBy(item => item, TrComparer).ToList()
                : [];
            return new OpticalSubjectTopicsDto(subject, groups.Select(group => new OpticalTopicGroupDto(group.Label, group.Topics)).ToList(), mine, legacy);
        }).ToList();

        return new OpticalTopicCatalogDto(levelKey,
            OpticalTopicCatalog.Levels.Select(item => new OpticalTopicLevelDto(item.Key, item.Label)).ToList(), result);
    }

    public async Task<AddOpticalTopicResultDto> AddTopicAsync(AddOpticalTopicRequest request, Guid? userId, CancellationToken cancellationToken = default)
    {
        var subject = (request.Subject ?? string.Empty).Trim();
        if (subject.Length is 0 or > 100) throw new ArgumentException("Ders adı geçersiz.");
        var level = (request.Level ?? string.Empty).Trim();
        if (level.Length > 0 && !OpticalTopicCatalog.IsLevel(level)) throw new ArgumentException("Seviye geçersiz (5, 6, 7, LGS, TYT, AYT ya da YDT).");
        var name = CleanTopic(request.Name);
        if (name.Length == 0) throw new ArgumentException("Konu adı boş olamaz.");
        if (name.Length > MaxTopicLength) throw new ArgumentException($"Konu adı en fazla {MaxTopicLength} karakter olabilir.");
        var key = OpticalTopicCatalog.Fold(name);

        // Hazır listede (bu seviyede ya da seviye yoksa herhangi bir seviyede) varsa listedeki yazım kullanılır.
        var builtin = OpticalTopicCatalog.For(level, subject).SelectMany(group => group.Topics)
            .FirstOrDefault(topic => OpticalTopicCatalog.Fold(topic) == key);
        if (builtin is not null) return new AddOpticalTopicResultDto("exists-builtin", builtin, null);

        var existing = await dbContext.OpticalCustomTopics.AsNoTracking()
            .Where(item => item.Subject == subject && item.NormalizedName == key && (item.Level == level || item.Level == string.Empty))
            .FirstOrDefaultAsync(cancellationToken);
        if (existing is not null) return new AddOpticalTopicResultDto("exists-custom", existing.Name, ToTopicDto(existing));

        var entity = new OpticalCustomTopic { Subject = subject, Level = level, Name = name, NormalizedName = key, CreatedByUserId = userId };
        dbContext.OpticalCustomTopics.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        return new AddOpticalTopicResultDto("created", entity.Name, ToTopicDto(entity));
    }

    /// <summary>Yalnız seçim listesinden kaldırır; bu konuyu kullanan denemeler ve sonuçlar değişmez.</summary>
    public async Task DeleteTopicAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var entity = await dbContext.OpticalCustomTopics.FirstOrDefaultAsync(item => item.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException("Konu bulunamadı.");
        dbContext.OpticalCustomTopics.Remove(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Kontrol karakterleri atılır, boşluklar sadeleşir.</summary>
    private static string CleanTopic(string? value) =>
        string.Join(' ', new string((value ?? string.Empty).Select(ch => char.IsControl(ch) ? ' ' : ch).ToArray())
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));

    private static OpticalCustomTopicDto ToTopicDto(OpticalCustomTopic item) => new(item.Id, item.Subject, item.Level, item.Name);
}
