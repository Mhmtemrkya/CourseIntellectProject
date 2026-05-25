using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Entities;

public sealed class ServiceVehicle : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string PlateNumber { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public sealed class ServiceDriver : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public Guid UserId { get; set; }
    public string PhoneNumber { get; set; } = string.Empty;
    public string LicenseNumber { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public sealed class ServiceRoute : ITenantScopedEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public ServiceRouteType RouteType { get; set; }
    public Guid VehicleId { get; set; }
    public Guid DriverId { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public sealed class ServiceRouteStop
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RouteId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class StudentServiceAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StudentId { get; set; }
    public Guid ParentId { get; set; }
    public Guid RouteId { get; set; }
    public Guid StopId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class ServiceTrip
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RouteId { get; set; }
    public Guid DriverId { get; set; }
    public Guid VehicleId { get; set; }
    public DateOnly TripDate { get; set; }
    public ServiceTripType TripType { get; set; }
    public ServiceTripStatus Status { get; set; } = ServiceTripStatus.NotStarted;
    public DateTime? StartedAt { get; set; }
    public DateTime? ArrivedAtSchoolAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class ServiceAttendance
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TripId { get; set; }
    public Guid StudentId { get; set; }
    public Guid ParentId { get; set; }
    public ServiceAttendanceStatus Status { get; set; } = ServiceAttendanceStatus.Pending;
    public Guid MarkedByDriverId { get; set; }
    public DateTime MarkedAt { get; set; } = DateTime.UtcNow;
    public string Note { get; set; } = string.Empty;
}

public sealed class ServiceVehicleLocation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid VehicleId { get; set; }
    public Guid DriverId { get; set; }
    public Guid TripId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double? Speed { get; set; }
    public double? Heading { get; set; }
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
}

public sealed class ServiceAbsenceRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid StudentId { get; set; }
    public Guid ParentId { get; set; }
    public Guid RouteId { get; set; }
    public DateOnly Date { get; set; }
    public ServiceTripType TripType { get; set; }
    public string Reason { get; set; } = string.Empty;
    public ServiceAbsenceRequestStatus Status { get; set; } = ServiceAbsenceRequestStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
