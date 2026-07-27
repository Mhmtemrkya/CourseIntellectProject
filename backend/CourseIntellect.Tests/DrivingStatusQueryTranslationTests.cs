using CourseIntellect.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

/// <summary>
/// Durum kümelerinin veritabanı sorgusunda kullanılabilmesinin sözleşmesi.
/// Dönem Açma Sihirbazı canlıda 500 veriyordu: <c>IReadOnlySet&lt;T&gt;.Contains</c>
/// EF Core tarafından SQL'e çevrilemiyor ve sorgu çalışma anında patlıyordu.
/// </summary>
public sealed class DrivingStatusQueryTranslationTests
{
    [Fact]
    public void OpenStatuses_AreTranslatableInsideDatabaseQuery()
    {
        using var db = new TestDb();

        // Çeviri başarısızsa ToQueryString() InvalidOperationException fırlatır.
        var sql = db.Context.StudentDrivingProfiles
            .Where(x => DrivingStudentStatuses.OpenList.Contains(x.Status))
            .ToQueryString();

        Assert.Contains("Status", sql, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void TheoryEnrollableStatuses_AreTranslatableInsideDatabaseQuery()
    {
        using var db = new TestDb();

        var sql = db.Context.StudentDrivingProfiles
            .Where(x => DrivingStudentStatuses.TheoryEnrollableList.Contains(x.Status))
            .ToQueryString();

        Assert.Contains("Status", sql, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void SchedulableStatuses_AreTranslatableInsideDatabaseQuery()
    {
        using var db = new TestDb();

        var sql = db.Context.StudentDrivingProfiles
            .Where(x => DrivingStudentStatuses.SchedulableList.Contains(x.Status))
            .ToQueryString();

        Assert.Contains("Status", sql, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ListVariants_MatchTheirSets()
    {
        Assert.Equal(DrivingStudentStatuses.Open.OrderBy(x => x), DrivingStudentStatuses.OpenList.OrderBy(x => x));
        Assert.Equal(DrivingStudentStatuses.TheoryEnrollable.OrderBy(x => x), DrivingStudentStatuses.TheoryEnrollableList.OrderBy(x => x));
        Assert.Equal(DrivingStudentStatuses.Schedulable.OrderBy(x => x), DrivingStudentStatuses.SchedulableList.OrderBy(x => x));
    }
}
