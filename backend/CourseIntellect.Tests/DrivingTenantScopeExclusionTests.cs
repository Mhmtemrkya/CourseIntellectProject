using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

/// <summary>
/// Sürücü kursları DrivingAsist ürününe taşındı. Birden çok kuruma erişen bir
/// kullanıcı (sahip/MEB/platform) kurum değiştirici ile bile sürücü kursuna
/// geçememeli; aksi hâlde okul arayüzü sürücü kursu verisini gösterirdi.
/// </summary>
public sealed class DrivingTenantScopeExclusionTests : IDisposable
{
    private static readonly Guid SchoolTenant = Guid.NewGuid();
    private static readonly Guid DrivingTenant = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();

    private readonly TestDb db = new();

    private async Task<UserScopeService> SeedAsync(ScopeLevel level, Guid? target = null)
    {
        db.Context.TenantWorkspaces.AddRange(
            new TenantWorkspace { Id = SchoolTenant, Name = "Okul", Slug = "okul", InstitutionType = InstitutionType.PrivateSchool },
            new TenantWorkspace { Id = DrivingTenant, Name = "Kurs", Slug = "kurs", InstitutionType = InstitutionType.DrivingSchool });
        db.Context.Users.Add(new AppUser
        {
            Id = UserId,
            FullName = "Kurum Sahibi",
            Username = "sahip",
            PasswordHash = "x",
            PrimaryRole = UserRole.Admin,
            Status = UserStatus.Active,
            TenantId = SchoolTenant,
        });
        db.Context.UserScopeGrants.Add(new UserScopeGrant { UserId = UserId, Level = level, TargetId = target });
        await db.Context.SaveChangesAsync();
        return new UserScopeService(db.Context);
    }

    [Fact]
    public async Task Platform_yetkisi_olsa_da_surucu_kursuna_gecilemez()
    {
        var service = await SeedAsync(ScopeLevel.Platform);

        Assert.True(await service.CanAccessTenantAsync(UserId, SchoolTenant));
        Assert.False(await service.CanAccessTenantAsync(UserId, DrivingTenant));
    }

    [Fact]
    public async Task Acik_kurum_yetkisi_surucu_kursu_icin_gecersizdir()
    {
        var service = await SeedAsync(ScopeLevel.Tenant, DrivingTenant);

        Assert.False(await service.CanAccessTenantAsync(UserId, DrivingTenant));
    }

    [Fact]
    public async Task Kurum_secicide_surucu_kursu_listelenmez()
    {
        var service = await SeedAsync(ScopeLevel.Platform);

        var options = await service.GetScopeOptionsAsync(UserId);

        Assert.Contains(options.Tenants, t => t.Id == SchoolTenant);
        Assert.DoesNotContain(options.Tenants, t => t.Id == DrivingTenant);
    }

    public void Dispose() => db.Dispose();
}
