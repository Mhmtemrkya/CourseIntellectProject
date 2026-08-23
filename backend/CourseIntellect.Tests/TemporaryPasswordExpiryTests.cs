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
/// Kurum onayında verilen geçici parolanın ömrü. Süresiz bir geçici parola, teslim
/// edilen kurulum belgesi kaybolduğunda aylarca açık bir kapı bırakırdı.
/// </summary>
public sealed class TemporaryPasswordExpiryTests : IDisposable
{
    private readonly TestDb db = new();
    private readonly IPasswordHasher hasher = new PasswordHasher();

    private AuthService BuildService()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>())
            .Build();

        return new AuthService(
            db.Context,
            new FakeJwt(),
            hasher,
            new LoginAttemptService(db.Context),
            new FakeSystem(),
            new HttpContextAccessor { HttpContext = null },
            config);
    }

    private async Task<AppUser> SeedAsync(string password, DateTime? expiresAtUtc, bool mustChange = true)
    {
        var user = new AppUser
        {
            FullName = "Kurum Yonetici",
            Username = "info@abckoleji.com",
            PasswordHash = hasher.Hash(password),
            PrimaryRole = UserRole.Admin,
            Status = UserStatus.Active,
            MustChangePassword = mustChange,
            TemporaryPasswordExpiresAtUtc = expiresAtUtc,
        };
        db.Context.Users.Add(user);
        await db.Context.SaveChangesAsync();
        return user;
    }

    [Fact]
    public async Task Suresi_dolmamis_gecici_parolayla_giris_calisir()
    {
        await SeedAsync("Gecici123", DateTime.UtcNow.AddDays(3));

        var result = await BuildService().LoginAsync(new LoginRequest("info@abckoleji.com", "Gecici123"));

        Assert.NotNull(result);
    }

    [Fact]
    public async Task Suresi_dolmus_gecici_parola_dogru_olsa_bile_giremez()
    {
        await SeedAsync("Gecici123", DateTime.UtcNow.AddMinutes(-1));

        await Assert.ThrowsAsync<TemporaryPasswordExpiredException>(
            () => BuildService().LoginAsync(new LoginRequest("info@abckoleji.com", "Gecici123")));
    }

    [Fact]
    public async Task Suresi_dolmus_deneme_kilitleme_butcesini_yemez()
    {
        await SeedAsync("Gecici123", DateTime.UtcNow.AddMinutes(-1));
        var service = BuildService();

        for (var i = 0; i < 6; i++)
        {
            await Assert.ThrowsAsync<TemporaryPasswordExpiredException>(
                () => service.LoginAsync(new LoginRequest("info@abckoleji.com", "Gecici123")));
        }

        // Parola DOĞRUYDU; başarısız deneme sayılsaydı kurum hesabından büsbütün
        // kilitlenir ve mesaj "hesap kilitli"ye dönerdi.
        Assert.Empty(await db.Context.LoginAttempts.IgnoreQueryFilters().Where(x => !x.Success).ToListAsync());
    }

    [Fact]
    public async Task Sure_yalnizca_gecici_parolayi_baglar()
    {
        // MustChangePassword false: kullanıcı kendi parolasını belirlemiş, eski tarih
        // kalıntısı girişi engellememeli.
        await SeedAsync("Kendi123", DateTime.UtcNow.AddDays(-30), mustChange: false);

        var result = await BuildService().LoginAsync(new LoginRequest("info@abckoleji.com", "Kendi123"));

        Assert.NotNull(result);
    }

    [Fact]
    public async Task Sure_bos_olan_eski_kayitlar_etkilenmez()
    {
        await SeedAsync("Gecici123", null);

        var result = await BuildService().LoginAsync(new LoginRequest("info@abckoleji.com", "Gecici123"));

        Assert.NotNull(result);
    }

    [Fact]
    public async Task Parola_degistirilince_sure_temizlenir()
    {
        var user = await SeedAsync("Gecici123", DateTime.UtcNow.AddDays(3));

        await BuildService().ChangePasswordAsync(user.Id, new ChangePasswordRequest(null, "YeniParola1"));

        var stored = await db.Context.Users.SingleAsync(x => x.Id == user.Id);
        Assert.False(stored.MustChangePassword);
        Assert.Null(stored.TemporaryPasswordExpiresAtUtc);
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
