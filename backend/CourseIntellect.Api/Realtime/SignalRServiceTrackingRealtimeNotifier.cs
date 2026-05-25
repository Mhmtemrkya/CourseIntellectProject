using CourseIntellect.Api.Hubs;
using CourseIntellect.Application.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace CourseIntellect.Api.Realtime;

public sealed class SignalRServiceTrackingRealtimeNotifier(IHubContext<ServiceTrackingHub> hubContext) : IServiceTrackingRealtimeNotifier
{
    public async Task VehicleLocationUpdatedAsync(Guid? institutionId, Guid vehicleId, Guid driverId, Guid tripId, object payload, CancellationToken cancellationToken = default)
    {
        await SendInstitutionAsync(institutionId, "VehicleLocationUpdated", payload, cancellationToken);
        await hubContext.Clients.Group(ServiceTrackingHub.BuildVehicleGroup(vehicleId)).SendAsync("VehicleLocationUpdated", payload, cancellationToken);
        await hubContext.Clients.Group(ServiceTrackingHub.BuildTripGroup(tripId)).SendAsync("VehicleLocationUpdated", payload, cancellationToken);
        await hubContext.Clients.Group(ServiceTrackingHub.BuildDriverGroup(driverId)).SendAsync("VehicleLocationUpdated", payload, cancellationToken);
    }

    public async Task StudentAttendanceUpdatedAsync(Guid? institutionId, Guid tripId, Guid parentId, object payload, CancellationToken cancellationToken = default)
    {
        await SendInstitutionAsync(institutionId, "StudentAttendanceUpdated", payload, cancellationToken);
        await hubContext.Clients.Group(ServiceTrackingHub.BuildTripGroup(tripId)).SendAsync("StudentAttendanceUpdated", payload, cancellationToken);
        await hubContext.Clients.Group(ServiceTrackingHub.BuildParentGroup(parentId)).SendAsync("StudentAttendanceUpdated", payload, cancellationToken);
    }

    public async Task TripStatusUpdatedAsync(Guid? institutionId, Guid tripId, Guid driverId, object payload, CancellationToken cancellationToken = default)
    {
        await SendInstitutionAsync(institutionId, "TripStatusUpdated", payload, cancellationToken);
        await hubContext.Clients.Group(ServiceTrackingHub.BuildTripGroup(tripId)).SendAsync("TripStatusUpdated", payload, cancellationToken);
        await hubContext.Clients.Group(ServiceTrackingHub.BuildDriverGroup(driverId)).SendAsync("TripStatusUpdated", payload, cancellationToken);
    }

    public async Task AbsenceRequestCreatedAsync(Guid? institutionId, Guid parentId, object payload, CancellationToken cancellationToken = default)
    {
        await SendInstitutionAsync(institutionId, "AbsenceRequestCreated", payload, cancellationToken);
        await hubContext.Clients.Group(ServiceTrackingHub.BuildParentGroup(parentId)).SendAsync("AbsenceRequestCreated", payload, cancellationToken);
    }

    private Task SendInstitutionAsync(Guid? institutionId, string eventName, object payload, CancellationToken cancellationToken)
    {
        return institutionId.HasValue
            ? hubContext.Clients.Group(ServiceTrackingHub.BuildInstitutionGroup(institutionId.Value)).SendAsync(eventName, payload, cancellationToken)
            : Task.CompletedTask;
    }
}
