using CourseIntellect.Application.DTOs.AppSettings;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

/// <summary>
/// Ayarlar ve rol politikaları kuruma aittir. Eskiden tablolar kurumlar arası
/// ortaktı: bir okul yöneticisinin değişikliği tüm kurumları ve platformun
/// bakım durumunu etkileyebiliyordu.
/// </summary>
public sealed class TenantScopedSettingsTests : IDisposable
{
    private static readonly Guid TenantA = Guid.NewGuid();
    private static readonly Guid TenantB = Guid.NewGuid();
    private readonly TestDb db = new();

    public TenantScopedSettingsTests()
    {
        db.Context.TenantWorkspaces.AddRange(
            new TenantWorkspace { Id = TenantA, Name = "Okul A", Slug = "okul-a" },
            new TenantWorkspace { Id = TenantB, Name = "Okul B", Slug = "okul-b" });
        db.Context.SaveChanges();
    }

    private static UpsertAppSettingRequest Setting(string key, string value) =>
        new(key, value, "string", "institution", "");

    [Fact]
    public async Task Tenant_setting_is_invisible_to_other_tenants_and_platform()
    {
        db.Context.SetTenantOverride(TenantA);
        await new AppSettingService(db.Context).UpsertManyAsync([Setting("auto_reports", "false")]);

        db.Context.SetTenantOverride(TenantB);
        Assert.Empty(await new AppSettingService(db.Context).GetAllAsync("institution"));

        db.Context.SetTenantOverride(null);
        Assert.Empty(await new AppSettingService(db.Context).GetAllAsync("institution"));

        db.Context.SetTenantOverride(TenantA);
        Assert.Single(await new AppSettingService(db.Context).GetAllAsync("institution"));
    }

    [Fact]
    public async Task Tenant_cannot_switch_platform_maintenance_mode()
    {
        db.Context.SetTenantOverride(TenantA);
        await new AppSettingService(db.Context).UpsertManyAsync([Setting("system.maintenance_mode", "true")]);

        db.Context.SetTenantOverride(null);
        var system = new SystemService(db.Context, null!);
        Assert.False(await system.IsMaintenanceActiveAsync());
    }

    [Fact]
    public async Task Role_policies_are_isolated_per_tenant()
    {
        db.Context.SetTenantOverride(TenantA);
        db.Context.RolePolicies.Add(new RolePolicy { RoleName = "Teacher", LoginEnabled = false, MessagingScope = "" });
        await db.Context.SaveChangesAsync();
        Assert.Equal(TenantA, (await db.Context.RolePolicies.SingleAsync()).TenantId);

        db.Context.SetTenantOverride(TenantB);
        Assert.Empty(await db.Context.RolePolicies.ToListAsync());

        // Aynı rol için kurum başına ayrı kayıt tutulabilir.
        db.Context.RolePolicies.Add(new RolePolicy { RoleName = "Teacher", LoginEnabled = true, MessagingScope = "" });
        await db.Context.SaveChangesAsync();
        Assert.Equal(2, await db.Context.RolePolicies.IgnoreQueryFilters().CountAsync());
    }

    public void Dispose() => db.Dispose();
}
