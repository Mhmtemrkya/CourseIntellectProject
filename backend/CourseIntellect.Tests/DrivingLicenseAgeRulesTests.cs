using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

/// <summary>
/// Ehliyet sınıfına göre asgari yaş (Karayolları Trafik Yönetmeliği). Kimlik
/// kontrolünde NVİ'ye ihtiyaç duymadan kesin sonuç veren kurallardan biridir.
/// </summary>
public sealed class DrivingLicenseAgeRulesTests
{
    private static readonly DateTime Now = new(2026, 7, 27, 12, 0, 0, DateTimeKind.Utc);

    [Theory]
    [InlineData("M", 16)]
    [InlineData("A1", 16)]
    [InlineData("A2", 18)]
    [InlineData("B", 18)]
    [InlineData("A", 20)]
    [InlineData("C", 21)]
    [InlineData("D", 24)]
    public void MinimumAge_MatchesRegulation(string licenseClass, int expected) =>
        Assert.Equal(expected, DrivingLicenseAgeRules.MinimumAgeFor(licenseClass));

    [Fact]
    public void UnknownClass_HasNoRule() =>
        Assert.Null(DrivingLicenseAgeRules.MinimumAgeFor("XYZ"));

    [Fact]
    public void Age_CountsBirthdayNotYetReached()
    {
        // 28 Temmuz doğumlu, bugün 27 Temmuz → henüz 18 olmamış.
        Assert.Equal(17, DrivingLicenseAgeRules.AgeAt(new DateTime(2008, 7, 28), Now));
        Assert.Equal(18, DrivingLicenseAgeRules.AgeAt(new DateTime(2008, 7, 27), Now));
    }

    [Fact]
    public void MeetsMinimumAge_BlocksUnderageBClass()
    {
        Assert.False(DrivingLicenseAgeRules.MeetsMinimumAge("B", new DateTime(2009, 1, 1), Now));
        Assert.True(DrivingLicenseAgeRules.MeetsMinimumAge("B", new DateTime(2008, 1, 1), Now));
    }

    [Fact]
    public void MeetsMinimumAge_AllowsSixteenForA1()
    {
        // B için yetersiz olan yaş, A1 için yeterlidir.
        var birth = new DateTime(2010, 1, 1);
        Assert.True(DrivingLicenseAgeRules.MeetsMinimumAge("A1", birth, Now));
        Assert.False(DrivingLicenseAgeRules.MeetsMinimumAge("B", birth, Now));
    }

    [Fact]
    public void MeetsMinimumAge_IsUndecidedForUnknownClass() =>
        Assert.Null(DrivingLicenseAgeRules.MeetsMinimumAge("", new DateTime(2000, 1, 1), Now));
}
