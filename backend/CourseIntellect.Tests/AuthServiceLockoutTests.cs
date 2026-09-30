using CourseIntellect.Application.DTOs.Auth;
using CourseIntellect.Application.DTOs.System;
using CourseIntellect.Application.Exceptions;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Auth;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace CourseIntellect.Tests;

public sealed class AuthServiceLockoutTests : IDisposable
{
    private readonly TestDb db = new();
    private readonly IPasswordHasher hasher = new PasswordHasher();

    private AuthService BuildService(int maxFailed = 3, int windowMinutes = 15)
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Auth:Lockout:MaxFailedAttempts"] = maxFailed.ToString(),
                ["Auth:Lockout:WindowMinutes"] = windowMinutes.ToString(),
            })
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

    private async Task SeedUserAsync(string username, string password)
    {
        db.Context.Users.Add(new AppUser
        {
            FullName = "Test User",
            Username = username,
            PasswordHash = hasher.Hash(password),
            PrimaryRole = UserRole.Teacher,
            Status = UserStatus.Active,
        });
        await db.Context.SaveChangesAsync();
    }

    [Fact]
    public async Task Login_RejectsPublicDemoPassword_UnlessExplicitlyAllowed()
    {
        await SeedUserAsync("kurum.admin", "KRM2026A");

        // Depoda yazılı demo parolası: doğru olsa da reddedilir.
        await Assert.ThrowsAsync<PublicDemoPasswordException>(
            () => BuildService().LoginAsync(new LoginRequest("kurum.admin", "KRM2026A")));
    }

    [Fact]
    public async Task PkceAuthorize_BlocksPassiveAccounts_AndRecordsFailures()
    {
        await SeedUserAsync("pasif", "correct-horse");
        var user = db.Context.Users.Single(x => x.Username == "pasif");
        user.Status = UserStatus.Passive;
        await db.Context.SaveChangesAsync();

        var request = new PkceAuthorizeRequest("pasif", "correct-horse", "desktop", "app://cb", "challenge", "S256");
        Assert.Null(await BuildService().PkceAuthorizeAsync(request));
        // Başarısız deneme kaydı tutulur (kilitleme bu kayıtlarla çalışır).
        Assert.Contains(db.Context.LoginAttempts, x => x.Email == "pasif" && !x.Success);
    }

    [Fact]
    public async Task PkceAuthorize_AppliesAccountLockout()
    {
        await SeedUserAsync("kilit", "correct-horse");
        var service = BuildService(maxFailed: 2);
        var wrong = new PkceAuthorizeRequest("kilit", "yanlis", "desktop", "app://cb", "challenge", "S256");
        Assert.Null(await service.PkceAuthorizeAsync(wrong));
        Assert.Null(await service.PkceAuthorizeAsync(wrong));
        var right = wrong with { Password = "correct-horse" };
        await Assert.ThrowsAsync<AccountLockedException>(() => service.PkceAuthorizeAsync(right));
    }

    [Fact]
    public async Task Login_LocksAccount_AfterThresholdFailures_EvenWithCorrectPassword()
    {
        await SeedUserAsync("ali", "correct-horse");
        var service = BuildService(maxFailed: 3);

        // 3 başarısız deneme eşiğe ulaşır.
        for (var i = 0; i < 3; i++)
        {
            var result = await service.LoginAsync(new LoginRequest("ali", "wrong"));
            Assert.Null(result);
        }

        // Kilitliyken DOĞRU parola bile reddedilir (kilitleme çalışıyor).
        await Assert.ThrowsAsync<AccountLockedException>(
            () => service.LoginAsync(new LoginRequest("ali", "correct-horse")));
    }

    [Fact]
    public async Task Login_DoesNotLock_BelowThreshold()
    {
        await SeedUserAsync("veli", "s3cret");
        var service = BuildService(maxFailed: 3);

        // 2 başarısız (eşik altı) → 3. denemede doğru parola geçmeli.
        await service.LoginAsync(new LoginRequest("veli", "nope"));
        await service.LoginAsync(new LoginRequest("veli", "nope"));

        var ok = await service.LoginAsync(new LoginRequest("veli", "s3cret"));
        Assert.NotNull(ok);
    }

    [Fact]
    public async Task Login_LockoutIsKeyedPerAccount()
    {
        await SeedUserAsync("ayse", "p@ss");
        await SeedUserAsync("mehmet", "p@ss");
        var service = BuildService(maxFailed: 3);

        // "ayse" hesabı eşiğe ulaşıp kilitlenir.
        for (var i = 0; i < 3; i++)
        {
            await service.LoginAsync(new LoginRequest("ayse", "wrong"));
        }
        await Assert.ThrowsAsync<AccountLockedException>(
            () => service.LoginAsync(new LoginRequest("ayse", "p@ss")));

        // Farklı hesap ("mehmet") etkilenmez → normal giriş yapabilir.
        Assert.NotNull(await service.LoginAsync(new LoginRequest("mehmet", "p@ss")));
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
