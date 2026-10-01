using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

public sealed class AttendanceStatusMatcherTests
{
    [Theory]
    [InlineData("Devamsiz", true)]
    [InlineData("Devamsız", true)]
    [InlineData("Gelmedi", true)]
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
}
