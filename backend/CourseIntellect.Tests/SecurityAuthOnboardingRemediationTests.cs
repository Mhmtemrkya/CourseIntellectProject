using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.DTOs.Auth;
using CourseIntellect.Application.DTOs.Common;
using CourseIntellect.Application.DTOs.System;
using CourseIntellect.Application.DTOs.Users;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Auth;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Security.Cryptography;
using System.Text;

namespace CourseIntellect.Tests;

public sealed class SecurityAuthOnboardingRemediationTests : IDisposable
{
    private readonly TestDb db = new();
    private readonly IPasswordHasher hasher = new PasswordHasher();
    private readonly Guid tenantId = Guid.NewGuid();

    [Fact]
    public async Task Tenant_admin_cannot_create_or_assign_platform_developer_role()
    {
        db.Context.TenantWorkspaces.Add(new TenantWorkspace { Id = tenantId, Name = "Tenant", Slug = "tenant" });
        await db.Context.SaveChangesAsync();
        var service = new UserDirectoryService(db.Context, hasher, new FixedTenant(tenantId), new NoopAudit());
        var victim = new AppUser { TenantId = tenantId, Username = "victim", FullName = "Victim", PasswordHash = hasher.Hash("Password1"), PrimaryRole = UserRole.Student };
        db.Context.Users.Add(victim);
        await db.Context.SaveChangesAsync();

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateUserAsync(
            new AdminCreateUserRequest("Attacker", "attacker", "Password1", "Developer", true, true)));
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.AssignPrimaryRoleAsync(
            victim.Username, new UserRoleAssignmentRequest("Developer", "Platform")));
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.AddExtraRoleAsync(
            victim.Username, new UserExtraRoleRequest("Developer")));

        Assert.DoesNotContain(await db.Context.Users.ToListAsync(), x => x.PrimaryRole == UserRole.Developer);
        Assert.Equal(UserRole.Student, (await db.Context.Users.SingleAsync(x => x.Id == victim.Id)).PrimaryRole);
    }

    [Fact]
    public async Task Bootstrap_login_has_no_refresh_and_requires_temporary_password_to_change_password()
    {
        db.Context.TenantWorkspaces.Add(new TenantWorkspace { Id = tenantId, Name = "Tenant", Slug = "tenant" });
        await db.Context.SaveChangesAsync();
        var user = new AppUser
        {
            TenantId = tenantId, Username = "bootstrap", FullName = "Bootstrap",
            PasswordHash = hasher.Hash("Temporary1"), PrimaryRole = UserRole.Admin,
            Status = UserStatus.Active, MustChangePassword = true,
            TemporaryPasswordExpiresAtUtc = DateTime.UtcNow.AddHours(1)
        };
        db.Context.Users.Add(user);
        await db.Context.SaveChangesAsync();
        var service = Auth();

        var login = await service.LoginAsync(new LoginRequest(user.Username, "Temporary1"));

        Assert.NotNull(login);
        Assert.True(string.IsNullOrEmpty(login.RefreshToken));
        Assert.Empty(await db.Context.RefreshTokenSessions.ToListAsync());
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.ChangePasswordAsync(user.Id, new ChangePasswordRequest(null, "NewPassword1")));
        await service.ChangePasswordAsync(user.Id, new ChangePasswordRequest("Temporary1", "NewPassword1"));
        var changed = await db.Context.Users.SingleAsync(x => x.Id == user.Id);
        Assert.False(changed.MustChangePassword);
        Assert.Equal(2, changed.SecurityVersion);
    }

    [Fact]
    public async Task Pkce_rechecks_user_state_at_authorize_and_exchange()
    {
        var user = new AppUser
        {
            Username = "pkce", FullName = "Pkce", PasswordHash = hasher.Hash("Password1"),
            PrimaryRole = UserRole.Admin, Status = UserStatus.Active
        };
        db.Context.Users.Add(user);
        await db.Context.SaveChangesAsync();
        var verifier = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
        var challenge = Base64Url(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.ASCII.GetBytes(verifier)));
        var service = Auth();

        user.MustChangePassword = true;
        await db.Context.SaveChangesAsync();
        Assert.Null(await service.PkceAuthorizeAsync(new PkceAuthorizeRequest(user.Username, "Password1", "desktop", "app://callback", challenge, "S256")));

        user.MustChangePassword = false;
        await db.Context.SaveChangesAsync();
        var authorized = await service.PkceAuthorizeAsync(new PkceAuthorizeRequest(user.Username, "Password1", "desktop", "app://callback", challenge, "S256"));
        Assert.NotNull(authorized);
        user.Status = UserStatus.Passive;
        await db.Context.SaveChangesAsync();
        Assert.Null(await service.PkceTokenExchangeAsync(new PkceTokenRequest(authorized!.Code, verifier, "desktop", "app://callback")));
    }

    [Fact]
    public async Task Refresh_and_pkce_codes_are_bound_to_the_users_security_version()
    {
        var user = new AppUser
        {
            Username = "versioned", FullName = "Versioned", PasswordHash = hasher.Hash("Password1"),
            PrimaryRole = UserRole.Admin, Status = UserStatus.Active
        };
        db.Context.Users.Add(user);
        await db.Context.SaveChangesAsync();
        var service = Auth();
        var login = await service.LoginAsync(new LoginRequest(user.Username, "Password1"));
        Assert.NotNull(login);

        var verifier = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
        var challenge = Base64Url(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
        var authorized = await service.PkceAuthorizeAsync(
            new PkceAuthorizeRequest(user.Username, "Password1", "desktop", "app://callback", challenge, "S256"));
        Assert.NotNull(authorized);

        user.SecurityVersion++;
        await db.Context.SaveChangesAsync();

        Assert.Null(await service.RefreshAsync(new RefreshTokenRequest(login!.RefreshToken)));
        Assert.Null(await service.PkceTokenExchangeAsync(
            new PkceTokenRequest(authorized!.Code, verifier, "desktop", "app://callback")));
    }

    [Fact]
    public async Task Password_reset_approval_advances_security_version()
    {
        var user = new AppUser
        {
            TenantId = tenantId, Username = "reset", FullName = "Reset", PasswordHash = hasher.Hash("Password1"),
            PrimaryRole = UserRole.Admin, Status = UserStatus.Active, SecurityVersion = 7
        };
        db.Context.TenantWorkspaces.Add(new TenantWorkspace { Id = tenantId, Name = "Tenant", Slug = "tenant" });
        db.Context.Users.Add(user);
        var reset = new PasswordResetRequest
        {
            TenantId = tenantId, UserId = user.Id, RequestedEmail = "reset@example.test",
            FullName = user.FullName, Username = user.Username, PrimaryRole = "Admin", Status = "Pending"
        };
        db.Context.PasswordResetRequests.Add(reset);
        await db.Context.SaveChangesAsync();

        await Auth().ReviewPasswordResetRequestAsync(reset.Id, new ReviewPasswordResetRequest(true, "approved"));

        Assert.Equal(8, (await db.Context.Users.SingleAsync(x => x.Id == user.Id)).SecurityVersion);
    }

    private AuthService Auth() => new(
        db.Context, new FakeJwt(), hasher, new LoginAttemptService(db.Context), new FakeSystem(),
        new HttpContextAccessor(), new ConfigurationBuilder().AddInMemoryCollection().Build());

    private static string Base64Url(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    public void Dispose() => db.Dispose();

    private sealed class FixedTenant(Guid id) : ITenantContext { public Guid? CurrentTenantId => id; public bool HasTenant => true; }
    private sealed class FakeJwt : IJwtTokenService { public string CreateToken(AppUser user) => "token"; public int AccessTokenMinutes => 60; public int RefreshTokenDays => 7; }
    private sealed class FakeSystem : ISystemService
    {
        public Task<SystemStatusDto> GetStatusAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<SystemStatusDto> SetMaintenanceAsync(UpdateMaintenanceRequest request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<bool> IsMaintenanceActiveAsync(CancellationToken cancellationToken = default) => Task.FromResult(false);
    }
    private sealed class NoopAudit : IAuditLogService
    {
        public Task LogAsync(Guid? actorUserId, string actorName, string action, string category, string entityType, string entityId, string detail, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LogAsync(string action, string category, string entityType, string entityId, string detail, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LogChangeAsync(string action, string category, string entityType, string entityId, string detail, object? before, object? after, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<AuditLogDto>> GetAsync(string? category, int take, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<AuditLogDto>>([]);
        public Task<AuditLogPageDto> GetPagedAsync(AuditLogQuery query, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<IReadOnlyList<AuditBranchSummaryDto>> GetBranchSummaryAsync(CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<AuditBranchSummaryDto>>([]);
    }
}
