import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class ServiceTrackingApiException implements Exception {
  final String message;

  const ServiceTrackingApiException(this.message);

  @override
  String toString() => message;
}

class ServiceVehicleRecord {
  final String id;
  final String plateNumber;
  final String brand;
  final String model;
  final int capacity;
  final bool isActive;

  const ServiceVehicleRecord({
    required this.id,
    required this.plateNumber,
    required this.brand,
    required this.model,
    required this.capacity,
    required this.isActive,
  });

  factory ServiceVehicleRecord.fromMap(Map<String, dynamic> map) {
    return ServiceVehicleRecord(
      id: _asString(map['id']),
      plateNumber: _asString(map['plateNumber']),
      brand: _asString(map['brand']),
      model: _asString(map['model']),
      capacity: _asInt(map['capacity']),
      isActive: map['isActive'] as bool? ?? true,
    );
  }
}

class ServiceDriverRecord {
  final String id;
  final String userId;
  final String fullName;
  final String phoneNumber;
  final String licenseNumber;
  final bool isActive;

  const ServiceDriverRecord({
    required this.id,
    required this.userId,
    required this.fullName,
    required this.phoneNumber,
    required this.licenseNumber,
    required this.isActive,
  });

  factory ServiceDriverRecord.fromMap(Map<String, dynamic> map) {
    return ServiceDriverRecord(
      id: _asString(map['id']),
      userId: _asString(map['userId']),
      fullName: _asString(map['fullName']),
      phoneNumber: _asString(map['phoneNumber']),
      licenseNumber: _asString(map['licenseNumber']),
      isActive: map['isActive'] as bool? ?? true,
    );
  }
}

class ServiceUserRecord {
  final String id;
  final String fullName;
  final String username;
  final String role;
  final String phone;

  const ServiceUserRecord({
    required this.id,
    required this.fullName,
    required this.username,
    required this.role,
    required this.phone,
  });

  factory ServiceUserRecord.fromMap(Map<String, dynamic> map) {
    return ServiceUserRecord(
      id: _asString(map['id']),
      fullName: _asString(map['fullName'] ?? map['name']),
      username: _asString(map['username'] ?? map['email']),
      role: _asString(map['primaryRole'] ?? map['role']),
      phone: _asString(map['phone']),
    );
  }
}

class ServiceRouteRecord {
  final String id;
  final String name;
  final String routeType;
  final String vehiclePlate;
  final String driverName;
  final String startTime;
  final String endTime;
  final bool isActive;
  final int totalStudents;
  final int capacity;
  final int availableSeats;

  const ServiceRouteRecord({
    required this.id,
    required this.name,
    required this.routeType,
    required this.vehiclePlate,
    required this.driverName,
    required this.startTime,
    required this.endTime,
    required this.isActive,
    required this.totalStudents,
    required this.capacity,
    required this.availableSeats,
  });

  factory ServiceRouteRecord.fromMap(Map<String, dynamic> map) {
    final vehicle = _asMap(map['vehicle']);
    final driver = _asMap(map['driver']);
    return ServiceRouteRecord(
      id: _asString(map['id']),
      name: _asString(map['name']),
      routeType: _asString(map['routeType']),
      vehiclePlate: _asString(vehicle['plateNumber']),
      driverName: _asString(driver['fullName']),
      startTime: _formatTime(map['startTime']),
      endTime: _formatTime(map['endTime']),
      isActive: map['isActive'] as bool? ?? false,
      totalStudents: _asInt(map['totalStudents']),
      capacity: _asInt(map['capacity']),
      availableSeats: _asInt(map['availableSeats']),
    );
  }
}

class ServiceRouteDetailRecord extends ServiceRouteRecord {
  final List<ServiceStopRecord> stops;

  const ServiceRouteDetailRecord({
    required super.id,
    required super.name,
    required super.routeType,
    required super.vehiclePlate,
    required super.driverName,
    required super.startTime,
    required super.endTime,
    required super.isActive,
    required super.totalStudents,
    required super.capacity,
    required super.availableSeats,
    required this.stops,
  });

  factory ServiceRouteDetailRecord.fromMap(Map<String, dynamic> map) {
    final base = ServiceRouteRecord.fromMap(map);
    return ServiceRouteDetailRecord(
      id: base.id,
      name: base.name,
      routeType: base.routeType,
      vehiclePlate: base.vehiclePlate,
      driverName: base.driverName,
      startTime: base.startTime,
      endTime: base.endTime,
      isActive: base.isActive,
      totalStudents: base.totalStudents,
      capacity: base.capacity,
      availableSeats: base.availableSeats,
      stops: _asList(
        map['stops'],
      ).map((item) => ServiceStopRecord.fromMap(item)).toList(),
    );
  }
}

class ServiceStopRecord {
  final String id;
  final String routeId;
  final String name;
  final String address;
  final double latitude;
  final double longitude;
  final int sortOrder;
  final List<AssignedServiceStudentRecord> students;

  const ServiceStopRecord({
    required this.id,
    required this.routeId,
    required this.name,
    required this.address,
    required this.latitude,
    required this.longitude,
    required this.sortOrder,
    this.students = const [],
  });

  factory ServiceStopRecord.fromMap(Map<String, dynamic> map) {
    return ServiceStopRecord(
      id: _asString(map['id'] ?? map['stopId']),
      routeId: _asString(map['routeId']),
      name: _asString(map['name'] ?? map['stopName']),
      address: _asString(map['address']),
      latitude: _asDouble(map['latitude']),
      longitude: _asDouble(map['longitude']),
      sortOrder: _asInt(map['sortOrder']),
      students: _asList(
        map['students'],
      ).map((item) => AssignedServiceStudentRecord.fromMap(item)).toList(),
    );
  }
}

class AssignedServiceStudentRecord {
  final String assignmentId;
  final String studentId;
  final String studentFullName;
  final String parentId;
  final String parentFullName;
  final String parentPhone;
  final String className;
  final String stopId;
  final String stopName;
  final String routeId;
  final String routeName;
  final bool isActive;

  const AssignedServiceStudentRecord({
    required this.assignmentId,
    required this.studentId,
    required this.studentFullName,
    required this.parentId,
    required this.parentFullName,
    required this.parentPhone,
    required this.className,
    required this.stopId,
    required this.stopName,
    required this.routeId,
    required this.routeName,
    required this.isActive,
  });

  factory AssignedServiceStudentRecord.fromMap(Map<String, dynamic> map) {
    return AssignedServiceStudentRecord(
      assignmentId: _asString(map['assignmentId']),
      studentId: _asString(map['studentId']),
      studentFullName: _asString(map['studentFullName']),
      parentId: _asString(map['parentId']),
      parentFullName: _asString(map['parentFullName']),
      parentPhone: _asString(map['parentPhone']),
      className: _asString(map['className']),
      stopId: _asString(map['stopId']),
      stopName: _asString(map['stopName']),
      routeId: _asString(map['routeId']),
      routeName: _asString(map['routeName']),
      isActive: map['isActive'] as bool? ?? true,
    );
  }
}

class ServiceStudentSearchRecord {
  final String studentId;
  final String studentFullName;
  final String className;
  final String parentId;
  final String parentFullName;
  final String parentPhone;

  const ServiceStudentSearchRecord({
    required this.studentId,
    required this.studentFullName,
    required this.className,
    required this.parentId,
    required this.parentFullName,
    required this.parentPhone,
  });

  factory ServiceStudentSearchRecord.fromMap(Map<String, dynamic> map) {
    return ServiceStudentSearchRecord(
      studentId: _asString(map['studentId']),
      studentFullName: _asString(map['studentFullName']),
      className: _asString(map['className']),
      parentId: _asString(map['parentId']),
      parentFullName: _asString(map['parentFullName']),
      parentPhone: _asString(map['parentPhone']),
    );
  }
}

class DriverTodayRouteRecord {
  final String routeId;
  final String routeName;
  final String routeType;
  final String startTime;
  final String endTime;
  final String tripId;
  final String tripStatus;
  final int studentCount;

  const DriverTodayRouteRecord({
    required this.routeId,
    required this.routeName,
    required this.routeType,
    required this.startTime,
    required this.endTime,
    required this.tripId,
    required this.tripStatus,
    required this.studentCount,
  });

  factory DriverTodayRouteRecord.fromMap(Map<String, dynamic> map) {
    return DriverTodayRouteRecord(
      routeId: _asString(map['routeId']),
      routeName: _asString(map['routeName']),
      routeType: _asString(map['routeType']),
      startTime: _formatTime(map['startTime']),
      endTime: _formatTime(map['endTime']),
      tripId: _asString(map['tripId']),
      tripStatus: _asString(map['tripStatus']),
      studentCount: _asInt(map['studentCount']),
    );
  }
}

class DriverRouteStudentRecord {
  final String studentId;
  final String studentFullName;
  final String parentFullName;
  final String parentPhone;
  final String className;
  final String stopName;
  final String attendanceStatus;
  final bool hasAbsenceRequest;
  final int? etaMinutes;

  const DriverRouteStudentRecord({
    required this.studentId,
    required this.studentFullName,
    required this.parentFullName,
    required this.parentPhone,
    required this.className,
    required this.stopName,
    required this.attendanceStatus,
    required this.hasAbsenceRequest,
    required this.etaMinutes,
  });

  factory DriverRouteStudentRecord.fromMap(Map<String, dynamic> map) {
    return DriverRouteStudentRecord(
      studentId: _asString(map['studentId']),
      studentFullName: _asString(map['studentFullName']),
      parentFullName: _asString(map['parentFullName']),
      parentPhone: _asString(map['parentPhone']),
      className: _asString(map['className']),
      stopName: _asString(map['stopName']),
      attendanceStatus: _asString(map['attendanceStatus']),
      hasAbsenceRequest: map['hasAbsenceRequest'] as bool? ?? false,
      etaMinutes: map['etaMinutes'] is num
          ? (map['etaMinutes'] as num).round()
          : null,
    );
  }
}

class ServiceTrackingApiService {
  ServiceTrackingApiService._();

  static final instance = ServiceTrackingApiService._();

  Future<List<ServiceVehicleRecord>> fetchVehicles() async {
    final response = await _get('/api/service/vehicles');
    return _decodeList(
      response,
    ).map((item) => ServiceVehicleRecord.fromMap(item)).toList();
  }

  Future<ServiceVehicleRecord> createVehicle({
    required String plateNumber,
    required String brand,
    required String model,
    required int capacity,
  }) async {
    final response = await _send('POST', '/api/service/vehicles', {
      'plateNumber': plateNumber,
      'brand': brand,
      'model': model,
      'capacity': capacity,
      'isActive': true,
    });
    return ServiceVehicleRecord.fromMap(_decodeMap(response));
  }

  Future<List<ServiceDriverRecord>> fetchDrivers() async {
    final response = await _get('/api/service/drivers');
    return _decodeList(
      response,
    ).map((item) => ServiceDriverRecord.fromMap(item)).toList();
  }

  Future<List<ServiceUserRecord>> fetchUsers() async {
    final response = await _get('/api/users?page=1&pageSize=500');
    final decoded = jsonDecode(response.body);
    final items = decoded is Map
        ? (decoded['items'] as List<dynamic>? ?? const [])
        : decoded as List<dynamic>;
    return items
        .map(
          (item) =>
              ServiceUserRecord.fromMap(Map<String, dynamic>.from(item as Map)),
        )
        .toList();
  }

  Future<ServiceDriverRecord> createDriver({
    required String userId,
    required String phoneNumber,
    required String licenseNumber,
  }) async {
    final response = await _send('POST', '/api/service/drivers', {
      'userId': userId,
      'phoneNumber': phoneNumber,
      'licenseNumber': licenseNumber,
      'isActive': true,
    });
    return ServiceDriverRecord.fromMap(_decodeMap(response));
  }

  Future<List<ServiceRouteRecord>> fetchRoutes({
    String? routeType,
    bool? isActive,
  }) async {
    final query = <String>[];
    if (routeType != null && routeType.isNotEmpty) {
      query.add('routeType=$routeType');
    }
    if (isActive != null) query.add('isActive=$isActive');
    final path =
        '/api/service/routes${query.isEmpty ? '' : '?${query.join('&')}'}';
    final response = await _get(path);
    return _decodeList(
      response,
    ).map((item) => ServiceRouteRecord.fromMap(item)).toList();
  }

  Future<ServiceRouteDetailRecord> fetchRouteDetail(String routeId) async {
    final response = await _get('/api/service/routes/$routeId');
    return ServiceRouteDetailRecord.fromMap(_decodeMap(response));
  }

  Future<ServiceRouteDetailRecord> createRoute({
    required String name,
    required String routeType,
    required String vehicleId,
    required String driverId,
    required String startTime,
    required String endTime,
    required bool isActive,
  }) async {
    final response = await _send('POST', '/api/service/routes', {
      'name': name,
      'routeType': routeType,
      'vehicleId': vehicleId,
      'driverId': driverId,
      'startTime': startTime,
      'endTime': endTime,
      'isActive': isActive,
    });
    return ServiceRouteDetailRecord.fromMap(_decodeMap(response));
  }

  Future<ServiceRouteDetailRecord> setRouteActive(
    String routeId,
    bool active,
  ) async {
    final response = await _send(
      'PATCH',
      '/api/service/routes/$routeId/${active ? 'activate' : 'deactivate'}',
      null,
    );
    return ServiceRouteDetailRecord.fromMap(_decodeMap(response));
  }

  Future<ServiceStopRecord> createStop({
    required String routeId,
    required String name,
    required String address,
    required double latitude,
    required double longitude,
    required int sortOrder,
  }) async {
    final response = await _send('POST', '/api/service/routes/$routeId/stops', {
      'name': name,
      'address': address,
      'latitude': latitude,
      'longitude': longitude,
      'sortOrder': sortOrder,
    });
    return ServiceStopRecord.fromMap(_decodeMap(response));
  }

  Future<List<ServiceStudentSearchRecord>> searchStudents(
    String keyword,
  ) async {
    final response = await _get(
      '/api/service/students/search?keyword=${Uri.encodeQueryComponent(keyword)}',
    );
    return _decodeList(
      response,
    ).map((item) => ServiceStudentSearchRecord.fromMap(item)).toList();
  }

  Future<AssignedServiceStudentRecord> assignStudent({
    required String studentId,
    required String routeId,
    required String stopId,
    String? parentId,
  }) async {
    final response = await _send('POST', '/api/service/assignments', {
      'studentId': studentId,
      'parentId': parentId,
      'routeId': routeId,
      'stopId': stopId,
    });
    return AssignedServiceStudentRecord.fromMap(_decodeMap(response));
  }

  Future<List<DriverTodayRouteRecord>> fetchDriverTodayRoutes() async {
    final response = await _get('/api/service/driver/today-routes');
    return _decodeList(
      response,
    ).map((item) => DriverTodayRouteRecord.fromMap(item)).toList();
  }

  Future<Map<String, dynamic>> startTrip(String routeId) async {
    final response = await _send('POST', '/api/service/trips/start', {
      'routeId': routeId,
    });
    return _decodeMap(response);
  }

  Future<List<DriverRouteStudentRecord>> fetchDriverRouteStudents(
    String routeId,
  ) async {
    final response = await _get('/api/service/driver/routes/$routeId/students');
    return _decodeList(
      response,
    ).map((item) => DriverRouteStudentRecord.fromMap(item)).toList();
  }

  Future<void> markAttendance({
    required String tripId,
    required String studentId,
    required String status,
  }) async {
    await _send('POST', '/api/service/attendance/mark', {
      'tripId': tripId,
      'studentId': studentId,
      'status': status,
      'note': '',
    });
  }

  Future<void> arrivedSchool(String tripId) async {
    await _send('POST', '/api/service/trips/$tripId/arrived-school', null);
  }

  Future<void> completeTrip(String tripId) async {
    await _send('POST', '/api/service/trips/$tripId/completed', null);
  }

  Future<http.Response> _get(String path) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || session.accessToken.isEmpty) {
      throw const ServiceTrackingApiException('Oturum bulunamadı.');
    }
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );
    _ensureSuccess(response);
    return response;
  }

  Future<http.Response> _send(
    String method,
    String path,
    Map<String, dynamic>? body,
  ) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || session.accessToken.isEmpty) {
      throw const ServiceTrackingApiException('Oturum bulunamadı.');
    }
    final request = http.Request(method, Uri.parse('${ApiConfig.baseUrl}$path'))
      ..headers.addAll({
        'Authorization': 'Bearer ${session.accessToken}',
        'Content-Type': 'application/json',
      });
    if (body != null) {
      request.body = jsonEncode(body);
    }
    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);
    _ensureSuccess(response);
    return response;
  }

  void _ensureSuccess(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) return;
    var message = 'Servis işlemi tamamlanamadı (${response.statusCode}).';
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map && decoded['message'] is String) {
        message = decoded['message'] as String;
      }
    } catch (_) {}
    throw ServiceTrackingApiException(message);
  }

  List<Map<String, dynamic>> _decodeList(http.Response response) {
    final decoded = jsonDecode(response.body) as List<dynamic>;
    return decoded
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
  }

  Map<String, dynamic> _decodeMap(http.Response response) {
    return Map<String, dynamic>.from(jsonDecode(response.body) as Map);
  }
}

Map<String, dynamic> _asMap(dynamic value) {
  return value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};
}

List<Map<String, dynamic>> _asList(dynamic value) {
  return value is List
      ? value.map((item) => Map<String, dynamic>.from(item as Map)).toList()
      : <Map<String, dynamic>>[];
}

String _asString(dynamic value) => value?.toString() ?? '';

int _asInt(dynamic value) {
  if (value is int) return value;
  if (value is num) return value.round();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

double _asDouble(dynamic value) {
  if (value is double) return value;
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? 0;
}

String _formatTime(dynamic value) {
  final raw = _asString(value);
  if (raw.length >= 5) return raw.substring(0, 5);
  return raw;
}
