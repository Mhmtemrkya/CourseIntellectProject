using System.Security.Claims;
using CourseIntellect.Api.Controllers;
using CourseIntellect.Application.DTOs.PlatformConfigurations;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace CourseIntellect.Tests;

/// <summary>
/// İdari personel "Personel Kaydı" için kurumun branş listesini okuyabilmeli;
/// diğer yapılandırmalar ve tür vermeden toplu okuma yöneticiye kalır.
/// </summary>
public sealed class PlatformConfigurationReadAccessTests
{
    private sealed class StubService : IPlatformConfigurationService
    {
        public Task<IReadOnlyList<PlatformConfigurationDto>> GetAsync(string? configurationType, CancellationToken cancellationToken = default)
            => Task.FromResult<IReadOnlyList<PlatformConfigurationDto>>([]);

        public Task<PlatformConfigurationDto> UpsertAsync(UpsertPlatformConfigurationRequest request, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
    }

    private static PlatformConfigurationsController Controller(string role) =>
        new(new StubService(), null!, null!, NullLogger<PlatformConfigurationsController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.Role, role)], "test")),
                },
            },
        };

    [Theory]
    [InlineData("staff-branches")]
    [InlineData("class-management")]
    public async Task Administrative_can_read_staff_registration_lookups(string type) =>
        Assert.IsType<OkObjectResult>(await Controller("Administrative").Get(type, CancellationToken.None));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("role-management")]
    [InlineData("tenant-customization")]
    public async Task Administrative_cannot_read_other_configuration(string? type) =>
        Assert.IsType<ForbidResult>(await Controller("Administrative").Get(type, CancellationToken.None));

    [Fact]
    public async Task Admin_keeps_full_read_access() =>
        Assert.IsType<OkObjectResult>(await Controller("Admin").Get(null, CancellationToken.None));
}
