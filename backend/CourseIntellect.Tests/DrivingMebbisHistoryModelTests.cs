using CourseIntellect.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

public sealed class DrivingMebbisHistoryModelTests
{
    [Fact]
    public void HistoryEvent_IsTenantScoped_IndexedAndBounded()
    {
        using var database = new TestDb();
        var entity = database.Context.Model.FindEntityType(typeof(DrivingMebbisHistoryEvent));
        Assert.NotNull(entity);

        Assert.Equal(200, entity!.FindProperty(nameof(DrivingMebbisHistoryEvent.Title))!.GetMaxLength());
        Assert.Equal(1000, entity.FindProperty(nameof(DrivingMebbisHistoryEvent.Description))!.GetMaxLength());
        Assert.Equal(150, entity.FindProperty(nameof(DrivingMebbisHistoryEvent.ActorName))!.GetMaxLength());
        Assert.Contains(entity.GetIndexes(), x => x.Properties.Select(p => p.Name)
            .SequenceEqual(new[] { "TenantId", "StudentDrivingProfileId", "OccurredAtUtc" }));
        Assert.Contains(entity.GetForeignKeys(), x => x.PrincipalEntityType.ClrType == typeof(StudentDrivingProfile)
            && x.DeleteBehavior == DeleteBehavior.Cascade);
    }
}
