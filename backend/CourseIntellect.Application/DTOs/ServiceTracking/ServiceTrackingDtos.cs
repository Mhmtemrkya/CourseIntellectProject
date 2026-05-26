namespace CourseIntellect.Application.DTOs.ServiceTracking;

public sealed record ServiceVehicleDto(Guid Id, Guid? InstitutionId, string PlateNumber, string Brand, string Model, int Capacity, bool IsActive, DateTime CreatedAt, DateTime? UpdatedAt);
public sealed record CreateServiceVehicleRequest(string PlateNumber, string Brand, string Model, int Capacity, bool IsActive = true);
public sealed record UpdateServiceVehicleRequest(string PlateNumber, string Brand, string Model, int Capacity, bool IsActive);

public sealed record ServiceDriverDto(Guid Id, Guid? InstitutionId, Guid UserId, string FullName, string PhoneNumber, string LicenseNumber, bool IsActive, DateTime CreatedAt, DateTime? UpdatedAt);
public sealed record CreateServiceDriverRequest(Guid UserId, string PhoneNumber, string LicenseNumber, bool IsActive = true);
public sealed record UpdateServiceDriverRequest(Guid UserId, string PhoneNumber, string LicenseNumber, bool IsActive);

public sealed record CreateServiceRouteRequest(string Name, string RouteType, Guid VehicleId, Guid DriverId, TimeOnly StartTime, TimeOnly EndTime, bool IsActive);
public sealed record UpdateServiceRouteRequest(string Name, string RouteType, Guid VehicleId, Guid DriverId, TimeOnly StartTime, TimeOnly EndTime, bool IsActive);
public sealed record ServiceRouteListDto(Guid Id, Guid? InstitutionId, string Name, string RouteType, ServiceVehicleBriefDto? Vehicle, ServiceDriverBriefDto? Driver, TimeOnly StartTime, TimeOnly EndTime, bool IsActive, int TotalStudents, int Capacity, int AvailableSeats);
public sealed record ServiceVehicleBriefDto(Guid Id, string PlateNumber, string Brand, string Model, int Capacity);
public sealed record ServiceDriverBriefDto(Guid Id, Guid UserId, string FullName, string PhoneNumber);
public sealed record ServiceRouteDetailResponse(Guid Id, string Name, string RouteType, ServiceVehicleBriefDto? Vehicle, ServiceDriverBriefDto? Driver, TimeOnly StartTime, TimeOnly EndTime, bool IsActive, int TotalStudents, int Capacity, int AvailableSeats, IReadOnlyList<StopWithStudentsResponse> Stops);

public sealed record CreateServiceRouteStopRequest(string Name, string Address, double Latitude, double Longitude, int SortOrder);
public sealed record UpdateServiceRouteStopRequest(string Name, string Address, double Latitude, double Longitude, int SortOrder);
public sealed record ReorderStopsRequest(IReadOnlyList<ReorderStopItemRequest> Stops);
public sealed record ReorderStopItemRequest(Guid StopId, int SortOrder);
public sealed record ServiceRouteStopDto(Guid Id, Guid RouteId, string Name, string Address, double Latitude, double Longitude, int SortOrder, DateTime CreatedAt);
public sealed record StopWithStudentsResponse(Guid StopId, string StopName, string Address, double Latitude, double Longitude, int SortOrder, IReadOnlyList<AssignedStudentResponse> Students);

public sealed record CreateStudentServiceAssignmentRequest(Guid StudentId, Guid? ParentId, Guid RouteId, Guid StopId);
public sealed record UpdateStudentServiceAssignmentRequest(Guid RouteId, Guid StopId, bool IsActive);
public sealed record AssignedStudentResponse(Guid AssignmentId, Guid StudentId, string StudentFullName, Guid ParentId, string ParentFullName, string ParentPhone, string ClassName, Guid StopId, string StopName, Guid RouteId, string RouteName, bool IsActive);
public sealed record ServiceStudentSearchResultDto(Guid StudentId, string StudentFullName, string ClassName, Guid? ParentId, string ParentFullName, string ParentPhone);

public sealed record StartServiceTripRequest(Guid RouteId);
public sealed record ServiceTripDto(Guid Id, Guid RouteId, Guid DriverId, Guid VehicleId, DateOnly TripDate, string TripType, string Status, DateTime? StartedAt, DateTime? ArrivedAtSchoolAt, DateTime? CompletedAt);
public sealed record MarkServiceAttendanceRequest(Guid TripId, Guid StudentId, string Status, string? Note);
public sealed record DriverRouteStudentDto(Guid AssignmentId, Guid StudentId, string StudentFullName, Guid ParentId, string ParentFullName, string ParentPhone, string ClassName, Guid StopId, string StopName, int StopSortOrder, string AttendanceStatus, bool HasAbsenceRequest, string? AbsenceRequestStatus, int? EtaMinutes);
public sealed record DriverTodayRouteDto(Guid RouteId, string RouteName, string RouteType, TimeOnly StartTime, TimeOnly EndTime, Guid? TripId, string? TripStatus, int StudentCount);
public sealed record UpdateVehicleLocationRequest(Guid TripId, double Latitude, double Longitude, double? Speed, double? Heading);
public sealed record VehicleLocationDto(Guid Id, Guid VehicleId, Guid DriverId, Guid TripId, double Latitude, double Longitude, double? Speed, double? Heading, DateTime RecordedAt);

public sealed record ParentServiceStatusDto(
    Guid StudentId,
    string StudentFullName,
    Guid RouteId,
    string RouteName,
    string RouteType,
    Guid StopId,
    string StopName,
    string AttendanceStatus,
    string? TripStatus,
    Guid? TripId,
    Guid? VehicleId,
    int? EtaMinutes,
    double StopLatitude,
    double StopLongitude,
    double? VehicleLatitude,
    double? VehicleLongitude,
    double? DistanceMeters,
    DateTime? LastLocationAt);
public sealed record ServiceHistoryItemDto(Guid TripId, DateOnly TripDate, string TripType, string RouteName, string AttendanceStatus, DateTime? MarkedAt);
public sealed record CreateServiceAbsenceRequestRequest(Guid StudentId, Guid RouteId, DateOnly Date, string TripType, string? Reason);
public sealed record ServiceAbsenceRequestDto(Guid Id, Guid StudentId, string StudentFullName, Guid ParentId, string ParentFullName, Guid RouteId, string RouteName, DateOnly Date, string TripType, string Reason, string Status, DateTime CreatedAt);
