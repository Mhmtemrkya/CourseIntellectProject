using System.Security.Claims;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Infrastructure.Services;
using Microsoft.Extensions.Caching.Memory;

namespace CourseIntellect.Tests;

/// <summary>
/// Özel rolün sayfa (modül) kapısı.
///
/// Kritik ayrım: <b>boş modül listesi</b> eski rollerde "kısıt yok" demekti.
/// Yetki matrisinden "hiçbir sayfa seçme" isteği bu yüzden sessizce TAM YETKİYE
/// dönüşürdü. <c>ModulesRestricted</c> bayrağı bu iki hâli ayırır; testler
/// bayrağın her iki yönünü de kilitler.
/// </summary>
public sealed class CustomRoleModuleGateTests : IDisposable
{
    private readonly TestDb db = new();

    private EntitlementService Service =>
        new(db.Context, new MemoryCache(new MemoryCacheOptions()));

    private static ClaimsPrincipal UserWithRole(Guid roleId) =>
        new(new ClaimsIdentity([new Claim("custom_role_id", roleId.ToString())], "test"));

    private async Task<Guid> SeedRoleAsync(bool restricted, params string[] modules)
    {
        var role = new CustomRole
        {
            Name = $"Rol {Guid.NewGuid():N}"[..12],
            BaseRole = UserRole.Administrative,
            Modules = [.. modules],
            ModulesRestricted = restricted,
        };
        db.Context.CustomRoles.Add(role);
        await db.Context.SaveChangesAsync();
        return role.Id;
    }

    [Fact]
    public async Task RestrictedRole_WithEmptyModules_SeesNothing()
    {
        var roleId = await SeedRoleAsync(restricted: true);
        var service = Service;

        Assert.False(await service.IsAllowedAsync(UserWithRole(roleId), "students", null));
        Assert.False(await service.IsAllowedAsync(UserWithRole(roleId), "finance", null));
    }

    [Fact]
    public async Task RestrictedRole_SeesOnlyGrantedModules()
    {
        var roleId = await SeedRoleAsync(restricted: true, "students", "registrations");
        var service = Service;

        Assert.True(await service.IsAllowedAsync(UserWithRole(roleId), "students", null));
        Assert.True(await service.IsAllowedAsync(UserWithRole(roleId), "registrations", null));
        Assert.False(await service.IsAllowedAsync(UserWithRole(roleId), "finance", null));
        Assert.False(await service.IsAllowedAsync(UserWithRole(roleId), "salary", null));
    }

    [Fact]
    public async Task LegacyRole_WithEmptyModules_KeepsFullBaseRole()
    {
        // Bayrağı olmayan eski kayıtların davranışı DEĞİŞMEMELİ.
        var roleId = await SeedRoleAsync(restricted: false);
        var service = Service;

        Assert.True(await service.IsAllowedAsync(UserWithRole(roleId), "students", null));
        Assert.True(await service.IsAllowedAsync(UserWithRole(roleId), "finance", null));
    }

    [Fact]
    public async Task UserWithoutCustomRole_IsNotRestricted()
    {
        var anonymous = new ClaimsPrincipal(new ClaimsIdentity([], "test"));
        Assert.True(await Service.IsAllowedAsync(anonymous, "students", null));
    }

    [Fact]
    public void Catalog_RejectsPlatformKeys_AndUnknownKeys()
    {
        // Kurum yöneticisi kendi rolüne platform yönetimi sayfası VEREMEZ:
        // bu anahtarlar katalogda yoktur, dolayısıyla doğrulamadan geçmez.
        Assert.NotEmpty(SchoolModuleCatalog.UnknownKeys(["platform"]));
        Assert.NotEmpty(SchoolModuleCatalog.UnknownKeys(["tenants", "plans", "limits"]));
        Assert.NotEmpty(SchoolModuleCatalog.UnknownKeys(["uydurma-anahtar"]));

        Assert.Empty(SchoolModuleCatalog.UnknownKeys(["students", "finance", "attendance"]));
    }

    [Fact]
    public void Catalog_EnforcedKeys_MatchBackendEntitlementKeys()
    {
        // Enforced işaretli her anahtarın backend'de gerçekten bir karşılığı
        // olmalı; aksi hâlde matriste "kapattım" denen sayfanın API'si açık kalır.
        // Bu test, katalog ile RequireEntitlement anahtarları arasındaki
        // sözleşmeyi temsil eden bir örneklemi kilitler.
        var enforced = SchoolModuleCatalog.Items
            .Where(item => item.Enforced)
            .Select(item => item.Key)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var key in new[] { "students", "attendance", "finance", "collections", "staff-hr", "library" })
        {
            Assert.Contains(key, enforced);
        }

        // Menü-görünürlüğü anahtarları enforced OLARAK işaretlenmemeli.
        var viewOnly = SchoolModuleCatalog.Items.Where(item => !item.Enforced).Select(item => item.Key);
        Assert.Contains("dashboard", viewOnly);
    }

    public void Dispose() => db.Dispose();
}
