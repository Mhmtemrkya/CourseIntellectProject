using CourseIntellect.Api.Middleware;
using CourseIntellect.Application.DTOs.Auth;
using CourseIntellect.Application.DTOs.System;
using CourseIntellect.Application.Exceptions;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Auth;
using CourseIntellect.Infrastructure.Persistence;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Security.Claims;

namespace CourseIntellect.Tests;

/// <summary>Web yalnız demo hesaplarına açık; demo hesaplarının kimlik bilgileri hiçbir kanaldan değişmez.</summary>
public sealed class WebDemoAccessTests : IDisposable
{
    private const string WebOrigin = "https://schoolasist.com";
    private const string DemoUser = "demoogretmen9a@gmail.com";
    private const string RealUser = "gercek.ogretmen@okul.test";
    private const string Password = "Correct-horse-9";
    private static readonly Guid DemoTenant = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid OtherTenant = Guid.Parse("22222222-2222-2222-2222-222222222222");

    private readonly SqliteConnection connection = new("DataSource=:memory:");
    private readonly IPasswordHasher hasher = new PasswordHasher();
    private readonly HttpContextAccessor accessor = new() { HttpContext = null };
    private readonly WebDemoAccessPolicy policy;
    private readonly CourseIntellectDbContext context;

    public WebDemoAccessTests() : this(DemoTenant.ToString()) { }

    private WebDemoAccessTests(string tenantSetting)
    {
        policy = BuildPolicy(tenantSetting);
        connection.Open();
        var options = new DbContextOptionsBuilder<CourseIntellectDbContext>().UseSqlite(connection).Options;
        context = new CourseIntellectDbContext(options, webDemoPolicy: policy);
        context.Database.EnsureCreated();
        context.Set<TenantWorkspace>().AddRange(
            new TenantWorkspace { Id = DemoTenant, Name = "Demo", Slug = "demo", Status = "active" },
            new TenantWorkspace { Id = OtherTenant, Name = "Okul", Slug = "okul", Status = "active" });
        context.Users.AddRange(NewUser(DemoUser, DemoTenant), NewUser(RealUser, OtherTenant));
        context.SaveChanges();
    }

    private static WebDemoAccessPolicy BuildPolicy(string tenantSetting) => new(new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["WebDemo:Origins"] = "https://schoolasist.com,https://www.schoolasist.com",
            ["WebDemo:TenantId"] = tenantSetting,
            ["WebDemo:Usernames"] = $"demo.kurum@gmail.com, {DemoUser.ToUpperInvariant()}",
        })
        .Build());

    private AppUser NewUser(string username, Guid tenant) => new()
    {
        FullName = username,
        Username = username,
        PasswordHash = hasher.Hash(Password),
        PrimaryRole = UserRole.Teacher,
        Status = UserStatus.Active,
        TenantId = tenant,
    };

    private AuthService Service(WebDemoAccessPolicy? webPolicy = null) => new(
        context,
        new FakeJwt(),
        hasher,
        new LoginAttemptService(context),
        new FakeSystem(),
        accessor,
        new ConfigurationBuilder().Build(),
        webDemoPolicy: webPolicy ?? policy);

    private void FromWeb(string origin = WebOrigin)
    {
        var http = new DefaultHttpContext();
        http.Request.Headers.Origin = origin;
        accessor.HttpContext = http;
    }

    [Fact]
    public async Task WebLogin_RejectsRealAccount_BeforePasswordCheck()
    {
        FromWeb();
        await Assert.ThrowsAsync<WebDemoOnlyException>(() => Service().LoginAsync(new LoginRequest(RealUser, Password)));
        await Assert.ThrowsAsync<WebDemoOnlyException>(() => Service().LoginAsync(new LoginRequest(RealUser, "yanlis")));
        // Parola denenmediği için gerçek hesabın kilit sayacı web'den işletilemez.
        Assert.DoesNotContain(context.LoginAttempts, x => x.Email == RealUser);
    }

    [Fact]
    public async Task WebLogin_AllowsDemoAccount_AndAppLoginStaysOpenForEveryone()
    {
        FromWeb("https://www.schoolasist.com/");
        Assert.NotNull(await Service().LoginAsync(new LoginRequest(DemoUser, Password)));

        accessor.HttpContext = new DefaultHttpContext(); // uygulama: Origin yok
        Assert.NotNull(await Service().LoginAsync(new LoginRequest(RealUser, Password)));
    }

    [Fact]
    public async Task WebLogin_IsClosed_WhenDemoTenantIsNotConfigured()
    {
        FromWeb();
        await Assert.ThrowsAsync<WebDemoOnlyException>(
            () => Service(BuildPolicy(string.Empty)).LoginAsync(new LoginRequest(DemoUser, Password)));
    }

    [Fact]
    public async Task WebRefresh_DoesNotIssueTokensForRealAccount()
    {
        accessor.HttpContext = new DefaultHttpContext();
        var appLogin = await Service().LoginAsync(new LoginRequest(RealUser, Password));
        Assert.NotNull(appLogin);

        FromWeb();
        await Assert.ThrowsAsync<WebDemoOnlyException>(
            () => Service().RefreshAsync(new RefreshTokenRequest(appLogin.RefreshToken)));
    }

    [Fact]
    public async Task DemoAccount_CannotBeLockedOut_ButRealAccountStillLocks()
    {
        var service = new AuthService(context, new FakeJwt(), hasher, new LoginAttemptService(context), new FakeSystem(),
            accessor, new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Auth:Lockout:MaxFailedAttempts"] = "2",
                ["Auth:Lockout:WindowMinutes"] = "15",
            }).Build(), webDemoPolicy: policy);
        for (var i = 0; i < 5; i++) Assert.Null(await service.LoginAsync(new LoginRequest(DemoUser, "yanlis")));
        for (var i = 0; i < 2; i++) Assert.Null(await service.LoginAsync(new LoginRequest(RealUser, "yanlis")));

        Assert.NotNull(await service.LoginAsync(new LoginRequest(DemoUser, Password)));
        await Assert.ThrowsAsync<AccountLockedException>(() => service.LoginAsync(new LoginRequest(RealUser, Password)));
    }

    [Fact]
    public async Task DemoAccount_PasswordChange_IsBlockedOnEveryChannel()
    {
        var demo = context.Users.Single(x => x.Username == DemoUser);
        await Assert.ThrowsAsync<ProtectedDemoAccountException>(() => Service().ChangePasswordAsync(
            demo.Id, new ChangePasswordRequest(Password, "Yeni-parola-2026")));
        Assert.True(hasher.Verify(Password, context.Users.AsNoTracking().Single(x => x.Id == demo.Id).PasswordHash));
    }

    [Fact]
    public async Task DemoAccount_ForgotPassword_CreatesNoResetRequest()
    {
        await Service().RequestPasswordResetAsync(new ForgotPasswordRequest(DemoUser));
        Assert.Empty(context.PasswordResetRequests.IgnoreQueryFilters());
    }

    [Fact]
    public void DbGuard_BlocksCredentialChanges_ButAllowsHarmlessFields()
    {
        var demo = context.Users.Single(x => x.Username == DemoUser);
        demo.LastLoginAtUtc = DateTime.UtcNow;
        demo.FullName = "Demo Öğretmen";
        context.SaveChanges();

        foreach (var mutate in new Action<AppUser>[]
                 {
                     u => u.PasswordHash = hasher.Hash("Baska-parola-1"),
                     u => u.Username = "ele.gecirildi@example.test",
                     u => u.Status = UserStatus.Passive,
                     u => u.MustChangePassword = true,
                 })
        {
            var tracked = context.Users.Single(x => x.Id == demo.Id);
            mutate(tracked);
            Assert.Throws<ProtectedDemoAccountException>(() => context.SaveChanges());
            context.ChangeTracker.Clear();
        }

        var victim = context.Users.Single(x => x.Id == demo.Id);
        context.Users.Remove(victim);
        Assert.Throws<ProtectedDemoAccountException>(() => context.SaveChanges());
        context.ChangeTracker.Clear();

        // Gerçek hesaplar etkilenmez.
        var real = context.Users.Single(x => x.Username == RealUser);
        real.PasswordHash = hasher.Hash("Baska-parola-1");
        context.SaveChanges();
    }

    [Fact]
    public void DbGuard_BlocksAccountAndInstitutionDeletionRequests_ForDemo()
    {
        var demo = context.Users.Single(x => x.Username == DemoUser);
        context.Set<AccountDeletionRequest>().Add(new AccountDeletionRequest { UserId = demo.Id, TenantId = DemoTenant, RequesterRole = "Teacher" });
        Assert.Throws<ProtectedDemoAccountException>(() => context.SaveChanges());
        context.ChangeTracker.Clear();

        context.Set<InstitutionDeletionRequest>().Add(new InstitutionDeletionRequest { TenantId = DemoTenant, RequestedByUserId = demo.Id });
        Assert.Throws<ProtectedDemoAccountException>(() => context.SaveChanges());
    }

    [Theory]
    [InlineData(WebOrigin, RealUser, "22222222-2222-2222-2222-222222222222", true)]
    [InlineData(WebOrigin, DemoUser, "22222222-2222-2222-2222-222222222222", true)] // demo adı ama başka kurum
    [InlineData(WebOrigin, DemoUser, "11111111-1111-1111-1111-111111111111", false)]
    [InlineData("", RealUser, "22222222-2222-2222-2222-222222222222", false)] // uygulama
    [InlineData("tauri://localhost", RealUser, "22222222-2222-2222-2222-222222222222", false)]
    public async Task Middleware_LimitsAuthenticatedWebRequestsToDemo(string origin, string username, string tenant, bool blocked)
    {
        var reached = false;
        var middleware = new WebDemoChannelMiddleware(_ => { reached = true; return Task.CompletedTask; }, policy);
        var http = new DefaultHttpContext();
        if (origin.Length > 0) http.Request.Headers.Origin = origin;
        http.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim("unique_name", username), new Claim("tenant_id", tenant)], "Bearer"));

        await middleware.InvokeAsync(http);

        Assert.Equal(!blocked, reached);
        if (blocked) Assert.Equal(StatusCodes.Status403Forbidden, http.Response.StatusCode);
    }

    [Fact]
    public async Task Middleware_LeavesAnonymousPublicEndpointsAlone()
    {
        var reached = false;
        var middleware = new WebDemoChannelMiddleware(_ => { reached = true; return Task.CompletedTask; }, policy);
        var http = new DefaultHttpContext();
        http.Request.Headers.Origin = WebOrigin;
        await middleware.InvokeAsync(http);
        Assert.True(reached);
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

    public void Dispose()
    {
        context.Dispose();
        connection.Dispose();
    }
}
