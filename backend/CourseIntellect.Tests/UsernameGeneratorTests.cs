using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Auth;

namespace CourseIntellect.Tests;

public sealed class UsernameGeneratorTests : IDisposable
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private readonly TestDb db = new();

    public UsernameGeneratorTests()
    {
        db.Context.TenantWorkspaces.Add(new TenantWorkspace
        {
            Id = TenantId,
            Name = "Demo Kurum",
            Slug = "demo-kurum",
            ContactEmail = "demo.kurum@gmail.com"
        });
        db.Context.SaveChanges();
    }

    public void Dispose() => db.Dispose();

    [Theory]
    [InlineData("Demo İdari PERSONEL", "administrative", null, "demoidaripersonel@gmail.com")]
    [InlineData("Demo ÖĞRENCİ", "student", "9-A", "demoogrenci@gmail.com")]
    [InlineData("İsmail IŞIK", "teacher", null, "ismailisik@gmail.com")]
    [InlineData("Şükrü Çağlar Âlim", "parent", null, "sukrucaglaralim@gmail.com")]
    public async Task Generated_username_is_plain_ascii(string fullName, string role, string? className, string expected)
    {
        var generator = new UsernameGenerator(db.Context);

        var username = await generator.GenerateAsync(TenantId, fullName, new UsernameContext(role, className));

        Assert.Equal(expected, username);
    }
}
