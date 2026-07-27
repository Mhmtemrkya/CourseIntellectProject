using System.Security.Claims;
using CourseIntellect.Domain.Entities;
using CourseIntellect.Domain.Enums;
using CourseIntellect.Domain.Permissions;
using CourseIntellect.Infrastructure.Services;
using Microsoft.Extensions.Caching.Memory;

namespace CourseIntellect.Tests;

/// <summary>
/// Sürücü kursu yetki kurallarının sözleşmesi. Buradaki her testin karşılığı bir
/// iş kuralıdır: sekreter kurum finansını göremez, muhasebe filoya/randevuya
/// dokunamaz, filo sorumlusu öğrenciye erişemez, kimse tavanının üstüne çıkamaz.
/// </summary>
public sealed class DrivingPermissionTests : IDisposable
{
    private readonly TestDb db = new();
    private readonly IMemoryCache cache = new MemoryCache(new MemoryCacheOptions());

    private DrivingPermissionService Service => new(db.Context, cache);

    private static ClaimsPrincipal User(string role, Guid? userId = null, Guid? customRoleId = null)
    {
        var claims = new List<Claim>
        {
            new("role", role),
            new("tenant_id", Guid.NewGuid().ToString()),
            new("nameid", (userId ?? Guid.NewGuid()).ToString()),
        };
        if (customRoleId is not null) claims.Add(new Claim("custom_role_id", customRoleId.Value.ToString()));
        return new ClaimsPrincipal(new ClaimsIdentity(claims, "test", "name", "role"));
    }

    [Fact]
    public async Task Owner_HasEveryPermissionIncludingOverrides()
    {
        var permissions = await Service.GetPermissionsAsync(User("Admin"));

        Assert.Equal(DrivingPermissions.All.Count, permissions.Count);
        Assert.Contains(DrivingPermissions.PermissionManage, permissions);
        Assert.Contains(DrivingPermissions.OverrideVehicleCompliance, permissions);
        Assert.Contains(DrivingPermissions.OverrideStudentDocuments, permissions);
        Assert.Contains(DrivingPermissions.StudentDeactivate, permissions);
        Assert.Contains(DrivingPermissions.InstructorDeactivate, permissions);
    }

    [Fact]
    public async Task BranchManager_HasOperationsAndOverrides_ButNotPermissionOrPackageManagement()
    {
        var permissions = await Service.GetPermissionsAsync(User("BranchManager"));

        Assert.Contains(DrivingPermissions.AppointmentCancel, permissions);
        Assert.Contains(DrivingPermissions.OverrideAppointmentRule, permissions);
        Assert.Contains(DrivingPermissions.CertificateIssue, permissions);
        Assert.DoesNotContain(DrivingPermissions.PermissionManage, permissions);
        Assert.DoesNotContain(DrivingPermissions.SettingsManage, permissions);
        Assert.DoesNotContain(DrivingPermissions.PackageCreate, permissions);
    }

    [Fact]
    public async Task Secretary_CanRegisterAndCollect_ButNeverSeesInstitutionFinanceReports()
    {
        var permissions = await Service.GetPermissionsAsync(User("Administrative"));

        Assert.Contains(DrivingPermissions.StudentCreate, permissions);
        Assert.Contains(DrivingPermissions.AppointmentCreate, permissions);
        Assert.Contains(DrivingPermissions.FinanceCollect, permissions);
        Assert.DoesNotContain(DrivingPermissions.FinanceReportView, permissions);
        Assert.DoesNotContain(DrivingPermissions.FinanceRefund, permissions);
        Assert.DoesNotContain(DrivingPermissions.FinanceDiscount, permissions);
        Assert.DoesNotContain(DrivingPermissions.StudentDeactivate, permissions);
        Assert.DoesNotContain(DrivingPermissions.InstructorDeactivate, permissions);
        Assert.DoesNotContain(DrivingPermissions.CertificateIssue, permissions);
    }

    [Fact]
    public async Task Secretary_CannotOverrideAnyBusinessRule()
    {
        var permissions = await Service.GetPermissionsAsync(User("Administrative"));

        Assert.Empty(permissions.Where(DrivingPermissions.OverrideCodes.Contains));
    }

    [Fact]
    public async Task Accounting_OwnsFinance_ButCannotTouchVehiclesOrAppointments()
    {
        var permissions = await Service.GetPermissionsAsync(User("Accounting"));

        Assert.Contains(DrivingPermissions.FinanceReportView, permissions);
        Assert.Contains(DrivingPermissions.FinanceRefund, permissions);
        Assert.Contains(DrivingPermissions.AppointmentView, permissions);

        Assert.DoesNotContain(DrivingPermissions.AppointmentCreate, permissions);
        Assert.DoesNotContain(DrivingPermissions.AppointmentCancel, permissions);
        Assert.DoesNotContain(DrivingPermissions.VehicleCreate, permissions);
        Assert.DoesNotContain(DrivingPermissions.VehicleUpdate, permissions);
        Assert.DoesNotContain(DrivingPermissions.VehicleServiceManage, permissions);
    }

    [Fact]
    public async Task FleetCustomRole_ReachesOnlyFleetArea()
    {
        var role = new CustomRole
        {
            Name = "Filo Sorumlusu",
            BaseRole = UserRole.Administrative,
            Permissions = DrivingPermissionCatalog.DefaultsFor(DrivingPermissionCatalog.Fleet).ToList(),
        };
        db.Context.CustomRoles.Add(role);
        await db.Context.SaveChangesAsync();

        var permissions = await Service.GetPermissionsAsync(User("Administrative", customRoleId: role.Id));

        Assert.Contains(DrivingPermissions.VehicleUpdate, permissions);
        Assert.Contains(DrivingPermissions.VehicleServiceManage, permissions);
        Assert.Contains(DrivingPermissions.InstructorAssignmentManage, permissions);

        // Filo sorumlusu öğrenciye, finansa ve randevu operasyonuna erişemez.
        Assert.DoesNotContain(DrivingPermissions.StudentCreate, permissions);
        Assert.DoesNotContain(DrivingPermissions.StudentView, permissions);
        Assert.DoesNotContain(DrivingPermissions.FinanceView, permissions);
        Assert.DoesNotContain(DrivingPermissions.AppointmentCreate, permissions);
    }

    [Fact]
    public async Task CustomRole_CannotBeGrantedPermissionsAboveItsBaseRoleCeiling()
    {
        // Kurum admini veritabanına doğrudan yazsa bile tavan üstü kodlar etkisizdir.
        var role = new CustomRole
        {
            Name = "Yetkisini Aşan Sekreter",
            BaseRole = UserRole.Administrative,
            Permissions = [DrivingPermissions.StudentView, DrivingPermissions.OverrideVehicleCompliance, DrivingPermissions.PermissionManage],
        };
        db.Context.CustomRoles.Add(role);
        await db.Context.SaveChangesAsync();

        var permissions = await Service.GetPermissionsAsync(User("Administrative", customRoleId: role.Id));

        Assert.Contains(DrivingPermissions.StudentView, permissions);
        Assert.DoesNotContain(DrivingPermissions.OverrideVehicleCompliance, permissions);
        Assert.DoesNotContain(DrivingPermissions.PermissionManage, permissions);
    }

    [Fact]
    public async Task TeacherWithoutInstructorProfile_IsTheoryInstructor_AndCannotStartDrivingLessons()
    {
        var permissions = await Service.GetPermissionsAsync(User("Teacher"));

        Assert.Contains(DrivingPermissions.TheoryAttendance, permissions);
        Assert.DoesNotContain(DrivingPermissions.LessonStart, permissions);
        Assert.DoesNotContain(DrivingPermissions.LessonComplete, permissions);
    }

    [Fact]
    public async Task TeacherWithInstructorProfile_CanRunDrivingLessons_ButNotManageFleetOrFinance()
    {
        var userId = Guid.NewGuid();
        var staff = new StaffProfile { UserId = userId, FullName = "Direksiyon Öğretmeni" };
        db.Context.Staff.Add(staff);
        db.Context.DrivingInstructorProfiles.Add(new DrivingInstructorProfile { StaffId = staff.Id, LicenseClasses = "B", CanTeachManual = true });
        await db.Context.SaveChangesAsync();

        var permissions = await Service.GetPermissionsAsync(User("Teacher", userId));

        Assert.Contains(DrivingPermissions.LessonStart, permissions);
        Assert.Contains(DrivingPermissions.LessonComplete, permissions);
        Assert.Contains(DrivingPermissions.VehicleServiceReport, permissions);

        Assert.DoesNotContain(DrivingPermissions.VehicleServiceManage, permissions);
        Assert.DoesNotContain(DrivingPermissions.AppointmentCreate, permissions);
        Assert.DoesNotContain(DrivingPermissions.FinanceView, permissions);
        Assert.DoesNotContain(DrivingPermissions.StudentCreate, permissions);
    }

    [Fact]
    public async Task Student_SeesOnlyOwnAreaPermissions()
    {
        var permissions = await Service.GetPermissionsAsync(User("Student"));

        Assert.Contains(DrivingPermissions.StudentDocumentUpload, permissions);
        Assert.Contains(DrivingPermissions.AppointmentView, permissions);
        Assert.Contains(DrivingPermissions.AppointmentCreate, permissions);
        Assert.Contains(DrivingPermissions.AppointmentReschedule, permissions);
        Assert.Contains(DrivingPermissions.GraduationView, permissions);
        Assert.DoesNotContain(DrivingPermissions.StudentView, permissions);
        Assert.DoesNotContain(DrivingPermissions.LessonViewAll, permissions);
        Assert.DoesNotContain(DrivingPermissions.GraduationManage, permissions);
    }

    [Fact]
    public async Task ParentAndCafeteriaRoles_HaveNoDrivingSchoolAccess()
    {
        Assert.Empty(await Service.GetPermissionsAsync(User("Parent")));
        Assert.Empty(await Service.GetPermissionsAsync(User("Cafeteria")));
    }

    public void Dispose()
    {
        db.Dispose();
        cache.Dispose();
    }
}
