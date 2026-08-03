using System.Security.Claims;
using CourseIntellect.Api.Controllers;
using CourseIntellect.Application.DTOs.Admin;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Tests;

/// <summary>
/// İzin kayıtları izin türü ve gerekçe (sağlık, ölüm, doğum) taşır. Öğrenci/veli
/// bu uçlara hiç erişememeli; yönetici olmayan personel yalnız KENDİ kayıtlarını
/// görmeli ve yalnız kendi adına izin talep edebilmeli.
/// </summary>
public sealed class StaffHrScopeTests
{
    private sealed class SpyStaffHr : IStaffHrService
    {
        public string? LastLeaveStaffNameFilter { get; private set; }
        public string? LastAssetStaffNameFilter { get; private set; }
        public CreateLeaveRequest? LastCreate { get; private set; }

        public Task<IReadOnlyList<StaffLeaveDto>> GetLeavesAsync(string? status, string? staffName, CancellationToken cancellationToken = default)
        {
            LastLeaveStaffNameFilter = staffName;
            return Task.FromResult<IReadOnlyList<StaffLeaveDto>>([]);
        }

        public Task<IReadOnlyList<StaffAssetDto>> GetAssetsAsync(string? staffName, CancellationToken cancellationToken = default)
        {
            LastAssetStaffNameFilter = staffName;
            return Task.FromResult<IReadOnlyList<StaffAssetDto>>([]);
        }

        public Task<StaffLeaveDto> CreateLeaveAsync(CreateLeaveRequest request, Guid? requesterUserId, string requesterName, CancellationToken cancellationToken = default)
        {
            LastCreate = request;
            return Task.FromResult(new StaffLeaveDto(
                Guid.NewGuid(), request.StaffUserId, request.StaffName, request.LeaveType,
                request.StartDate, request.EndDate, 1, request.Reason ?? string.Empty,
                "Pending", string.Empty, DateTime.UtcNow, null));
        }

        public Task<LeaveBalanceDto> GetLeaveBalanceAsync(string staffName, CancellationToken cancellationToken = default)
            => Task.FromResult(new LeaveBalanceDto(staffName, 0, 0, 0));

        public Task<StaffLeaveDto?> DecideLeaveAsync(Guid id, LeaveDecisionRequest decision, Guid? deciderUserId, string deciderName, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<StaffAssetDto> AssignAssetAsync(AssignAssetRequest request, Guid? actorUserId, string actorName, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<StaffAssetDto?> ReturnAssetAsync(Guid id, Guid? actorUserId, string actorName, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private static StaffHrController Controller(SpyStaffHr spy, string role, string fullName)
        => new(spy)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim(ClaimTypes.Role, role),
                        new Claim("name", fullName),
                        new Claim("nameid", Guid.NewGuid().ToString()),
                    ], "test", "name", ClaimTypes.Role)),
                },
            },
        };

    [Theory]
    [InlineData("Student")]
    [InlineData("Parent")]
    public async Task StudentAndParent_CannotReachHrRecords(string role)
    {
        var spy = new SpyStaffHr();
        var controller = Controller(spy, role, "Yetkisiz Kisi");

        Assert.IsType<ForbidResult>(await controller.GetLeaves(null, null, CancellationToken.None));
        Assert.IsType<ForbidResult>(await controller.GetAssets(null, CancellationToken.None));
        Assert.IsType<ForbidResult>(await controller.GetLeaveBalance("Hasan Yildiz", CancellationToken.None));
        Assert.Null(spy.LastLeaveStaffNameFilter);
    }

    [Fact]
    public async Task Teacher_SeesOnlyOwnLeavesAndAssets()
    {
        var spy = new SpyStaffHr();
        var controller = Controller(spy, "Teacher", "Hasan Yildiz");

        Assert.IsType<OkObjectResult>(await controller.GetLeaves(null, "Baska Personel", CancellationToken.None));
        Assert.IsType<OkObjectResult>(await controller.GetAssets("Baska Personel", CancellationToken.None));

        Assert.Equal("Hasan Yildiz", spy.LastLeaveStaffNameFilter);
        Assert.Equal("Hasan Yildiz", spy.LastAssetStaffNameFilter);
        Assert.IsType<ForbidResult>(await controller.GetLeaveBalance("Baska Personel", CancellationToken.None));
    }

    [Fact]
    public async Task Teacher_CannotFileLeaveForSomeoneElse()
    {
        var spy = new SpyStaffHr();
        var controller = Controller(spy, "Teacher", "Hasan Yildiz");

        await controller.CreateLeave(
            new CreateLeaveRequest(null, "Baska Personel", "Yıllık", DateTime.UtcNow, DateTime.UtcNow.AddDays(2), "x"),
            CancellationToken.None);

        Assert.Equal("Hasan Yildiz", spy.LastCreate!.StaffName);
    }

    [Fact]
    public async Task Manager_SeesWholeStaffAndFilesForOthers()
    {
        var spy = new SpyStaffHr();
        var controller = Controller(spy, "Admin", "Kurum Yonetici");

        Assert.IsType<OkObjectResult>(await controller.GetLeaves(null, null, CancellationToken.None));
        Assert.Null(spy.LastLeaveStaffNameFilter);

        await controller.CreateLeave(
            new CreateLeaveRequest(null, "Ceren Aksoy", "Yıllık", DateTime.UtcNow, DateTime.UtcNow.AddDays(2), "x"),
            CancellationToken.None);
        Assert.Equal("Ceren Aksoy", spy.LastCreate!.StaffName);
    }
}
