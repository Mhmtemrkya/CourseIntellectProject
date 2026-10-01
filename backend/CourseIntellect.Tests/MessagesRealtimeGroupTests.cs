using System.Security.Claims;
using CourseIntellect.Api.Hubs;
using CourseIntellect.Infrastructure.Services;

namespace CourseIntellect.Tests;

/// <summary>
/// Kişisel mesaj grupları kurumla nitelenir. Eskiden grup yalnız addan oluşuyordu
/// ve başka kurumda aynı adlı kullanıcı mesaj içeriğini canlı olarak alıyordu.
/// </summary>
public sealed class MessagesRealtimeGroupTests
{
    private static readonly Guid TenantA = Guid.NewGuid();
    private static readonly Guid TenantB = Guid.NewGuid();

    private static ClaimsPrincipal User(Guid tenantId, string name, Guid? userId = null) =>
        new(new ClaimsIdentity(
        [
            new Claim("tenant_id", tenantId.ToString()),
            new Claim("name", name),
            new Claim("sub", (userId ?? Guid.NewGuid()).ToString()),
        ], "test"));

    private static string ServiceGroup(Guid tenantId, Guid? userId, string name) =>
        MessagesHub.BuildUserGroup(MessageParticipantKey.RealtimeParticipantKey(tenantId, userId, name));

    [Theory]
    [InlineData("Ali Yılmaz")]
    [InlineData("İsmail Işık")]
    [InlineData("ÇAĞLA ŞENGÜL")]
    public void Same_tenant_name_based_delivery_reaches_the_user(string name)
    {
        var groups = MessagesHub.BuildUserGroups(User(TenantA, name));
        Assert.Contains(ServiceGroup(TenantA, null, name), groups);
    }

    [Fact]
    public void Same_name_in_another_tenant_does_not_receive_messages()
    {
        var other = MessagesHub.BuildUserGroups(User(TenantB, "Ali Yılmaz"));
        Assert.DoesNotContain(ServiceGroup(TenantA, null, "Ali Yılmaz"), other);
    }

    [Fact]
    public void User_id_based_delivery_reaches_only_that_user()
    {
        var userId = Guid.NewGuid();
        Assert.Contains(ServiceGroup(TenantA, userId, "x"), MessagesHub.BuildUserGroups(User(TenantA, "Ali Yılmaz", userId)));
        Assert.DoesNotContain(ServiceGroup(TenantA, userId, "x"), MessagesHub.BuildUserGroups(User(TenantA, "Ali Yılmaz")));
    }

    [Fact]
    public void Presence_groups_are_tenant_scoped() =>
        Assert.NotEqual(
            MessagesHub.BuildPresenceGroup(TenantA, "ali yilmaz"),
            MessagesHub.BuildPresenceGroup(TenantB, "ali yilmaz"));
}
