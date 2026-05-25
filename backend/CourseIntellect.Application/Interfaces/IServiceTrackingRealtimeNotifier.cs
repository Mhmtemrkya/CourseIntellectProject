namespace CourseIntellect.Application.Interfaces;

public interface IServiceTrackingRealtimeNotifier
{
    Task VehicleLocationUpdatedAsync(Guid? institutionId, Guid vehicleId, Guid driverId, Guid tripId, object payload, CancellationToken cancellationToken = default);
    Task StudentAttendanceUpdatedAsync(Guid? institutionId, Guid tripId, Guid parentId, object payload, CancellationToken cancellationToken = default);
    Task TripStatusUpdatedAsync(Guid? institutionId, Guid tripId, Guid driverId, object payload, CancellationToken cancellationToken = default);
    Task AbsenceRequestCreatedAsync(Guid? institutionId, Guid parentId, object payload, CancellationToken cancellationToken = default);
}
