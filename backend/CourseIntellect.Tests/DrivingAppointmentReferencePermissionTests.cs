using System.Reflection;
using CourseIntellect.Api.Authorization;
using CourseIntellect.Api.Controllers;
using CourseIntellect.Domain.Permissions;

namespace CourseIntellect.Tests;

public sealed class DrivingAppointmentReferencePermissionTests
{
    [Theory]
    [InlineData(nameof(DrivingSchoolController.GetInstructors), DrivingPermissions.InstructorView)]
    [InlineData(nameof(DrivingSchoolController.GetVehicles), DrivingPermissions.VehicleView)]
    [InlineData(nameof(DrivingSchoolController.GetStudents), DrivingPermissions.StudentView)]
    public void AppointmentCreate_CanReadRequiredCalendarReferenceData(
        string actionName,
        string managementViewPermission)
    {
        var action = typeof(DrivingSchoolController).GetMethod(actionName)
            ?? throw new InvalidOperationException($"{actionName} bulunamadı.");
        var authorization = action.GetCustomAttribute<RequireDrivingPermissionAttribute>()
            ?? throw new InvalidOperationException($"{actionName} için sürücü kursu yetkisi tanımlı değil.");

        Assert.Contains(DrivingPermissions.AppointmentCreate, authorization.Permissions);
        Assert.Contains(managementViewPermission, authorization.Permissions);
    }

    [Fact]
    public void MobilePlanningReference_IsReadableByAppointmentCreators()
    {
        var action = typeof(DrivingAppointmentRequestsController)
            .GetMethod(nameof(DrivingAppointmentRequestsController.PlanningReference))
            ?? throw new InvalidOperationException("PlanningReference bulunamadı.");
        var authorization = action.GetCustomAttribute<RequireDrivingPermissionAttribute>()
            ?? throw new InvalidOperationException("PlanningReference için sürücü kursu yetkisi tanımlı değil.");

        Assert.Contains(DrivingPermissions.AppointmentCreate, authorization.Permissions);
        Assert.Contains(DrivingPermissions.AppointmentView, authorization.Permissions);
    }
}
