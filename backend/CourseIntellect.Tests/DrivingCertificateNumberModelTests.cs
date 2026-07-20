using CourseIntellect.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

public sealed class DrivingCertificateNumberModelTests
{
    [Fact]
    public void MebbisCertificateNumber_IsUniqueWithinTenant_WhenNotBlank()
    {
        using var database = new TestDb();
        var entity = database.Context.Model.FindEntityType(typeof(DrivingCertificate));
        Assert.NotNull(entity);

        var index = Assert.Single(entity!.GetIndexes().Where(x =>
            x.Properties.Select(p => p.Name).SequenceEqual(new[] { "TenantId", "MebbisCertificateNo" })));

        Assert.True(index.IsUnique);
        Assert.Contains("MebbisCertificateNo", index.GetFilter());
    }
}
