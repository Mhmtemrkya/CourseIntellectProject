using CourseIntellect.Application.DTOs.ServiceTracking;

namespace CourseIntellect.Application.Interfaces;

public interface IServiceTrackingService
{
    Task<ServiceVehicleDto> CreateVehicleAsync(CreateServiceVehicleRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ServiceVehicleDto>> GetVehiclesAsync(CancellationToken cancellationToken = default);
    Task<ServiceVehicleDto?> GetVehicleAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ServiceVehicleDto?> UpdateVehicleAsync(Guid id, UpdateServiceVehicleRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteVehicleAsync(Guid id, CancellationToken cancellationToken = default);

    Task<ServiceDriverDto> CreateDriverAsync(CreateServiceDriverRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ServiceDriverDto>> GetDriversAsync(CancellationToken cancellationToken = default);
    Task<ServiceDriverDto?> GetDriverAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ServiceDriverDto?> UpdateDriverAsync(Guid id, UpdateServiceDriverRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteDriverAsync(Guid id, CancellationToken cancellationToken = default);

    Task<ServiceRouteDetailResponse> CreateRouteAsync(CreateServiceRouteRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ServiceRouteListDto>> GetRoutesAsync(string? routeType, bool? isActive, CancellationToken cancellationToken = default);
    Task<ServiceRouteDetailResponse?> GetRouteAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ServiceRouteDetailResponse?> UpdateRouteAsync(Guid id, UpdateServiceRouteRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteRouteAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ServiceRouteDetailResponse?> ActivateRouteAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ServiceRouteDetailResponse?> DeactivateRouteAsync(Guid id, CancellationToken cancellationToken = default);

    Task<ServiceRouteStopDto> CreateStopAsync(Guid routeId, CreateServiceRouteStopRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ServiceRouteStopDto>> GetStopsAsync(Guid routeId, CancellationToken cancellationToken = default);
    Task<ServiceRouteStopDto?> UpdateStopAsync(Guid id, UpdateServiceRouteStopRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteStopAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ServiceRouteStopDto>> ReorderStopsAsync(Guid routeId, ReorderStopsRequest request, CancellationToken cancellationToken = default);

    Task<AssignedStudentResponse> CreateAssignmentAsync(CreateStudentServiceAssignmentRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AssignedStudentResponse>> GetAssignmentsAsync(Guid? routeId, Guid? stopId, CancellationToken cancellationToken = default);
    Task<AssignedStudentResponse?> UpdateAssignmentAsync(Guid id, UpdateStudentServiceAssignmentRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteAssignmentAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ServiceStudentSearchResultDto>> SearchStudentsAsync(string? keyword, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<DriverTodayRouteDto>> GetDriverTodayRoutesAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DriverRouteStudentDto>> GetDriverRouteStudentsAsync(Guid routeId, CancellationToken cancellationToken = default);
    Task<ServiceTripDto> StartTripAsync(StartServiceTripRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DriverRouteStudentDto>> GetTripStudentsAsync(Guid tripId, CancellationToken cancellationToken = default);
    Task<DriverRouteStudentDto> MarkAttendanceAsync(MarkServiceAttendanceRequest request, CancellationToken cancellationToken = default);
    Task<ServiceTripDto?> ArrivedSchoolAsync(Guid tripId, CancellationToken cancellationToken = default);
    Task<ServiceTripDto?> CompleteTripAsync(Guid tripId, CancellationToken cancellationToken = default);
    Task<VehicleLocationDto> UpdateDriverLocationAsync(UpdateVehicleLocationRequest request, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ParentServiceStatusDto>> GetParentLiveStatusAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ServiceHistoryItemDto>> GetParentHistoryAsync(CancellationToken cancellationToken = default);
    Task<ServiceAbsenceRequestDto> CreateAbsenceRequestAsync(CreateServiceAbsenceRequestRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ServiceAbsenceRequestDto>> GetParentAbsenceRequestsAsync(CancellationToken cancellationToken = default);
    Task<bool> CancelAbsenceRequestAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ParentServiceStatusDto>> GetStudentLiveStatusAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ServiceHistoryItemDto>> GetStudentHistoryAsync(CancellationToken cancellationToken = default);
}
