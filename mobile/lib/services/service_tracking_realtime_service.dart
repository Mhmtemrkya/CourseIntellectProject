import 'dart:async';

import 'package:signalr_netcore/signalr_client.dart';

import 'api_config.dart';
import 'auth_session_store.dart';

class ServiceVehicleLocationEvent {
  final String id;
  final String vehicleId;
  final String driverId;
  final String tripId;
  final double latitude;
  final double longitude;
  final double? speed;
  final double? heading;
  final String recordedAt;

  const ServiceVehicleLocationEvent({
    required this.id,
    required this.vehicleId,
    required this.driverId,
    required this.tripId,
    required this.latitude,
    required this.longitude,
    required this.speed,
    required this.heading,
    required this.recordedAt,
  });

  factory ServiceVehicleLocationEvent.fromMap(Map<String, dynamic> map) {
    return ServiceVehicleLocationEvent(
      id: _asString(map['id']),
      vehicleId: _asString(map['vehicleId']),
      driverId: _asString(map['driverId']),
      tripId: _asString(map['tripId']),
      latitude: _asDouble(map['latitude']),
      longitude: _asDouble(map['longitude']),
      speed: _asNullableDouble(map['speed']),
      heading: _asNullableDouble(map['heading']),
      recordedAt: _asString(map['recordedAt']),
    );
  }
}

class ServiceTrackingRealtimeService {
  HubConnection? _connection;
  bool _handlersRegistered = false;
  final Set<String> _joinedTripIds = <String>{};
  final Set<String> _joinedVehicleIds = <String>{};

  void Function(ServiceVehicleLocationEvent event)? _onVehicleLocation;
  void Function()? _onServiceDataChanged;

  bool get isConnected => _connection?.state == HubConnectionState.Connected;

  Future<void> ensureConnected({
    required void Function(ServiceVehicleLocationEvent event) onVehicleLocation,
    required void Function() onServiceDataChanged,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null || ApiConfig.baseUrl.isEmpty) return;

    _onVehicleLocation = onVehicleLocation;
    _onServiceDataChanged = onServiceDataChanged;

    if (_connection != null &&
        _connection!.state == HubConnectionState.Connected) {
      return;
    }

    _connection ??= HubConnectionBuilder()
        .withUrl(
          '${ApiConfig.baseUrl}/hubs/service-tracking',
          options: HttpConnectionOptions(
            accessTokenFactory: () async =>
                (await AuthSessionStore.instance.load())?.accessToken ?? '',
          ),
        )
        .withAutomaticReconnect()
        .build();

    if (!_handlersRegistered) {
      _connection!.onreconnected(({String? connectionId}) {
        _resubscribe();
      });

      _connection!.on('VehicleLocationUpdated', (arguments) {
        final payload = _firstMap(arguments);
        if (payload == null) return;
        _onVehicleLocation?.call(ServiceVehicleLocationEvent.fromMap(payload));
      });

      _connection!.on('StudentAttendanceUpdated', (_) {
        _onServiceDataChanged?.call();
      });

      _connection!.on('TripStatusUpdated', (_) {
        _onServiceDataChanged?.call();
      });

      _connection!.on('AbsenceRequestCreated', (_) {
        _onServiceDataChanged?.call();
      });

      _handlersRegistered = true;
    }

    if (_connection!.state == HubConnectionState.Disconnected) {
      try {
        await _connection!.start();
        await _resubscribe();
      } catch (_) {}
    }
  }

  Future<void> joinTrips(Iterable<String> tripIds) async {
    final normalized = tripIds
        .where((id) => id.trim().isNotEmpty)
        .map((id) => id.trim())
        .toSet();
    _joinedTripIds
      ..clear()
      ..addAll(normalized);
    if (!isConnected) return;
    for (final tripId in normalized) {
      try {
        await _connection!.invoke('JoinTrip', args: [tripId]);
      } catch (_) {}
    }
  }

  Future<void> joinVehicles(Iterable<String> vehicleIds) async {
    final normalized = vehicleIds
        .where((id) => id.trim().isNotEmpty)
        .map((id) => id.trim())
        .toSet();
    _joinedVehicleIds
      ..clear()
      ..addAll(normalized);
    if (!isConnected) return;
    for (final vehicleId in normalized) {
      try {
        await _connection!.invoke('JoinVehicle', args: [vehicleId]);
      } catch (_) {}
    }
  }

  Future<void> dispose() async {
    final connection = _connection;
    _connection = null;
    _handlersRegistered = false;
    _joinedTripIds.clear();
    _joinedVehicleIds.clear();
    _onVehicleLocation = null;
    _onServiceDataChanged = null;
    if (connection?.state == HubConnectionState.Connected) {
      try {
        await connection!.stop();
      } catch (_) {}
    }
  }

  Future<void> _resubscribe() async {
    if (!isConnected) return;
    for (final tripId in _joinedTripIds) {
      try {
        await _connection!.invoke('JoinTrip', args: [tripId]);
      } catch (_) {}
    }
    for (final vehicleId in _joinedVehicleIds) {
      try {
        await _connection!.invoke('JoinVehicle', args: [vehicleId]);
      } catch (_) {}
    }
  }

  Map<String, dynamic>? _firstMap(List<Object?>? arguments) {
    if (arguments == null || arguments.isEmpty) return null;
    final first = arguments.first;
    if (first is Map) {
      return Map<String, dynamic>.from(first);
    }
    return null;
  }
}

String _asString(dynamic value) => value?.toString() ?? '';

double _asDouble(dynamic value) {
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? 0;
}

double? _asNullableDouble(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}
