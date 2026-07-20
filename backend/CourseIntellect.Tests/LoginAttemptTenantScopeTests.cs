using CourseIntellect.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CourseIntellect.Tests;

/// <summary>
/// Giriş denemeleri kurum kapsamına alındı: kurum yöneticisi başka kurumun
/// e-posta/IP/cihaz bilgisini görememeli. Kilitleme ise kurumdan bağımsız
/// çalışmaya devam etmeli — aksi hâlde kaba kuvvet koruması sessizce kapanır.
/// </summary>
public sealed class LoginAttemptTenantScopeTests : IDisposable
{
    private readonly TestDb db = new();
    private static readonly Guid TenantA = Guid.NewGuid();
    private static readonly Guid TenantB = Guid.NewGuid();

    private async Task SeedAsync()
    {
        // tenant_id artık tenant_workspaces'e FK; kurumlar önce var olmalı.
        db.Context.TenantWorkspaces.AddRange(
            new TenantWorkspace { Id = TenantA, Name = "Kurum A", Slug = "kurum-a" },
            new TenantWorkspace { Id = TenantB, Name = "Kurum B", Slug = "kurum-b" });

        db.Context.LoginAttempts.AddRange(
            new LoginAttemptItem { TenantId = TenantA, Email = "a@kurum-a.com", IpAddress = "1.1.1.1", Success = true },
            new LoginAttemptItem { TenantId = TenantA, Email = "a@kurum-a.com", IpAddress = "1.1.1.1", Success = false },
            new LoginAttemptItem { TenantId = TenantB, Email = "b@kurum-b.com", IpAddress = "2.2.2.2", Success = true },
            // Tanınmayan e-posta: kullanıcı çözülemediği için kuruma bağlanamaz.
            new LoginAttemptItem { TenantId = null, Email = "yok@bilinmeyen.com", IpAddress = "3.3.3.3", Success = false });
        await db.Context.SaveChangesAsync();
    }

    [Fact]
    public async Task Tenant_SeesOnlyItsOwnLoginAttempts()
    {
        await SeedAsync();
        db.Context.SetTenantOverride(TenantA);

        var rows = await db.Context.LoginAttempts.AsNoTracking().ToListAsync();

        Assert.Equal(2, rows.Count);
        Assert.All(rows, row => Assert.Equal(TenantA, row.TenantId));
        Assert.DoesNotContain(rows, row => row.Email == "b@kurum-b.com");
    }

    [Fact]
    public async Task Tenant_CannotSeeUnattributedAttempts()
    {
        await SeedAsync();
        db.Context.SetTenantOverride(TenantB);

        var rows = await db.Context.LoginAttempts.AsNoTracking().ToListAsync();

        Assert.Single(rows);
        Assert.Equal("b@kurum-b.com", rows[0].Email);
        // Kuruma bağlanamayan deneme hiçbir kuruma sızmamalı.
        Assert.DoesNotContain(rows, row => row.Email == "yok@bilinmeyen.com");
    }

    [Fact]
    public async Task LockoutQuery_IgnoresTenantFilter()
    {
        await SeedAsync();
        // Giriş anında kurum bağlamı henüz yoktur; yanlış kuruma set edilse bile
        // kilitleme sorgusu başarısız denemeleri görmeye devam etmeli.
        db.Context.SetTenantOverride(TenantB);

        var failures = await db.Context.LoginAttempts
            .IgnoreQueryFilters()
            .Where(x => x.Email == "a@kurum-a.com" && !x.Success)
            .CountAsync();

        Assert.Equal(1, failures);
    }

    public void Dispose() => db.Dispose();
}
