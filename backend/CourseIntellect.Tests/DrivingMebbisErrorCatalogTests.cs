using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Services;

namespace CourseIntellect.Tests;

public sealed class DrivingMebbisErrorCatalogTests
{
    [Fact]
    public void Defaults_HaveUniqueStableCodesAndCompleteGuidance()
    {
        var items = DrivingMebbisErrorCatalog.Defaults;
        Assert.Equal(items.Count, items.Select(x => x.Code).Distinct(StringComparer.Ordinal).Count());
        Assert.Contains(items, x => x.Code == DrivingMebbisErrorCatalog.IdentityMismatch);
        Assert.Contains(items, x => x.Code == DrivingMebbisErrorCatalog.DuplicateActiveEnrollment);
        Assert.Contains(items, x => x.Code == DrivingMebbisErrorCatalog.MinimumAge);
        Assert.Contains(items, x => x.Code == DrivingMebbisErrorCatalog.TermQuotaFull);
        Assert.Contains(items, x => x.Code == DrivingMebbisErrorCatalog.HealthReportMissing);
        Assert.Contains(items, x => x.Code == DrivingMebbisErrorCatalog.PhotoFormatInvalid);
        Assert.Contains(items, x => x.Code == DrivingMebbisErrorCatalog.LicenseClassMismatch);
        Assert.All(items, x =>
        {
            Assert.Matches("^[A-Z0-9_]{3,80}$", x.Code);
            Assert.True(x.Title.Length >= 3);
            Assert.True(x.Description.Length >= 10);
            Assert.True(x.PossibleCause.Length >= 5);
            Assert.InRange(x.ResolutionSteps.Length, 1, 12);
        });
    }

    [Fact]
    public void OperationalDefaults_AreBlocking()
        => Assert.All(DrivingMebbisErrorCatalog.Defaults.Where(x => x.Code != DrivingMebbisErrorCatalog.General),
            x => Assert.Equal(DrivingMebbisErrorSeverity.Blocking, x.Severity));
}
