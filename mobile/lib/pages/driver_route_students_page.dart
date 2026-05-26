import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../services/service_tracking_api_service.dart';
import '../widgets/admin_ui.dart';
import '../widgets/service_tracking_ui.dart';

class DriverRouteStudentsPage extends StatefulWidget {
  const DriverRouteStudentsPage({super.key});

  @override
  State<DriverRouteStudentsPage> createState() =>
      _DriverRouteStudentsPageState();
}

class _DriverRouteStudentsPageState extends State<DriverRouteStudentsPage> {
  final _api = ServiceTrackingApiService.instance;
  bool _loading = true;
  bool _actionBusy = false;
  bool _locationTracking = false;
  String? _error;
  String? _locationStatus;
  List<DriverTodayRouteRecord> _routes = const [];
  List<DriverRouteStudentRecord> _students = const [];
  DriverTodayRouteRecord? _selectedRoute;
  String? _tripId;
  StreamSubscription<Position>? _positionSubscription;
  DateTime? _lastLocationSentAt;

  @override
  void initState() {
    super.initState();
    _loadRoutes();
  }

  @override
  void dispose() {
    _stopLocationTracking();
    super.dispose();
  }

  Future<void> _loadRoutes() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final routes = await _api.fetchDriverTodayRoutes();
      if (!mounted) return;
      setState(() {
        _routes = routes;
        _selectedRoute = routes.isNotEmpty ? routes.first : null;
        _tripId = _selectedRoute?.tripId.isEmpty == true
            ? null
            : _selectedRoute?.tripId;
      });
      if (_selectedRoute != null) {
        await _loadStudents(_selectedRoute!.routeId);
        if (_tripId != null &&
            _selectedRoute?.tripStatus == 'InProgress' &&
            !_isTripFinished(_selectedRoute?.tripStatus)) {
          await _startLocationTracking();
        }
      } else {
        setState(() => _loading = false);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _loadStudents(String routeId) async {
    try {
      final students = await _api.fetchDriverRouteStudents(routeId);
      if (!mounted) return;
      setState(() {
        _students = students;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(
        title: const Text('Şoför Servis Yoklaması'),
        actions: [
          IconButton(
            onPressed: _loadRoutes,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                ServiceHeroPanel(
                  eyebrow: 'Şoför Operasyon Ekranı',
                  title: 'Rotanı başlat, yoklamayı al, konumu paylaş.',
                  description:
                      'Bindi / Binmedi seçimleri anında veliye gider. GPS takibi servis açıkken arka planda devam eder.',
                  icon: Icons.directions_bus_filled_outlined,
                  colors: const [Color(0xFF06101F), Color(0xFF1D4ED8)],
                  stats: [
                    ServiceHeroStat(
                      label: 'Rota',
                      value: '${_routes.length}',
                      icon: Icons.alt_route_rounded,
                    ),
                    ServiceHeroStat(
                      label: 'Öğrenci',
                      value: '${_students.length}',
                      icon: Icons.school_outlined,
                    ),
                    ServiceHeroStat(
                      label: 'GPS',
                      value: _locationTracking ? 'Açık' : 'Kapalı',
                      icon: Icons.my_location_rounded,
                    ),
                  ],
                ),
                if (_locationStatus != null) ...[
                  const SizedBox(height: 12),
                  ServiceGlassCard(
                    glowColors: [
                      _locationTracking ? serviceGreen : serviceAmber,
                      serviceBlue,
                    ],
                    child: Row(
                      children: [
                        ServiceIconBadge(
                          icon: _locationTracking
                              ? Icons.location_on_outlined
                              : Icons.location_off_outlined,
                          color: _locationTracking
                              ? serviceGreen
                              : serviceAmber,
                          size: 42,
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Text(_locationStatus!)),
                      ],
                    ),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  ServiceGlassCard(
                    glowColors: const [serviceRed, serviceOrange],
                    child: Text(
                      _error!,
                      style: const TextStyle(
                        color: serviceRed,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                if (_routes.isEmpty)
                  const ServiceEmptyPanel(
                    title: 'Bugün için rota yok',
                    description:
                        'Size atanmış servis rotası oluştuğunda burada görünecek.',
                    icon: Icons.route_outlined,
                  )
                else ...[
                  DropdownButtonFormField<DriverTodayRouteRecord>(
                    initialValue: _selectedRoute,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Bugünkü rota',
                    ),
                    items: _routes
                        .map(
                          (route) => DropdownMenuItem(
                            value: route,
                            child: Text(
                              '${_routeTypeLabel(route.routeType)} • ${route.routeName}',
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (route) async {
                      if (route == null) return;
                      setState(() {
                        _selectedRoute = route;
                        _tripId = route.tripId.isEmpty ? null : route.tripId;
                        _loading = true;
                      });
                      _stopLocationTracking();
                      await _loadStudents(route.routeId);
                    },
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      FilledButton.icon(
                        onPressed:
                            _actionBusy ||
                                _selectedRoute == null ||
                                _tripId != null ||
                                _isTripFinished(_selectedRoute?.tripStatus)
                            ? null
                            : _startTrip,
                        icon: const Icon(Icons.play_arrow_rounded),
                        label: Text(
                          _isTripFinished(_selectedRoute?.tripStatus)
                              ? 'Servis Kapandı'
                              : _tripId == null
                              ? 'Servisi Başlat'
                              : 'Servis Açık',
                        ),
                      ),
                      OutlinedButton.icon(
                        onPressed:
                            _actionBusy ||
                                _tripId == null ||
                                _selectedRoute?.routeType != 'Morning' ||
                                _isTripFinished(_selectedRoute?.tripStatus)
                            ? null
                            : _arrivedSchool,
                        icon: const Icon(Icons.school_outlined),
                        label: const Text('Okula Ulaştı'),
                      ),
                      OutlinedButton.icon(
                        onPressed:
                            _actionBusy ||
                                _tripId == null ||
                                _isTripFinished(_selectedRoute?.tripStatus)
                            ? null
                            : _completeTrip,
                        icon: const Icon(Icons.home_outlined),
                        label: const Text('Servis Tamamlandı'),
                      ),
                      OutlinedButton.icon(
                        onPressed: _actionBusy || _tripId == null
                            ? null
                            : (_locationTracking
                                  ? _stopLocationTracking
                                  : _startLocationTracking),
                        icon: Icon(
                          _locationTracking
                              ? Icons.location_off_outlined
                              : Icons.my_location_outlined,
                        ),
                        label: Text(
                          _locationTracking
                              ? 'Arka Plan Konumu Durdur'
                              : 'Arka Plan Konum Başlat',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const ServiceSectionHeader(
                    title: 'Öğrenciler',
                    subtitle:
                        'Durak sırasına göre yoklama alın ve veliye bildirim gönderin.',
                  ),
                  const SizedBox(height: 10),
                  ..._students.map(_studentCard),
                ],
              ],
            ),
    );
  }

  Widget _studentCard(DriverRouteStudentRecord student) {
    final statusColor = student.hasAbsenceRequest
        ? serviceAmber
        : _attendanceColor(student.attendanceStatus);
    return ServiceGlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      glowColors: [statusColor, serviceBlue],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ServiceIconBadge(
                icon: student.hasAbsenceRequest
                    ? Icons.event_busy_outlined
                    : Icons.school_outlined,
                color: statusColor,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      student.studentFullName,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${student.className} • ${student.stopName}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${student.parentFullName} • ${student.parentPhone}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(
                          context,
                        ).textTheme.bodySmall?.color?.withValues(alpha: 0.62),
                      ),
                    ),
                  ],
                ),
              ),
              if (student.hasAbsenceRequest)
                const ServiceStatusPill(
                  label: 'Bugün binmeyecek',
                  color: serviceAmber,
                  icon: Icons.event_busy_outlined,
                )
              else
                ServiceStatusPill(
                  label: _attendanceLabel(student.attendanceStatus),
                  color: statusColor,
                  icon: Icons.check_circle_outline,
                ),
            ],
          ),
          if (student.etaMinutes != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: serviceBlue.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: serviceBlue.withValues(alpha: 0.18)),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.timer_outlined,
                    color: serviceBlue,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Tahmini varış: ${student.etaMinutes} dk',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: serviceGreen,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                  ),
                  onPressed: _actionBusy || _tripId == null
                      ? null
                      : () => _mark(student.studentId, 'Boarded'),
                  child: const Text(
                    'Bindi',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: serviceRed,
                    side: BorderSide(color: serviceRed.withValues(alpha: 0.45)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                  ),
                  onPressed: _actionBusy || _tripId == null
                      ? null
                      : () => _mark(student.studentId, 'NotBoarded'),
                  child: const Text(
                    'Binmedi',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _startTrip() async {
    final route = _selectedRoute;
    if (route == null) return;
    await _runAction(() async {
      final trip = await _api.startTrip(route.routeId);
      setState(() => _tripId = trip['id']?.toString());
      await _refreshSelectedRoute(route.routeId);
      await _startLocationTracking();
      _showMessage('Servis başlatıldı.');
    });
  }

  Future<void> _mark(String studentId, String status) async {
    final tripId = _tripId;
    final routeId = _selectedRoute?.routeId;
    if (tripId == null || routeId == null) return;
    await _runAction(() async {
      await _api.markAttendance(
        tripId: tripId,
        studentId: studentId,
        status: status,
      );
      await _loadStudents(routeId);
      _showMessage(
        status == 'Boarded'
            ? 'Bindi olarak işaretlendi.'
            : 'Binmedi olarak işaretlendi.',
      );
    });
  }

  Future<void> _arrivedSchool() async {
    final tripId = _tripId;
    final routeId = _selectedRoute?.routeId;
    if (tripId == null || routeId == null) return;
    await _runAction(() async {
      await _api.arrivedSchool(tripId);
      await _refreshSelectedRoute(routeId);
      _showMessage('Okula ulaştı bildirimi gönderildi.');
    });
  }

  Future<void> _completeTrip() async {
    final tripId = _tripId;
    final routeId = _selectedRoute?.routeId;
    if (tripId == null || routeId == null) return;
    await _runAction(() async {
      await _api.completeTrip(tripId);
      _stopLocationTracking();
      await _refreshSelectedRoute(routeId);
      _showMessage('Servis tamamlandı.');
    });
  }

  Future<void> _startLocationTracking() async {
    if (_locationTracking) return;
    final tripId = _tripId;
    if (tripId == null) {
      _showMessage('Konum takibi için önce servisi başlatmalısın.');
      return;
    }

    final ready = await _ensureLocationReady();
    if (!ready || !mounted) return;

    await _positionSubscription?.cancel();
    _lastLocationSentAt = null;
    setState(() {
      _locationTracking = true;
      _locationStatus =
          'Arka plan GPS takibi açık. Telefon kilitliyken konum gönderimi devam eder.';
    });

    await _sendSingleCurrentLocation();
    _positionSubscription =
        Geolocator.getPositionStream(
          locationSettings: _backgroundLocationSettings(),
        ).listen(
          _sendPosition,
          onError: (Object error) {
            if (!mounted) return;
            setState(() {
              _locationStatus = 'Arka plan konumu alınamadı: $error';
            });
          },
        );
  }

  void _stopLocationTracking() {
    _positionSubscription?.cancel();
    _positionSubscription = null;
    _lastLocationSentAt = null;
    if (mounted) {
      setState(() {
        _locationTracking = false;
        _locationStatus = 'Arka plan GPS takibi durduruldu.';
      });
    }
  }

  Future<bool> _ensureLocationReady() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      setState(() {
        _locationStatus =
            'Telefon konum servisi kapalı. Lütfen GPS/konum servisini aç.';
      });
      _showMessage('Telefon konum servisi kapalı.');
      return false;
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied) {
      setState(() {
        _locationStatus =
            'Konum izni verilmedi. Otomatik servis takibi başlatılamadı.';
      });
      _showMessage('Konum izni verilmedi.');
      return false;
    }

    if (permission == LocationPermission.deniedForever) {
      setState(() {
        _locationStatus =
            'Konum izni kalıcı olarak kapalı. Ayarlardan CourseIntellect için konum izni verilmeli.';
      });
      _showMessage('Konum izni ayarlardan açılmalı.');
      return false;
    }

    if (permission == LocationPermission.whileInUse) {
      final upgradedPermission = await Geolocator.requestPermission();
      if (upgradedPermission == LocationPermission.always) {
        permission = upgradedPermission;
      }
    }

    if (permission == LocationPermission.whileInUse) {
      setState(() {
        _locationStatus =
            'Konum izni sadece uygulama açıkken verilmiş. Android foreground servis çalışır; iPhone için Ayarlar > Konum > Her Zaman seçeneğini aç.';
      });
    }

    return true;
  }

  LocationSettings _backgroundLocationSettings() {
    if (defaultTargetPlatform == TargetPlatform.android) {
      return AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10,
        intervalDuration: const Duration(seconds: 20),
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: 'Course Intellect servis takibi açık',
          notificationText:
              'Servis rotası boyunca şoför konumu veli ve okul ile paylaşılıyor.',
          notificationChannelName: 'Course Intellect Servis Konumu',
          enableWakeLock: true,
          setOngoing: true,
        ),
      );
    }

    if (defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS) {
      return AppleSettings(
        accuracy: LocationAccuracy.high,
        activityType: ActivityType.automotiveNavigation,
        distanceFilter: 10,
        allowBackgroundLocationUpdates: true,
        pauseLocationUpdatesAutomatically: false,
        showBackgroundLocationIndicator: true,
      );
    }

    return const LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 10,
    );
  }

  Future<void> _sendSingleCurrentLocation() async {
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 12),
        ),
      );
      await _sendPosition(position, force: true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _locationStatus = 'İlk konum alınamadı: $e';
      });
    }
  }

  Future<void> _sendPosition(Position position, {bool force = false}) async {
    final tripId = _tripId;
    if (tripId == null) return;
    final now = DateTime.now();
    if (!force &&
        _lastLocationSentAt != null &&
        now.difference(_lastLocationSentAt!) < const Duration(seconds: 15)) {
      return;
    }
    try {
      await _api.sendDriverLocation(
        tripId: tripId,
        latitude: position.latitude,
        longitude: position.longitude,
        speed: position.speed.isFinite && position.speed >= 0
            ? position.speed * 3.6
            : null,
        heading: position.heading.isFinite && position.heading >= 0
            ? position.heading
            : null,
      );
      _lastLocationSentAt = now;
      if (!mounted) return;
      setState(() {
        _locationStatus =
            'Arka plan konumu gönderildi: ${position.latitude.toStringAsFixed(5)}, ${position.longitude.toStringAsFixed(5)}';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _locationStatus = 'Konum gönderilemedi: $e';
      });
    }
  }

  Future<void> _refreshSelectedRoute(String routeId) async {
    final routes = await _api.fetchDriverTodayRoutes();
    DriverTodayRouteRecord? selected;
    for (final route in routes) {
      if (route.routeId == routeId) {
        selected = route;
        break;
      }
    }
    if (!mounted) return;
    setState(() {
      _routes = routes;
      _selectedRoute = selected ?? (routes.isNotEmpty ? routes.first : null);
      _tripId = _selectedRoute?.tripId.isEmpty == true
          ? null
          : _selectedRoute?.tripId;
    });
    if (_selectedRoute != null) {
      await _loadStudents(_selectedRoute!.routeId);
    }
  }

  Future<void> _runAction(Future<void> Function() action) async {
    if (_actionBusy) return;
    setState(() {
      _actionBusy = true;
      _error = null;
    });
    try {
      await action();
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
      _showMessage(e.toString());
    } finally {
      if (mounted) setState(() => _actionBusy = false);
    }
  }

  bool _isTripFinished(String? status) {
    return status == 'Completed' || status == 'Cancelled';
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}

String _routeTypeLabel(String value) {
  return value == 'Morning'
      ? 'Sabah'
      : value == 'Evening'
      ? 'Akşam'
      : value;
}

String _attendanceLabel(String value) {
  switch (value) {
    case 'Boarded':
      return 'Bindi';
    case 'NotBoarded':
      return 'Binmedi';
    case 'ArrivedSchool':
      return 'Okulda';
    case 'BoardedFromSchool':
      return 'Okul çıkışı';
    case 'ArrivedHome':
      return 'Eve ulaştı';
    case 'Pending':
      return 'Bekliyor';
    default:
      return value.isEmpty ? 'Bekliyor' : value;
  }
}

Color _attendanceColor(String value) {
  switch (value) {
    case 'Boarded':
    case 'ArrivedSchool':
    case 'BoardedFromSchool':
    case 'ArrivedHome':
      return serviceGreen;
    case 'NotBoarded':
      return serviceRed;
    default:
      return serviceBlue;
  }
}
