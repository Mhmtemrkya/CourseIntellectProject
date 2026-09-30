using System.Security.Claims;
using CourseIntellect.Api.Hubs;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace CourseIntellect.Tests;

public sealed class TenantAccessHubFilterTests
{
    [Fact]
    public async Task Disabled_institution_cannot_invoke_an_existing_hub_connection()
    {
        using var db = new TestDb();
        var (tenant, user) = await Seed(db, "suspended");
        using var provider = new ServiceCollection().AddSingleton(db.Context).BuildServiceProvider();
        using var filter = new TenantAccessHubFilter(provider.GetRequiredService<IServiceScopeFactory>(), NullLogger<TenantAccessHubFilter>.Instance);
        using var caller = new TestCaller(user.Id);
        var invocation = new HubInvocationContext(caller, provider, new TestHub(), typeof(TestHub).GetMethod(nameof(TestHub.Ping))!, []);
        var invoked = false;
        await Assert.ThrowsAsync<HubException>(async () => await filter.InvokeMethodAsync(invocation, _ =>
        {
            invoked = true;
            return ValueTask.FromResult<object?>(null);
        }));
        Assert.False(invoked);
        Assert.True(caller.ConnectionAborted.IsCancellationRequested);
    }

    [Fact]
    public async Task Disabling_institution_closes_a_previously_connected_socket()
    {
        using var db = new TestDb();
        var (tenant, user) = await Seed(db, "active");
        using var provider = new ServiceCollection().AddSingleton(db.Context).BuildServiceProvider();
        using var filter = new TenantAccessHubFilter(provider.GetRequiredService<IServiceScopeFactory>(), NullLogger<TenantAccessHubFilter>.Instance);
        using var caller = new TestCaller(user.Id);
        var lifetime = new HubLifetimeContext(caller, provider, new TestHub());
        await filter.StartAsync(CancellationToken.None);
        try
        {
            await filter.OnConnectedAsync(lifetime, _ => Task.CompletedTask);
            Assert.False(caller.ConnectionAborted.IsCancellationRequested);
            tenant.Status = "suspended";
            await db.Context.SaveChangesAsync();
            await caller.Aborted.Task.WaitAsync(TimeSpan.FromSeconds(12));
            Assert.True(caller.ConnectionAborted.IsCancellationRequested);
        }
        finally { await filter.StopAsync(CancellationToken.None); }
    }

    private static async Task<(TenantWorkspace, AppUser)> Seed(TestDb db, string status)
    {
        var tenant = new TenantWorkspace { Name = "Okul", Slug = "okul", Status = status };
        db.Context.TenantWorkspaces.Add(tenant);
        await db.Context.SaveChangesAsync();
        var user = new AppUser { Username = "teacher", FullName = "Öğretmen", PasswordHash = "hash", TenantId = tenant.Id, PrimaryRole = UserRole.Teacher };
        db.Context.Users.Add(user);
        await db.Context.SaveChangesAsync();
        return (tenant, user);
    }

    private sealed class TestHub : Hub { public Task Ping() => Task.CompletedTask; }
    private sealed class TestCaller(Guid userId) : HubCallerContext, IDisposable
    {
        private readonly CancellationTokenSource cancellation = new();
        public readonly TaskCompletionSource Aborted = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override string ConnectionId { get; } = Guid.NewGuid().ToString();
        public override string? UserIdentifier => userId.ToString();
        public override ClaimsPrincipal User { get; } = new(new ClaimsIdentity([new Claim("sub", userId.ToString())], "test"));
        public override IDictionary<object, object?> Items { get; } = new Dictionary<object, object?>();
        public override IFeatureCollection Features { get; } = new FeatureCollection();
        public override CancellationToken ConnectionAborted => cancellation.Token;
        public override void Abort() { cancellation.Cancel(); Aborted.TrySetResult(); }
        public void Dispose() => cancellation.Dispose();
    }
}
