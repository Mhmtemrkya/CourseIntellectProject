using CourseIntellect.Application.DTOs.StudyPlans;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

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

    private static StudyPlanStateDto ToDto(StudyPlanState entity) => new(
        entity.Id,
        entity.StudentName,
        entity.PlanItemsSerialized,
        entity.StreakCount,
        entity.XpPoints,
        entity.LastCompletedAt);
}
