using CourseIntellect.Application.DTOs.Auth;
using CourseIntellect.Application.DTOs.System;
using CourseIntellect.Application.Interfaces;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Auth;
using CourseIntellect.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace CourseIntellect.Tests;

/// <summary>Kullanıcı kendi profilinden yetkiyi etkileyen ad/branş alanlarını değiştiremez.</summary>
public sealed class ProfileSelfEscalationTests : IDisposable
{
    private readonly TestDb db = new();

    private sealed class Jwt : IJwtTokenService { public string CreateToken(AppUser user) => "t"; public int AccessTokenMinutes => 60; public int RefreshTokenDays => 7; }
    private sealed class Sys : ISystemService
    {
        public Task<SystemStatusDto> GetStatusAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<SystemStatusDto> SetMaintenanceAsync(UpdateMaintenanceRequest request, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<bool> IsMaintenanceActiveAsync(CancellationToken cancellationToken = default) => Task.FromResult(false);
    }

    private AuthService Service() => new(db.Context, new Jwt(), new PasswordHasher(), new LoginAttemptService(db.Context), new Sys(),
        new HttpContextAccessor(), new ConfigurationBuilder().Build());

    [Theory]
    [InlineData(UserRole.Teacher)]
    [InlineData(UserRole.Parent)]
    [InlineData(UserRole.Student)]
    public async Task NonAdmin_CannotChangeNameOrBranch(UserRole role)
    {
        var user = new AppUser { FullName = "Hasan YILMAZ", Username = $"u{(int)role}", PasswordHash = "x", PrimaryRole = role, DepartmentOrBranch = "Matematik", Campus = "A" };
        db.Context.Users.Add(user);
        await db.Context.SaveChangesAsync();

        await Service().UpdateProfileAsync(user.Id, new UpdateProfileRequest("Başka Veli", "B", "Rehberlik"));

        var saved = db.Context.Users.Single(x => x.Id == user.Id);
        Assert.Equal(("Hasan YILMAZ", "Matematik", "B"), (saved.FullName, saved.DepartmentOrBranch, saved.Campus));
    }

    public void Dispose() => db.Dispose();
}
