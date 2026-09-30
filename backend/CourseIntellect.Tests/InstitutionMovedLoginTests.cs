using CourseIntellect.Application.DTOs.Auth;
using CourseIntellect.Application.DTOs.System;
using CourseIntellect.Application.Exceptions;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Auth;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace CourseIntellect.Tests;

/// <summary>
/// Sürücü kursları DrivingAsist ürününe taşındı. Bu kurumların kullanıcıları
/// okul ürününde oturum açamamalı ve boş/bozuk bir arayüze düşmek yerine
/// nereye gideceklerini söyleyen bir mesaj almalı.
/// </summary>
public sealed class InstitutionMovedLoginTests : IDisposable
{
    private static readonly Guid SchoolTenant = Guid.NewGuid();
    private static readonly Guid DrivingTenant = Guid.NewGuid();

    private readonly TestDb db = new();
    private readonly IPasswordHasher hasher = new PasswordHasher();

    private AuthService BuildService() => new(
        db.Context,
        new FakeJwt(),
        hasher,
        new LoginAttemptService(db.Context),
        new FakeSystem(),
        new HttpContextAccessor { HttpContext = null },
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            // Bu testler kurum yönlendirmesini sınar; test parolası demo listesinde.
            ["Security:AllowPublicDemoPasswords"] = "true",
        }).Build());

    private async Task SeedAsync()
    {
        db.Context.TenantWorkspaces.AddRange(
            new TenantWorkspace { Id = SchoolTenant, Name = "Okul", Slug = "okul", InstitutionType = InstitutionType.PrivateSchool },
            new TenantWorkspace { Id = DrivingTenant, Name = "Kurs", Slug = "kurs", InstitutionType = InstitutionType.DrivingSchool });
        db.Context.Users.AddRange(
            NewUser("okul.admin", SchoolTenant),
            NewUser("kurs.admin", DrivingTenant),
            NewUser("platform", null, UserRole.Developer));
        await db.Context.SaveChangesAsync();
    }

    private AppUser NewUser(string username, Guid? tenantId, UserRole role = UserRole.Admin) => new()
    {
        FullName = username,
        Username = username,
        PasswordHash = hasher.Hash("Parola123"),
        PrimaryRole = role,
        Status = UserStatus.Active,
        TenantId = tenantId,
    };

    [Fact]
    public async Task Surucu_kursu_kullanicisi_dogru_parolayla_yonlendirme_mesaji_alir()
    {
        await SeedAsync();

        var ex = await Assert.ThrowsAsync<InstitutionMovedException>(
            () => BuildService().LoginAsync(new LoginRequest("kurs.admin", "Parola123")));

        Assert.Equal("DrivingAsist", ex.TargetProduct);
    }

    [Fact]
    public async Task Surucu_kursu_kullanicisi_yanlis_parolada_genel_hata_alir()
    {
        await SeedAsync();

        // Parola yanlışken kurumun türü sızdırılmaz.
        var result = await BuildService().LoginAsync(new LoginRequest("kurs.admin", "Yanlis999"));

        Assert.Null(result);
    }

    [Fact]
    public async Task Okul_ve_platform_kullanicilari_etkilenmez()
    {
        await SeedAsync();
        var service = BuildService();

        Assert.NotNull(await service.LoginAsync(new LoginRequest("okul.admin", "Parola123")));
        Assert.NotNull(await service.LoginAsync(new LoginRequest("platform", "Parola123")));
    }

    [Fact]
    public async Task Surucu_kursu_oturumu_refresh_ile_yenilenmez()
    {
        await SeedAsync();
        var user = await db.Context.Users.SingleAsync(x => x.Username == "kurs.admin");
        db.Context.RefreshTokenSessions.Add(new RefreshTokenSession
        {
            UserId = user.Id,
            TokenHash = Convert.ToBase64String(System.Security.Cryptography.SHA256.HashData("eski-oturum"u8.ToArray())),
            ExpiresAtUtc = DateTime.UtcNow.AddDays(3),
            CreatedAtUtc = DateTime.UtcNow,
        });
        await db.Context.SaveChangesAsync();

        var result = await BuildService().RefreshAsync(new RefreshTokenRequest("eski-oturum"));

        Assert.Null(result);
    }

    private sealed class FakeJwt : IJwtTokenService
    {
        public string CreateToken(AppUser user) => "test-token";
        public int AccessTokenMinutes => 60;
        public int RefreshTokenDays => 7;
    }

    private sealed class FakeSystem : ISystemService
    {
        public Task<SystemStatusDto> GetStatusAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<SystemStatusDto> SetMaintenanceAsync(UpdateMaintenanceRequest request, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<bool> IsMaintenanceActiveAsync(CancellationToken cancellationToken = default) => Task.FromResult(false);
    }

    public void Dispose() => db.Dispose();
}
