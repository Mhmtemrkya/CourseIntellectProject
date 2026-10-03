using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Security.Claims;
using CourseIntellect.Application.DTOs.Auth;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Auth;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;

namespace CourseIntellect.Tests;

public sealed class AdminMfaTests : IDisposable
{
    private readonly TestDb db = new();
    private readonly Clock clock = new();
    private readonly Sender sender = new();
    private readonly IConfiguration config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>
    {
        ["AdminAccess:Mode"] = "EmailCode", ["AdminAccess:AllowedEmails"] = "one@example.test,two@example.test"
    }).Build();
    private readonly HttpContextAccessor http = new() { HttpContext = ManagementContext() };
    private AdminEmailAccessPolicy Policy => new(config);
    private AdminMfaService Service => new(db.Context, Policy, sender, clock, http);
    private static DefaultHttpContext ManagementContext()
    {
        var context = new DefaultHttpContext(); context.Request.Scheme = "https";
        context.Request.Host = new HostString("yonetim.schoolasist.com"); return context;
    }
    private async Task<AppUser> Seed(string email = "one@example.test")
    {
        var user = new AppUser { Username = email, PlatformAccessEmail = email, FullName = "Test Manager",
            PrimaryRole = UserRole.Developer, PasswordHash = new PasswordHasher().Hash("strong-test-password") };
        db.Context.Add(user); await db.Context.SaveChangesAsync(); return user;
    }
    private AuthService Auth => new(db.Context, new JwtTokenService(Options.Create(new JwtOptions {Key = new string('k',64),AccessTokenMinutes=480})),
        new PasswordHasher(), new LoginAttemptService(db.Context), new SystemStub(), http, config, Service, Policy);

    [Theory]
    [InlineData("one@example.test", true)]
    [InlineData("two@example.test", true)]
    [InlineData("ONE@example.test", true)]
    [InlineData("third@example.test", false)]
    public async Task ExactlyTheTwoProvisionedAccountsCanRequestCodes(string email, bool expected)
    {
        var user = await Seed(email);
        Assert.Equal(expected, await Service.StartAsync(user) is not null);
        Assert.Equal(expected ? 1 : 0, sender.Messages.Count);
    }
    [Theory]
    [InlineData("")]
    [InlineData("one@example.test")]
    [InlineData("one@example.test,one@example.test")]
    [InlineData("one@example.test,two@example.test,third@example.test")]
    [InlineData("invalid,two@example.test")]
    public async Task MissingOrAmbiguousAllowlistFailsClosed(string list)
    {
        config["AdminAccess:AllowedEmails"] = list;
        Assert.Null(await Service.StartAsync(await Seed())); Assert.Empty(sender.Messages);
    }
    [Theory]
    [InlineData("tenant")]
    [InlineData("inactive")]
    [InlineData("unbound")]
    [InlineData("temporary")]
    [InlineData("role")]
    [InlineData("public-host")]
    [InlineData("no-tls")]
    public async Task WrongRoleBindingOrOriginCannotStartOrVerify(string variant)
    {
        var user = await Seed(); var start = (await Service.StartAsync(user))!;
        switch(variant)
        {
            case "tenant":user.TenantId=Guid.NewGuid();break;
            case "inactive":user.Status=UserStatus.Passive;break;
            case "unbound":user.PlatformAccessEmail="third@example.test";break;
            case "temporary":user.MustChangePassword=true;break;
            case "role":user.PrimaryRole=UserRole.Teacher;break;
            case "public-host":http.HttpContext!.Request.Host=new("schoolasist.com");break;
            case "no-tls":http.HttpContext!.Request.Scheme="http";break;
        }
        if (variant != "tenant") await db.Context.SaveChangesAsync();
        clock.Advance(TimeSpan.FromMinutes(1));
        Assert.Null(await Service.StartAsync(user));
        Assert.Null(await Service.VerifyAsync(new(start.ChallengeToken,sender.Code)));
    }
    [Fact]
    public async Task WrongPasswordOrOtherAccountDoesNotSendEmailOrIssueTokens()
    {
        var user=await Seed();
        Assert.Null(await Auth.BeginAdminLoginAsync(new(user.Username,"incorrect")));
        Assert.Null(await Auth.BeginAdminLoginAsync(new("third@example.test","strong-test-password")));
        Assert.Empty(sender.Messages); Assert.Empty(db.Context.RefreshTokenSessions);
    }
    [Fact]
    public async Task CodeSentOnlyToMatchingAccountNotExposedAndSingleUse()
    {
        var user=await Seed();var start=(await Auth.BeginAdminLoginAsync(new(user.Username,"strong-test-password")))!;
        Assert.Equal(user.Username,sender.Messages.Single().To);
        Assert.Matches("^[0-9]{6}$",sender.Code); Assert.Empty(db.Context.RefreshTokenSessions);
        var challenge=await db.Context.AdminMfaChallenges.SingleAsync();
        Assert.NotEqual(start.ChallengeToken,challenge.TokenHash);
        Assert.Equal(64,challenge.CodeHash.Length);Assert.NotEqual(sender.Code,challenge.CodeHash);
        Assert.DoesNotContain(sender.Code,System.Text.Json.JsonSerializer.Serialize(start));
        var completed=await Auth.CompleteAdminLoginAsync(new(start.ChallengeToken,sender.Code));
        Assert.NotNull(completed); Assert.Null(await Auth.CompleteAdminLoginAsync(new(start.ChallengeToken,sender.Code)));
        var decoded=new Microsoft.IdentityModel.JsonWebTokens.JsonWebToken(completed.Session.AccessToken);
        Assert.Equal("true",decoded.GetClaim("admin_mfa").Value,ignoreCase:true);
        Assert.True(completed.Session.ExpiresAtUtc<=DateTime.UtcNow.AddMinutes(16));
        Assert.Equal("email",(await db.Context.RefreshTokenSessions.SingleAsync()).AdminVerificationMethod);
    }
    [Fact]
    public async Task CrossAccountCodesAndVersionChangeAreRejected()
    {
        var one=await Seed();var two=await Seed("two@example.test");
        var first=(await Service.StartAsync(one))!;
        var codeOne=sender.Code;
        var second=(await Service.StartAsync(two))!;
        // Guarantee this is a wrong code, independent of random collision probability.
        var wrong=codeOne==sender.Code ? (int.Parse(sender.Code)==0?"000001":"000000") : codeOne;
        Assert.Null(await Service.VerifyAsync(new(second.ChallengeToken,wrong)));
        one.SecurityVersion++;await db.Context.SaveChangesAsync();
        Assert.Null(await Service.VerifyAsync(new(first.ChallengeToken,codeOne)));
        Assert.NotNull(await Service.VerifyAsync(new(second.ChallengeToken,sender.Code)));
    }
    [Fact]
    public async Task ExpirationAndFailedAttemptsCannotBeBypassedByRestarting()
    {
        var user=await Seed();var first=(await Service.StartAsync(user))!;
        for(var i=0;i<5;i++)Assert.Null(await Service.VerifyAsync(new(first.ChallengeToken,"invalid")));
        Assert.Null(await Service.VerifyAsync(new(first.ChallengeToken,sender.Code)));
        clock.Advance(TimeSpan.FromMinutes(1));Assert.Null(await Service.StartAsync(user));
        clock.Advance(TimeSpan.FromMinutes(15));var next=(await Service.StartAsync(user))!;
        clock.Advance(TimeSpan.FromMinutes(5));Assert.Null(await Service.VerifyAsync(new(next.ChallengeToken,sender.Code)));
    }
    [Fact]
    public async Task SendBudgetPersistsAndNewCodeInvalidatesOldChallenge()
    {
        var user=await Seed();var first=(await Service.StartAsync(user))!;var firstCode=sender.Code;
        Assert.Null(await Service.StartAsync(user));Assert.Single(sender.Messages);
        clock.Advance(TimeSpan.FromMinutes(1));var second=(await Service.StartAsync(user))!;
        Assert.Null(await Service.VerifyAsync(new(first.ChallengeToken,firstCode)));
        clock.Advance(TimeSpan.FromMinutes(1));Assert.NotNull(await Service.StartAsync(user));
        clock.Advance(TimeSpan.FromMinutes(1));Assert.Null(await Service.StartAsync(user));
        Assert.Equal(3,sender.Messages.Count);
        Assert.Null(await Service.VerifyAsync(new(second.ChallengeToken,sender.Code)));
    }
    [Fact]
    public async Task DeliveryFailureNeverCreatesUsableChallenge()
    {
        sender.Success=false;var user=await Seed();Assert.Null(await Service.StartAsync(user));
        var row=await db.Context.AdminMfaChallenges.SingleAsync();Assert.Null(row.DeliveredAtUtc);Assert.NotNull(row.ConsumedAtUtc);
        Assert.Empty(db.Context.RefreshTokenSessions);
        sender.IsConfigured=false;clock.Advance(TimeSpan.FromMinutes(1));Assert.Null(await Service.StartAsync(user));
    }
    [Fact]
    public async Task LegacyPasswordPkceRefreshAndOrdinaryJwtCannotBypassCode()
    {
        var user=await Seed();Assert.Null(await Auth.LoginAsync(new(user.Username,"strong-test-password")));
        Assert.Null(await Auth.PkceAuthorizeAsync(new(user.Username,"strong-test-password","desktop","app://cb","challenge","S256")));
        var jwt=new JwtTokenService(Options.Create(new JwtOptions{Key=new string('k',64)}));
        Assert.Throws<InvalidOperationException>(()=>jwt.CreateToken(user));
        var raw="legacy-refresh";
        db.Context.RefreshTokenSessions.Add(new RefreshTokenSession {UserId=user.Id, SecurityVersion=user.SecurityVersion,
            TokenHash=Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(raw))), ExpiresAtUtc=DateTime.UtcNow.AddHours(1)});
        await db.Context.SaveChangesAsync();Assert.Null(await Auth.RefreshAsync(new(raw)));
    }
    [Fact]
    public async Task RefreshPreservesAbsoluteExpiryAndRevokedAllowlistStopsOldSessions()
    {
        var user=await Seed();var start=(await Auth.BeginAdminLoginAsync(new(user.Username,"strong-test-password")))!;
        var result=(await Auth.CompleteAdminLoginAsync(new(start.ChallengeToken,sender.Code)))!;
        var refreshed=await Auth.RefreshAsync(new(result.Session.RefreshToken));Assert.NotNull(refreshed);
        Assert.Equal(result.Session.RefreshTokenExpiresAtUtc,refreshed.RefreshTokenExpiresAtUtc);
        Assert.Null(await Auth.RefreshAsync(new(result.Session.RefreshToken)));
        config["AdminAccess:AllowedEmails"]="other@example.test,two@example.test";
        Assert.Null(await Auth.RefreshAsync(new(refreshed.RefreshToken)));
    }
    [Theory]
    [InlineData("valid",true)]
    [InlineData("no-mfa",false)]
    [InlineData("no-session",false)]
    [InlineData("revoked",false)]
    [InlineData("idle",false)]
    [InlineData("expired",false)]
    [InlineData("old-verification",false)]
    [InlineData("wrong-version",false)]
    [InlineData("unbound",false)]
    [InlineData("legacy-totp",false)]
    [InlineData("public-host",false)]
    public async Task SessionGuardEnforcesIdentityMethodIdleAndRevocation(string variant,bool expected)
    {
        var user=await Seed();var now=clock.GetUtcNow().UtcDateTime;
        var session=new RefreshTokenSession {UserId=user.Id, SecurityVersion=variant=="wrong-version"?user.SecurityVersion+1:user.SecurityVersion,
            TokenHash="test-session-hash", AdminVerificationMethod=variant=="legacy-totp"?null:"email",
            ExpiresAtUtc=variant=="expired"?now.AddSeconds(-1):now.AddHours(8),
            AdminMfaVerifiedAtUtc=variant=="old-verification"?now.AddHours(-9):now,
            AdminLastActivityAtUtc=variant=="idle"?now.AddMinutes(-16):now.AddMinutes(-2),RevokedAtUtc=variant=="revoked"?now:null};
        db.Context.Add(session);await db.Context.SaveChangesAsync();
        if(variant=="unbound")user.PlatformAccessEmail="other@example.test";
        if(variant=="public-host")http.HttpContext!.Request.Host=new("schoolasist.com");
        var claims=new List<Claim>();if(variant!="no-mfa")claims.Add(new("admin_mfa","true"));
        if(variant!="no-session")claims.Add(new("admin_session",session.Id.ToString()));
        var principal=new ClaimsPrincipal(new ClaimsIdentity(claims));var guard=new AdminSessionGuard(db.Context,Policy,clock,http);
        Assert.Equal(expected,await guard.ValidateAsync(user,principal));
        if(expected){await db.Context.Entry(session).ReloadAsync();Assert.Equal(now,session.AdminLastActivityAtUtc);session.RevokedAtUtc=now;
            await db.Context.SaveChangesAsync();Assert.False(await guard.ValidateAsync(user,principal));}
    }
    private sealed class Sender:IEmailSender
    {
        public bool IsConfigured {get;set;}=true; public bool Success {get;set;}=true;
        public List<(string To,string Body)> Messages {get;}=[];
        public string Code=>Regex.Match(Messages.Last().Body, @">([0-9]{6})</p>").Groups[1].Value;
        public Task<bool> SendAsync(string toAddress,string subject,string htmlBody,CancellationToken cancellationToken=default)
        {Messages.Add((toAddress,htmlBody));return Task.FromResult(Success);}
    }
    private sealed class Clock:TimeProvider
    {
        private DateTimeOffset now=DateTimeOffset.UtcNow;public override DateTimeOffset GetUtcNow()=>now;
        public void Advance(TimeSpan delta)=>now+=delta;
    }
    private sealed class SystemStub:ISystemService
    {
        public Task<bool> IsMaintenanceActiveAsync(CancellationToken cancellationToken=default)=>Task.FromResult(false);
        public Task<CourseIntellect.Application.DTOs.System.SystemStatusDto> GetStatusAsync(CancellationToken cancellationToken=default)=>throw new NotImplementedException();
        public Task<CourseIntellect.Application.DTOs.System.SystemStatusDto> SetMaintenanceAsync(CourseIntellect.Application.DTOs.System.UpdateMaintenanceRequest request,CancellationToken cancellationToken=default)=>throw new NotImplementedException();
    }
    public void Dispose()=>db.Dispose();
}
