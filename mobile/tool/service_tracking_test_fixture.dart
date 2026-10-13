import 'package:student/services/service_tracking_api_service.dart';
import 'package:student/services/service_tracking_realtime_service.dart';

/// Synthetic data only; this fixture never contacts the application's backend.
class ServiceTrackingTestApi implements ServiceTrackingApiService {
  List<ServiceLiveStatusRecord> statuses;
  int parentReads = 0;
  int studentReads = 0;

  ServiceTrackingTestApi({bool hasLocation = true})
    : statuses = [testServiceStatus(hasLocation: hasLocation)];

  @override
  Future<List<ServiceLiveStatusRecord>> fetchParentLiveStatus() async {
    parentReads++;
    return statuses;
  }

  @override
  Future<List<ServiceLiveStatusRecord>> fetchStudentLiveStatus() async {
    studentReads++;
    return statuses;
  }

  @override
  Future<List<ServiceHistoryRecord>> fetchParentHistory() async => [];
  @override
  Future<List<ServiceHistoryRecord>> fetchStudentHistory() async => [];
  @override
  Future<List<ServiceAbsenceRequestRecord>>
  fetchParentAbsenceRequests() async => [];
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class ServiceTrackingTestRealtime implements ServiceTrackingRealtimeService {
  void Function(ServiceVehicleLocationEvent)? onLocation;
  void Function()? onDataChanged;
  List<String> tripIds = [];
  List<String> vehicleIds = [];

  @override
  Future<void> ensureConnected({
    required void Function(ServiceVehicleLocationEvent) onVehicleLocation,
    required void Function() onServiceDataChanged,
  }) async {
    onLocation = onVehicleLocation;
    onDataChanged = onServiceDataChanged;
  }

  @override
  Future<void> joinTrips(Iterable<String> ids) async => tripIds = ids.toList();
  @override
  Future<void> joinVehicles(Iterable<String> ids) async =>
      vehicleIds = ids.toList();
  @override
  Future<void> dispose() async {
    onLocation = null;
    onDataChanged = null;
  }

  void move({
    double latitude = 41.015,
    double longitude = 28.985,
    String tripId = 'test-trip',
    String vehicleId = 'test-vehicle',
  }) {
    onLocation?.call(
      ServiceVehicleLocationEvent(
        id: 'test-location',
        vehicleId: vehicleId,
        driverId: 'test-driver',
        tripId: tripId,
        latitude: latitude,
        longitude: longitude,
        speed: 30,
        heading: 90,
        recordedAt: DateTime.now().toUtc().toIso8601String(),
      ),
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

ServiceLiveStatusRecord testServiceStatus({bool hasLocation = true}) =>
    ServiceLiveStatusRecord.fromMap({
      'studentId': 'test-student',
      'studentFullName': 'Test Öğrenci',
      'routeId': 'test-route',
      'routeName': 'TEST • İstanbul Sabah Servisi',
      'routeType': 'Morning',
      'stopId': 'test-stop',
      'stopName': 'Test Durağı',
      'attendanceStatus': 'Boarded',
      'tripStatus': 'InProgress',
      'tripId': 'test-trip',
      'vehicleId': 'test-vehicle',
      'stopLatitude': 41.01,
      'stopLongitude': 28.98,
      'vehicleLatitude': hasLocation ? 41.02 : null,
      'vehicleLongitude': hasLocation ? 28.99 : null,
      'distanceMeters': hasLocation ? 1393.0 : null,
      'etaMinutes': hasLocation ? 3 : null,
      'lastLocationAt': hasLocation
          ? DateTime.now().toUtc().toIso8601String()
          : '',
    });
