using CourseIntellect.Application.DTOs.ServiceTracking;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/service")]
public sealed class ServiceController(IServiceTrackingService serviceTrackingService) : ControllerBase
{
    private const string ServiceManagers = "Admin,Administrative,InstitutionAdmin,Idare";

    [HttpPost("vehicles")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> CreateVehicle(CreateServiceVehicleRequest request, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.CreateVehicleAsync(request, cancellationToken));

    [HttpGet("vehicles")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> GetVehicles(CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.GetVehiclesAsync(cancellationToken));

    [HttpGet("vehicles/{id:guid}")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> GetVehicle(Guid id, CancellationToken cancellationToken)
    {
        var item = await serviceTrackingService.GetVehicleAsync(id, cancellationToken);
        return item is null ? NotFound(new { message = "Araç bulunamadı." }) : Ok(item);
    }

    [HttpPut("vehicles/{id:guid}")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> UpdateVehicle(Guid id, UpdateServiceVehicleRequest request, CancellationToken cancellationToken)
    {
        var item = await serviceTrackingService.UpdateVehicleAsync(id, request, cancellationToken);
        return item is null ? NotFound(new { message = "Araç bulunamadı." }) : Ok(item);
    }

    [HttpDelete("vehicles/{id:guid}")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> DeleteVehicle(Guid id, CancellationToken cancellationToken) =>
        await serviceTrackingService.DeleteVehicleAsync(id, cancellationToken) ? NoContent() : NotFound(new { message = "Araç bulunamadı." });

    [HttpPost("drivers")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> CreateDriver(CreateServiceDriverRequest request, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.CreateDriverAsync(request, cancellationToken));

    [HttpGet("drivers")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> GetDrivers(CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.GetDriversAsync(cancellationToken));

    [HttpGet("drivers/{id:guid}")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> GetDriver(Guid id, CancellationToken cancellationToken)
    {
        var item = await serviceTrackingService.GetDriverAsync(id, cancellationToken);
        return item is null ? NotFound(new { message = "Şoför bulunamadı." }) : Ok(item);
    }

    [HttpPut("drivers/{id:guid}")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> UpdateDriver(Guid id, UpdateServiceDriverRequest request, CancellationToken cancellationToken)
    {
        var item = await serviceTrackingService.UpdateDriverAsync(id, request, cancellationToken);
        return item is null ? NotFound(new { message = "Şoför bulunamadı." }) : Ok(item);
    }

    [HttpDelete("drivers/{id:guid}")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> DeleteDriver(Guid id, CancellationToken cancellationToken) =>
        await serviceTrackingService.DeleteDriverAsync(id, cancellationToken) ? NoContent() : NotFound(new { message = "Şoför bulunamadı." });

    [HttpPost("routes")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> CreateRoute(CreateServiceRouteRequest request, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.CreateRouteAsync(request, cancellationToken));

    [HttpGet("routes")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> GetRoutes([FromQuery] string? routeType, [FromQuery] bool? isActive, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.GetRoutesAsync(routeType, isActive, cancellationToken));

    [HttpGet("routes/{id:guid}")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> GetRoute(Guid id, CancellationToken cancellationToken)
    {
        var item = await serviceTrackingService.GetRouteAsync(id, cancellationToken);
        return item is null ? NotFound(new { message = "Rota bulunamadı." }) : Ok(item);
    }

    [HttpPut("routes/{id:guid}")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> UpdateRoute(Guid id, UpdateServiceRouteRequest request, CancellationToken cancellationToken)
    {
        var item = await serviceTrackingService.UpdateRouteAsync(id, request, cancellationToken);
        return item is null ? NotFound(new { message = "Rota bulunamadı." }) : Ok(item);
    }

    [HttpDelete("routes/{id:guid}")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> DeleteRoute(Guid id, CancellationToken cancellationToken) =>
        await serviceTrackingService.DeleteRouteAsync(id, cancellationToken) ? NoContent() : NotFound(new { message = "Rota bulunamadı." });

    [HttpPatch("routes/{id:guid}/activate")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> ActivateRoute(Guid id, CancellationToken cancellationToken)
    {
        var item = await serviceTrackingService.ActivateRouteAsync(id, cancellationToken);
        return item is null ? NotFound(new { message = "Rota bulunamadı." }) : Ok(item);
    }

    [HttpPatch("routes/{id:guid}/deactivate")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> DeactivateRoute(Guid id, CancellationToken cancellationToken)
    {
        var item = await serviceTrackingService.DeactivateRouteAsync(id, cancellationToken);
        return item is null ? NotFound(new { message = "Rota bulunamadı." }) : Ok(item);
    }

    [HttpPost("routes/{routeId:guid}/stops")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> CreateStop(Guid routeId, CreateServiceRouteStopRequest request, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.CreateStopAsync(routeId, request, cancellationToken));

    [HttpGet("routes/{routeId:guid}/stops")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> GetStops(Guid routeId, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.GetStopsAsync(routeId, cancellationToken));

    [HttpPut("stops/{id:guid}")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> UpdateStop(Guid id, UpdateServiceRouteStopRequest request, CancellationToken cancellationToken)
    {
        var item = await serviceTrackingService.UpdateStopAsync(id, request, cancellationToken);
        return item is null ? NotFound(new { message = "Durak bulunamadı." }) : Ok(item);
    }

    [HttpDelete("stops/{id:guid}")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> DeleteStop(Guid id, CancellationToken cancellationToken) =>
        await serviceTrackingService.DeleteStopAsync(id, cancellationToken) ? NoContent() : NotFound(new { message = "Durak bulunamadı." });

    [HttpPut("routes/{routeId:guid}/stops/reorder")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> ReorderStops(Guid routeId, ReorderStopsRequest request, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.ReorderStopsAsync(routeId, request, cancellationToken));

    [HttpPost("assignments")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> CreateAssignment(CreateStudentServiceAssignmentRequest request, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.CreateAssignmentAsync(request, cancellationToken));

    [HttpGet("assignments")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> GetAssignments(CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.GetAssignmentsAsync(null, null, cancellationToken));

    [HttpGet("routes/{routeId:guid}/assignments")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> GetRouteAssignments(Guid routeId, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.GetAssignmentsAsync(routeId, null, cancellationToken));

    [HttpGet("stops/{stopId:guid}/assignments")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> GetStopAssignments(Guid stopId, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.GetAssignmentsAsync(null, stopId, cancellationToken));

    [HttpPut("assignments/{id:guid}")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> UpdateAssignment(Guid id, UpdateStudentServiceAssignmentRequest request, CancellationToken cancellationToken)
    {
        var item = await serviceTrackingService.UpdateAssignmentAsync(id, request, cancellationToken);
        return item is null ? NotFound(new { message = "Öğrenci servis ataması bulunamadı." }) : Ok(item);
    }

    [HttpDelete("assignments/{id:guid}")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> DeleteAssignment(Guid id, CancellationToken cancellationToken) =>
        await serviceTrackingService.DeleteAssignmentAsync(id, cancellationToken) ? NoContent() : NotFound(new { message = "Öğrenci servis ataması bulunamadı." });

    [HttpGet("students/search")]
    [Authorize(Roles = ServiceManagers)]
    public async Task<IActionResult> SearchStudents([FromQuery] string? keyword, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.SearchStudentsAsync(keyword, cancellationToken));

    [HttpGet("driver/today-routes")]
    public async Task<IActionResult> GetDriverTodayRoutes(CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.GetDriverTodayRoutesAsync(cancellationToken));

    [HttpGet("driver/routes/{routeId:guid}/students")]
    public async Task<IActionResult> GetDriverRouteStudents(Guid routeId, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.GetDriverRouteStudentsAsync(routeId, cancellationToken));

    [HttpPost("trips/start")]
    public async Task<IActionResult> StartTrip(StartServiceTripRequest request, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.StartTripAsync(request, cancellationToken));

    [HttpGet("trips/{tripId:guid}/students")]
    public async Task<IActionResult> GetTripStudents(Guid tripId, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.GetTripStudentsAsync(tripId, cancellationToken));

    [HttpPost("attendance/mark")]
    public async Task<IActionResult> MarkAttendance(MarkServiceAttendanceRequest request, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.MarkAttendanceAsync(request, cancellationToken));

    [HttpPost("trips/{tripId:guid}/arrived-school")]
    public async Task<IActionResult> ArrivedSchool(Guid tripId, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.ArrivedSchoolAsync(tripId, cancellationToken));

    [HttpPost("trips/{tripId:guid}/completed")]
    public async Task<IActionResult> CompleteTrip(Guid tripId, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.CompleteTripAsync(tripId, cancellationToken));

    [HttpPost("driver/location")]
    public async Task<IActionResult> UpdateDriverLocation(UpdateVehicleLocationRequest request, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.UpdateDriverLocationAsync(request, cancellationToken));

    [HttpGet("parent/live-status")]
    [Authorize(Roles = "Parent")]
    public async Task<IActionResult> GetParentLiveStatus(CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.GetParentLiveStatusAsync(cancellationToken));

    [HttpGet("parent/history")]
    [Authorize(Roles = "Parent")]
    public async Task<IActionResult> GetParentHistory(CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.GetParentHistoryAsync(cancellationToken));

    [HttpPost("parent/absence-request")]
    [Authorize(Roles = "Parent")]
    public async Task<IActionResult> CreateAbsenceRequest(CreateServiceAbsenceRequestRequest request, CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.CreateAbsenceRequestAsync(request, cancellationToken));

    [HttpGet("parent/absence-requests")]
    [Authorize(Roles = "Parent")]
    public async Task<IActionResult> GetParentAbsenceRequests(CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.GetParentAbsenceRequestsAsync(cancellationToken));

    [HttpDelete("parent/absence-requests/{id:guid}")]
    [Authorize(Roles = "Parent")]
    public async Task<IActionResult> CancelAbsenceRequest(Guid id, CancellationToken cancellationToken) =>
        await serviceTrackingService.CancelAbsenceRequestAsync(id, cancellationToken) ? NoContent() : NotFound(new { message = "Talep bulunamadı." });

    [HttpGet("student/live-status")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> GetStudentLiveStatus(CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.GetStudentLiveStatusAsync(cancellationToken));

    [HttpGet("student/history")]
    [Authorize(Roles = "Student")]
    public async Task<IActionResult> GetStudentHistory(CancellationToken cancellationToken) =>
        Ok(await serviceTrackingService.GetStudentHistoryAsync(cancellationToken));
}
