using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

public sealed class AttendanceStatusMatcherTests
{
    [Theory]
    [InlineData("Devamsiz", true)]
    [InlineData("Devamsız", true)]
    [InlineData("Gelmedi", true)]
    [InlineData("absent", true)]
    [InlineData("Geldi", false)]
    [InlineData("present", false)]
    [InlineData("Katildi", false)]
    [InlineData("Gec", false)]
    [InlineData("Izinli", false)]
    [InlineData(null, false)]
    public void IsAbsent_recognises_canonical_absence(string? status, bool expected) =>
        Assert.Equal(expected, AttendanceStatusMatcher.IsAbsent(status));

    [Theory]
    [InlineData("Gec", true)]
    [InlineData("Geç", true)]
    [InlineData("Devamsiz", false)]
    [InlineData("Katildi", false)]
    public void IsLate_recognises_canonical_lateness(string status, bool expected) =>
        Assert.Equal(expected, AttendanceStatusMatcher.IsLate(status));

    [Theory]
    [InlineData("Geldi", "Katildi")]
    [InlineData("Katıldı", "Katildi")]
    [InlineData("present", "Katildi")]
    [InlineData("Gelmedi", "Devamsiz")]
    [InlineData("Devamsız", "Devamsiz")]
    [InlineData("Geç Geldi", "Gec")]
    [InlineData("İzinli", "Izinli")]
    [InlineData("Bilinmeyen", "Bilinmeyen")]
    public void Canonicalize_maps_legacy_spellings(string status, string expected) =>
        Assert.Equal(expected, AttendanceStatusMatcher.Canonicalize(status));

    [Theory]
    [InlineData("Katildi", true)]
    [InlineData("Geldi", true)]
    [InlineData("Gec", true)]
    [InlineData("Izinli", true)]
    [InlineData("Devamsiz", false)]
    [InlineData("Gelmedi", false)]
    public void IsAttended_counts_present_late_and_excused(string status, bool expected) =>
        Assert.Equal(expected, AttendanceStatusMatcher.IsAttended(status));

    [Fact]
    public void Sql_status_lists_agree_with_matcher()
    {
        Assert.All(AttendanceStatusMatcher.AbsentStatuses, status => Assert.True(AttendanceStatusMatcher.IsAbsent(status), status));
        Assert.All(AttendanceStatusMatcher.AttendedStatuses, status => Assert.True(AttendanceStatusMatcher.IsAttended(status), status));
    }
}
