using CourseIntellect.Application.DTOs.Preference;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

/// <summary>
/// Gömülü ÖSYM verisinin gerçek Postgres şemasına yüklenmesi (benzersiz indeks, decimal hassasiyeti).
/// COURSE_INTELLECT_POSTGRES_TEST ayarlı değilse atlanır.
/// </summary>
public sealed class PreferenceRobotPostgresSmokeTests
{
    private static CourseIntellectDbContext NewContext()
    {
        var options = new DbContextOptionsBuilder<CourseIntellectDbContext>()
            .UseNpgsql(Environment.GetEnvironmentVariable("COURSE_INTELLECT_POSTGRES_TEST")!).Options;
        return new CourseIntellectDbContext(options);
    }

    [PostgreSqlFact("COURSE_INTELLECT_POSTGRES_TEST")]
    public async Task BuiltInData_LoadsOnce_AndSearchMatchesOfficialRow()
    {
        await using (var db = NewContext())
        {
            await new PreferenceRobotService(db).EnsureBuiltInDataAsync();
        }

        await using (var db = NewContext())
        {
            var service = new PreferenceRobotService(db);
            await service.EnsureBuiltInDataAsync();
            Assert.Equal(21602, await db.PreferencePrograms.CountAsync(item => item.Exam == "YKS" && item.Year == 2025));
            var result = await service.SearchAsync(new PreferenceSearchRequest("YKS", "SAY", 445m, null, null, null, null, "bilgisayar mühendisliği", 1000));
            var agu = Assert.Single(result.Items, item => item.Code == "106510077");
            Assert.Equal(442.53227m, agu.MinScore);
            Assert.Equal("Target", agu.Band);
        }
    }
}
