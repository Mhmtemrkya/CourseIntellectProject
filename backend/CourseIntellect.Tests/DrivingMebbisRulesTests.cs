using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

public sealed class DrivingMebbisRulesTests
{
    [Theory]
    [InlineData(DrivingMebbisWorkStatus.Preparing, DrivingMebbisWorkStatus.Ready)]
    [InlineData(DrivingMebbisWorkStatus.Ready, DrivingMebbisWorkStatus.EntryPending)]
    [InlineData(DrivingMebbisWorkStatus.EntryPending, DrivingMebbisWorkStatus.Entered)]
    [InlineData(DrivingMebbisWorkStatus.Entered, DrivingMebbisWorkStatus.Verified)]
    [InlineData(DrivingMebbisWorkStatus.Error, DrivingMebbisWorkStatus.CorrectionPending)]
    [InlineData(DrivingMebbisWorkStatus.CorrectionPending, DrivingMebbisWorkStatus.Ready)]
    public void ExpectedTransitions_AreAllowed(DrivingMebbisWorkStatus current, DrivingMebbisWorkStatus target)
        => Assert.True(DrivingMebbisRules.CanTransition(current, target));

    [Theory]
    [InlineData(DrivingMebbisWorkStatus.Preparing, DrivingMebbisWorkStatus.Verified)]
    [InlineData(DrivingMebbisWorkStatus.Ready, DrivingMebbisWorkStatus.Verified)]
    [InlineData(DrivingMebbisWorkStatus.Verified, DrivingMebbisWorkStatus.Entered)]
    [InlineData(DrivingMebbisWorkStatus.Error, DrivingMebbisWorkStatus.Verified)]
    public void UnsafeTransitions_AreRejected(DrivingMebbisWorkStatus current, DrivingMebbisWorkStatus target)
        => Assert.False(DrivingMebbisRules.CanTransition(current, target));

    [Fact]
    public void ErrorAndCorrection_RequireReason()
    {
        Assert.True(DrivingMebbisRules.RequiresReason(DrivingMebbisWorkStatus.Error));
        Assert.True(DrivingMebbisRules.RequiresReason(DrivingMebbisWorkStatus.CorrectionPending));
        Assert.False(DrivingMebbisRules.RequiresReason(DrivingMebbisWorkStatus.Ready));
    }

    [Fact]
    public void EntryAssistantFields_AreOrderedUniqueAndWhitelisted()
    {
        var keys = DrivingMebbisEntryFields.Ordered.Select(x => x.Key).ToList();
        Assert.Equal(13, keys.Count);
        Assert.Equal(keys.Count, keys.Distinct(StringComparer.Ordinal).Count());
        Assert.Equal("nationalId", keys[0]);
        Assert.Equal("healthReportIssuedBy", keys[^1]);
        Assert.All(keys, key => Assert.True(DrivingMebbisEntryFields.IsKnown(key)));
        Assert.False(DrivingMebbisEntryFields.IsKnown("password"));
        Assert.False(DrivingMebbisEntryFields.IsKnown("../nationalId"));
    }

    [Theory]
    [InlineData("M", 16)]
    [InlineData("B", 18)]
    [InlineData("A", 20)]
    [InlineData("C", 21)]
    [InlineData("D", 24)]
    public void QualityRules_UseLicenseClassMinimumAge(string licenseClass, int expected)
        => Assert.Equal(expected, DrivingMebbisQualityRules.MinimumAgeFor(licenseClass));

    [Theory]
    [InlineData("0532 123 45 67", true)]
    [InlineData("+90 532 123 45 67", true)]
    [InlineData("0212 123 45 67", false)]
    [InlineData("532123", false)]
    public void QualityRules_ValidateTurkishMobilePhone(string value, bool expected)
        => Assert.Equal(expected, DrivingMebbisQualityRules.IsValidPhone(value));

    [Theory]
    [InlineData("A12 345678", true)]
    [InlineData("AB 123456", true)]
    [InlineData("../../etc", false)]
    public void QualityRules_ValidateIdentitySerialWithoutAcceptingArbitraryInput(string value, bool expected)
        => Assert.Equal(expected, DrivingMebbisQualityRules.IsPlausibleIdentitySerial(value));

    [Fact]
    public void QualityRules_ReadPngDimensionsFromHeader()
    {
        var header = new byte[] { 137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 2, 128, 0, 0, 3, 32 };
        var info = DrivingMebbisQualityRules.InspectImageHeader(header);
        Assert.NotNull(info);
        Assert.Equal("PNG", info!.Format);
        Assert.Equal(640, info.Width);
        Assert.Equal(800, info.Height);
    }
}
