using CourseIntellect.Application.DTOs.StudyPlans;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Nodes;

namespace CourseIntellect.Infrastructure.Services;

/// <summary>Çalışma programı; plan sahibinin kullanıcı kimliğiyle bulunur (ad yalnız gösterim).</summary>
public sealed class StudyPlanService(CourseIntellectDbContext dbContext) : IStudyPlanService
{
    public async Task<StudyPlanStateDto> GetOrCreateAsync(Guid studentUserId, string displayName, CancellationToken cancellationToken = default)
        => ToDto(await GetOrCreateEntityAsync(studentUserId, displayName, cancellationToken));

    public async Task<StudyPlanStateDto> UpdatePlanItemsAsync(Guid studentUserId, string displayName, string planItemsSerialized, CancellationToken cancellationToken = default)
    {
        // Önce kaydın var olduğundan emin ol (yarış korumalı oluşturma).
        await GetOrCreateEntityAsync(studentUserId, displayName, cancellationToken);

        // Tek alanlık güncelleme: öğrencinin aynı anda kazandığı XP/seri üzerine yazılmaz.
        // XP/seri istemciden ALINMAZ; yalnız sunucu ödüllerinden gelir.
        await dbContext.Set<StudyPlanState>()
            .Where(x => x.StudentUserId == studentUserId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.PlanItemsSerialized, planItemsSerialized), cancellationToken);

        dbContext.ChangeTracker.Clear();
        return ToDto(await dbContext.Set<StudyPlanState>().AsNoTracking().FirstAsync(x => x.StudentUserId == studentUserId, cancellationToken));
    }

    public async Task<StudyPlanStateDto> AddXpAsync(Guid studentUserId, string displayName, int amount, CancellationToken cancellationToken = default)
    {
        await GetOrCreateEntityAsync(studentUserId, displayName, cancellationToken);
        await dbContext.Set<StudyPlanState>()
            .Where(x => x.StudentUserId == studentUserId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.XpPoints, x => x.XpPoints + amount), cancellationToken);
        dbContext.ChangeTracker.Clear();
        return ToDto(await dbContext.Set<StudyPlanState>().AsNoTracking().FirstAsync(x => x.StudentUserId == studentUserId, cancellationToken));
    }

    public async Task<StudyPlanStateDto> AddItemAsync(Guid studentUserId, string displayName, StudyPlanItemRequest request, CancellationToken cancellationToken = default)
    {
        var entity = await GetOrCreateEntityAsync(studentUserId, displayName, cancellationToken);
        var items = ParseItems(entity.PlanItemsSerialized);
        var item = JsonNode.Parse(request.Item.GetRawText()) as JsonObject ?? new JsonObject();
        if (string.IsNullOrWhiteSpace(item["id"]?.ToString()))
        {
            item["id"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }

        items.Insert(0, item);
        entity.PlanItemsSerialized = items.ToJsonString();
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(entity);
    }

    public async Task<StudyPlanStateDto> SetItemDoneAsync(Guid studentUserId, string displayName, string itemId, bool done, CancellationToken cancellationToken = default)
    {
        var entity = await GetOrCreateEntityAsync(studentUserId, displayName, cancellationToken);
        var items = ParseItems(entity.PlanItemsSerialized);
        var changed = false;

        foreach (var node in items)
        {
            if (node is not JsonObject item || GetItemId(item) != itemId)
            {
                continue;
            }

            var wasDone = item["done"]?.GetValue<bool>() ?? false;
            item["done"] = done;
            changed = wasDone != done;
            if (changed)
            {
                ApplyCompletionReward(entity, completed: done);
            }
            break;
        }

        if (changed)
        {
            entity.PlanItemsSerialized = items.ToJsonString();
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return ToDto(entity);
    }

    public async Task<StudyPlanStateDto> DeleteItemAsync(Guid studentUserId, string displayName, string itemId, CancellationToken cancellationToken = default)
    {
        var entity = await GetOrCreateEntityAsync(studentUserId, displayName, cancellationToken);
        var items = ParseItems(entity.PlanItemsSerialized);

        for (var index = items.Count - 1; index >= 0; index--)
        {
            if (GetItemId(items[index]) != itemId)
            {
                continue;
            }

            items.RemoveAt(index);
            break;
        }

        entity.PlanItemsSerialized = items.ToJsonString();
        await dbContext.SaveChangesAsync(cancellationToken);
        return ToDto(entity);
    }

    private async Task<StudyPlanState> GetOrCreateEntityAsync(Guid studentUserId, string displayName, CancellationToken cancellationToken)
    {
        if (studentUserId == Guid.Empty) throw new ArgumentException("Plan sahibi belirsiz.", nameof(studentUserId));
        var name = (displayName ?? string.Empty).Trim();
        var entity = await dbContext.Set<StudyPlanState>()
            .FirstOrDefaultAsync(x => x.StudentUserId == studentUserId, cancellationToken);
        if (entity is not null)
        {
            // Ad değiştiyse gösterim adı güncellenir (anahtar etkilenmez).
            if (name.Length > 0 && entity.StudentName != name)
            {
                entity.StudentName = name;
                await dbContext.SaveChangesAsync(cancellationToken);
            }
            return entity;
        }

        try
        {
            entity = new StudyPlanState { StudentUserId = studentUserId, StudentName = name };
            await dbContext.Set<StudyPlanState>().AddAsync(entity, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            return entity;
        }
        catch (DbUpdateException)
        {
            // Eşzamanlı istek kaydı zaten oluşturdu.
            dbContext.ChangeTracker.Clear();
            return await dbContext.Set<StudyPlanState>().FirstAsync(x => x.StudentUserId == studentUserId, cancellationToken);
        }
    }

    private static JsonArray ParseItems(string? serialized)
    {
        if (string.IsNullOrWhiteSpace(serialized))
        {
            return new JsonArray();
        }

        try
        {
            return JsonNode.Parse(serialized) as JsonArray ?? new JsonArray();
        }
        catch
        {
            return new JsonArray();
        }
    }

    private static string? GetItemId(JsonNode? node)
    {
        return node is JsonObject item ? item["id"]?.ToString() : null;
    }

    private static void ApplyCompletionReward(StudyPlanState entity, bool completed)
    {
        // Plan maddesini işaretlemek XP VERMEZ: madde öğrencinin kendisi tarafından
        // eklenip işaretlendiği için sınırsız XP üretilebiliyordu. Yalnız seri güncellenir.
        if (!completed)
        {
            return;
        }

        // Seri Türkiye gününe göre sayılır: UTC günü kullanılınca gece 00:00–03:00
        // arasında tamamlanan görev önceki güne yazılıyor, seri yanlış kırılıyordu.
        var today = AssistantDates.TodayTr;
        var lastDate = entity.LastCompletedAt?.Date;

        if (lastDate is null)
        {
            entity.StreakCount = 1;
        }
        else
        {
            var diff = (today - lastDate.Value).Days;
            entity.StreakCount = diff switch
            {
                0 => entity.StreakCount == 0 ? 1 : entity.StreakCount,
                1 => entity.StreakCount + 1,
                _ => 1,
            };
        }

        entity.LastCompletedAt = today;
    }

    private static StudyPlanStateDto ToDto(StudyPlanState entity) => new(
        entity.Id,
        entity.StudentName,
        entity.PlanItemsSerialized,
        entity.StreakCount,
        entity.XpPoints,
        entity.LastCompletedAt);
}
