using System.Security.Claims;
using CourseIntellect.Api.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Tests;

public sealed class LegalConsentControllerTests : IDisposable
{
    private readonly TestDb db = new();

    private LegalConsentController CreateController(Guid userId) => new(db.Context)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", userId.ToString())], "test")),
            },
        },
    };

    private static LegalConsentDecisionRequest Decision(string status = "accepted", string version = LegalConsentController.CurrentVersion, bool marketing = true)
        => new(version, status, marketing, Push: true, Analytics: false, Platform: "desktop", DecidedAtUtc: null);

    [Fact]
    public async Task Decision_IsRecordedPerUser_AndReadBack()
    {
        var userId = Guid.NewGuid();
        var controller = CreateController(userId);

        Assert.IsType<NoContentResult>(await controller.GetMine(CancellationToken.None));

        Assert.IsType<OkObjectResult>(await controller.Record(Decision(), CancellationToken.None));
        var mine = Assert.IsType<OkObjectResult>(await controller.GetMine(CancellationToken.None));
        var response = Assert.IsType<LegalConsentResponse>(mine.Value);
        Assert.Equal("accepted", response.Status);
        Assert.True(response.Marketing);

        // Başka kullanıcı bu kararı görmez.
        Assert.IsType<NoContentResult>(await CreateController(Guid.NewGuid()).GetMine(CancellationToken.None));
    }

    [Fact]
    public async Task Records_AreAppendOnly_AndDeclineClearsOptionalConsents()
    {
        var userId = Guid.NewGuid();
        var controller = CreateController(userId);
        await controller.Record(Decision("accepted"), CancellationToken.None);
        await controller.Record(Decision("declined", marketing: true), CancellationToken.None);

        Assert.Equal(2, db.Context.LegalConsentRecords.Count(x => x.UserId == userId));
        var latest = Assert.IsType<LegalConsentResponse>(Assert.IsType<OkObjectResult>(await controller.GetMine(CancellationToken.None)).Value);
        Assert.Equal("declined", latest.Status);
        Assert.False(latest.Marketing);
    }

    [Fact]
    public async Task InvalidInput_IsRejected()
    {
        var controller = CreateController(Guid.NewGuid());
        Assert.IsType<BadRequestObjectResult>(await controller.Record(Decision(version: "eski-surum"), CancellationToken.None));
        Assert.IsType<BadRequestObjectResult>(await controller.Record(Decision(status: "maybe"), CancellationToken.None));
        Assert.IsType<BadRequestObjectResult>(await controller.Record(Decision() with { Platform = "hacker" }, CancellationToken.None));
        Assert.Equal(0, db.Context.LegalConsentRecords.Count());
    }

    public void Dispose() => db.Dispose();
}
