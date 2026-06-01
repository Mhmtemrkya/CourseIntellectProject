using CourseIntellect.Application.DTOs.StudyPlans;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Nodes;

namespace CourseIntellect.Infrastructure.Services;

public sealed class StudyPlanService(CourseIntellectDbContext dbContext) : IStudyPlanService
{
    public async Task<StudyPlanStateDto> GetOrCreateAsync(string studentName, CancellationToken cancellationToken = default)
    {
        var normalized = studentName.Trim();
        var entity = await dbContext.Set<StudyPlanState>()
            .FirstOrDefaultAsync(x => x.StudentName == normalized, cancellationToken);

        if (entity is null)
        {
            try
            {
                entity = new StudyPlanState
                {
                    StudentName = normalized,
                };
                await dbContext.Set<StudyPlanState>().AddAsync(entity, cancellationToken);
                await dbContext.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                // Concurrent request already inserted this student — clear the failed entry
                // from the change tracker and fetch the existing row.
                dbContext.ChangeTracker.Clear();
                entity = await dbContext.Set<StudyPlanState>()
                    .FirstAsync(x => x.StudentName == normalized, cancellationToken);
            }
        }

        return ToDto(entity);
    }

    public async Task<StudyPlanStateDto> UpdateAsync(UpdateStudyPlanStateRequest request, CancellationToken cancellationToken = default)
    {
        var normalized = request.StudentName.Trim();
        var entity = await dbContext.Set<StudyPlanState>()
            .FirstOrDefaultAsync(x => x.StudentName == normalized, cancellationToken);

        if (entity is null)
        {
            try
            {
                entity = new StudyPlanState
                {
                    StudentName = normalized,
                };
                await dbContext.Set<StudyPlanState>().AddAsync(entity, cancellationToken);
                await dbContext.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                dbContext.ChangeTracker.Clear();
                entity = await dbContext.Set<StudyPlanState>()
                    .FirstAsync(x => x.StudentName == normalized, cancellationToken);
            }
        }

        entity.PlanItemsSerialized = request.PlanItemsSerialized;
        entity.StreakCount = request.StreakCount;
        entity.XpPoints = request.XpPoints;
        entity.LastCompletedAt = request.LastCompletedAt;
        await dbContext.SaveChangesAsync(cancellationToken);

        return ToDto(entity);
    }

    public async Task<StudyPlanStateDto> AddXpAsync(string studentName, int amount, CancellationToken cancellationToken = default)
    {
        var normalized = studentName.Trim();
        var updatedRows = await dbContext.Set<StudyPlanState>()
            .Where(x => x.StudentName == normalized)
            .ExecuteUpdateAsync(
                setters => setters.SetProperty(x => x.XpPoints, x => x.XpPoints + amount),
                cancellationToken);

        if (updatedRows == 0)
        {
            try
            {
                var createdEntity = new StudyPlanState
                {
                    StudentName = normalized,
                    XpPoints = amount,
                };
                await dbContext.Set<StudyPlanState>().AddAsync(createdEntity, cancellationToken);
                await dbContext.SaveChangesAsync(cancellationToken);
                return ToDto(createdEntity);
            }
            catch (DbUpdateException)
            {
                dbContext.ChangeTracker.Clear();
                await dbContext.Set<StudyPlanState>()
                    .Where(x => x.StudentName == normalized)
                    .ExecuteUpdateAsync(
                        setters => setters.SetProperty(x => x.XpPoints, x => x.XpPoints + amount),
                        cancellationToken);
            }
        }

        var entity = await dbContext.Set<StudyPlanState>()
            .FirstAsync(x => x.StudentName == normalized, cancellationToken);
        return ToDto(entity);
    }

    public async Task<StudyPlanStateDto> AddItemAsync(string studentName, StudyPlanItemRequest request, CancellationToken cancellationToken = default)
    {
        var entity = await GetOrCreateEntityAsync(studentName, cancellationToken);
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

    public async Task<StudyPlanStateDto> SetItemDoneAsync(string studentName, string itemId, bool done, CancellationToken cancellationToken = default)
    {
        var entity = await GetOrCreateEntityAsync(studentName, cancellationToken);
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

    public async Task<StudyPlanStateDto> DeleteItemAsync(string studentName, string itemId, CancellationToken cancellationToken = default)
    {
        var entity = await GetOrCreateEntityAsync(studentName, cancellationToken);
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

    private async Task<StudyPlanState> GetOrCreateEntityAsync(string studentName, CancellationToken cancellationToken)
    {
        var normalized = studentName.Trim();
        var entity = await dbContext.Set<StudyPlanState>()
            .FirstOrDefaultAsync(x => x.StudentName == normalized, cancellationToken);

        if (entity is not null)
        {
            return entity;
        }

        try
        {
            entity = new StudyPlanState { StudentName = normalized };
            await dbContext.Set<StudyPlanState>().AddAsync(entity, cancellationToken);
            await dbContext.SaveChangesAsync(cancellationToken);
            return entity;
        }
        catch (DbUpdateException)
        {
            dbContext.ChangeTracker.Clear();
            return await dbContext.Set<StudyPlanState>()
                .FirstAsync(x => x.StudentName == normalized, cancellationToken);
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
        if (!completed)
        {
            entity.XpPoints = Math.Max(0, entity.XpPoints - 25);
            return;
        }

        var today = DateTime.UtcNow.Date;
        var lastDate = entity.LastCompletedAt?.Date;
        entity.XpPoints += 25;

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
