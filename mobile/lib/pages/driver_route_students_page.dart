import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../services/service_tracking_api_service.dart';
import '../utils/session_navigation.dart';
import '../widgets/admin_ui.dart';
import '../widgets/service_tracking_ui.dart';

class DriverRouteStudentsPage extends StatefulWidget {
  /// true ise sayfa şoförün ana ekranıdır: geri dönüş yerine çıkış sunulur.
  final bool standalone;

  const DriverRouteStudentsPage({super.key, this.standalone = false});

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
        title: const Text('Servis Şoförü'),
        automaticallyImplyLeading: !widget.standalone,
        actions: [
          IconButton(
            onPressed: _loadRoutes,
            icon: const Icon(Icons.refresh_rounded),
          ),
          if (widget.standalone)
            IconButton(
              tooltip: 'Çıkış Yap',
              onPressed: () => logoutToRoleSelect(context),
              icon: const Icon(Icons.logout_rounded),
            ),
        ],
      ),
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _driverWelcomeHeader(),
                const SizedBox(height: 14),
                _operationCards(),
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
                  _routeControls(),
                  const SizedBox(height: 16),
                  _routeTimelineCard(),
                  const SizedBox(height: 12),
                  _liveTrackingCard(),
                  const SizedBox(height: 16),
                  ServiceSectionHeader(
                    title: 'Öğrenci Alım Listesi',
                    subtitle:
                        'Durak sırasına göre yoklama alın ve veliye bildirim gönderin.',
                    trailing: ServiceStatusPill(
                      label: '$_boardedCount / ${_students.length}',
                      color: serviceGreen,
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (_students.isEmpty)
                    const ServiceEmptyPanel(
                      title: 'Bu rotada öğrenci yok',
                      description:
                          'Yönetim panelinden öğrenci ataması yapıldığında liste burada görünecek.',
                      icon: Icons.groups_2_outlined,
                    )
                  else
                    ..._students.map(_studentCard),
                ],
              ],
            ),
    );
  }

  int get _boardedCount => _students
      .where((student) => _isAttendanceCompleted(student.attendanceStatus))
      .length;

  int get _notBoardedCount => _students
      .where((student) => student.attendanceStatus == 'NotBoarded')
      .length;

  int get _remainingCount {
    final remaining = _students.length - _boardedCount - _notBoardedCount;
    return remaining < 0 ? 0 : remaining;
  }

  Widget _driverWelcomeHeader() {
    final route = _selectedRoute;
    return ServiceHeroPanel(
      eyebrow: route == null
          ? 'Bugünkü görev'
          : _routeTypeLabel(route.routeType),
      title: route == null
          ? 'Bugün atanmış servis rotası bulunmuyor.'
          : route.routeName,
      description: route == null
          ? 'Rota atandığında yolculuk, yoklama ve konum paylaşımı bu ekrandan yönetilecek.'
          : '${route.startTime}-${route.endTime} arasında yoklama ve konum paylaşımı gerçek zamanlı çalışır.',
      icon: Icons.directions_bus_filled_outlined,
      colors: const [Color(0xFF06101F), Color(0xFF132A4C)],
      stats: [
        ServiceHeroStat(
          label: 'Durum',
          value: route == null ? 'Yok' : _tripStatusLabel(route.tripStatus),
          icon: Icons.sensors_rounded,
        ),
        ServiceHeroStat(
          label: 'Öğrenci',
          value: '${_students.length}',
          icon: Icons.groups_2_outlined,
        ),
        ServiceHeroStat(
          label: 'GPS',
          value: _locationTracking ? 'Canlı' : 'Kapalı',
          icon: _locationTracking
              ? Icons.my_location_rounded
              : Icons.location_off_outlined,
        ),
      ],
    );
  }

  Widget _operationCards() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 640 ? 4 : 2;
        final gap = 10.0;
        final width = (constraints.maxWidth - gap * (columns - 1)) / columns;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            SizedBox(
              width: width,
              child: _miniMetricCard(
                icon: Icons.alt_route_rounded,
                color: serviceBlue,
                label: 'Bugünkü Rota',
                value: '${_routes.length}',
                detail: 'Toplam rota',
              ),
            ),
            SizedBox(
              width: width,
              child: _miniMetricCard(
                icon: Icons.groups_2_outlined,
                color: serviceGreen,
                label: 'Öğrenci',
                value: '${_students.length}',
                detail: 'Toplam',
              ),
            ),
            SizedBox(
              width: width,
              child: _miniMetricCard(
                icon: Icons.check_circle_outline,
                color: serviceOrange,
                label: 'Tamamlanan',
                value: '$_boardedCount',
                detail: 'Öğrenci',
              ),
            ),
            SizedBox(
              width: width,
              child: _miniMetricCard(
                icon: Icons.place_outlined,
                color: servicePurple,
                label: 'Kalan',
                value: '$_remainingCount',
                detail: 'Bekliyor',
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _miniMetricCard({
    required IconData icon,
    required Color color,
    required String label,
    required String value,
    required String detail,
  }) {
    return ServiceGlassCard(
      padding: const EdgeInsets.all(14),
      glowColors: [color, serviceBlue],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ServiceIconBadge(icon: icon, color: color, size: 42),
          const SizedBox(height: 12),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 5),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          Text(
            detail,
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
    );
  }

  Widget _routeControls() {
    return ServiceGlassCard(
      padding: const EdgeInsets.all(14),
      glowColors: const [serviceOrange, serviceBlue],
      child: Wrap(
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
            icon: const Icon(Icons.flag_circle_outlined),
            label: const Text('Servisi Tamamla'),
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
            label: Text(_locationTracking ? 'GPS Durdur' : 'GPS Başlat'),
          ),
        ],
      ),
    );
  }

  Widget _routeTimelineCard() {
    final route = _selectedRoute;
    final stops = _routeStopNames();
    return ServiceGlassCard(
      glowColors: const [serviceBlue, serviceOrange],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ServiceSectionHeader(
            title: 'Bugünkü Rota',
            trailing: route == null
                ? null
                : ServiceStatusPill(
                    label: _tripStatusLabel(route.tripStatus),
                    color: _tripId == null ? serviceAmber : serviceGreen,
                    icon: Icons.sensors_rounded,
                  ),
          ),
          const SizedBox(height: 14),
          if (route == null)
            const ServiceEmptyPanel(
              title: 'Rota bilgisi yok',
              description: 'Şoföre rota atandığında güzergah burada oluşur.',
              icon: Icons.route_outlined,
            )
          else ...[
            _routeStep(
              title: route.routeType == 'Morning'
                  ? 'Kalkış Noktası'
                  : 'Okul Çıkışı',
              subtitle: route.routeName,
              time: route.startTime,
              color: serviceGreen,
              icon: Icons.flag_rounded,
            ),
            for (var i = 0; i < stops.length; i++)
              _routeStep(
                title: '${i + 1}. Durak',
                subtitle: stops[i],
                time: null,
                color: i < _boardedCount ? serviceGreen : serviceBlue,
                icon: Icons.location_on_outlined,
              ),
            _routeStep(
              title: route.routeType == 'Morning'
                  ? 'Varış Noktası'
                  : 'Son Durak',
              subtitle: route.routeType == 'Morning' ? 'Okul' : route.routeName,
              time: route.endTime,
              color: serviceRed,
              icon: Icons.school_outlined,
              isLast: true,
            ),
          ],
        ],
      ),
    );
  }

  Widget _routeStep({
    required String title,
    required String subtitle,
    required String? time,
    required Color color,
    required IconData icon,
    bool isLast = false,
  }) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.16),
                  shape: BoxShape.circle,
                  border: Border.all(color: color.withValues(alpha: 0.42)),
                ),
                child: Icon(icon, size: 18, color: color),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    color: color.withValues(alpha: 0.26),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(
                        context,
                      ).textTheme.bodySmall?.color?.withValues(alpha: 0.68),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (time != null)
            Text(
              time,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: color,
                fontWeight: FontWeight.w900,
              ),
            ),
        ],
      ),
    );
  }

  Widget _liveTrackingCard() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth > 620;
        final mapPanel = ServiceGlassCard(
          padding: EdgeInsets.zero,
          glowColors: const [serviceBlue, servicePurple],
          child: Container(
            height: wide ? 260 : 210,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(28),
              gradient: const LinearGradient(
                colors: [Color(0xFF07111F), Color(0xFF10223C)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Stack(
              children: [
                Positioned.fill(
                  child: CustomPaint(painter: _RoutePreviewPainter()),
                ),
                Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ServiceIconBadge(
                        icon: _locationTracking
                            ? Icons.near_me_rounded
                            : Icons.map_outlined,
                        color: _locationTracking ? serviceGreen : serviceBlue,
                        size: 58,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _locationTracking
                            ? 'Canlı konum gönderiliyor'
                            : 'Konum bekleniyor',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 28),
                        child: Text(
                          _locationTracking
                              ? 'Şoför GPS bilgisi mevcut yolculuk API’sine aktarılıyor.'
                              : 'Servis başlatıldığında GPS paylaşımı aktif hale gelir.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.68),
                            fontSize: 12,
                            height: 1.35,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );

        final notifications = ServiceGlassCard(
          glowColors: const [serviceAmber, serviceOrange],
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ServiceSectionHeader(title: 'Bildirimler'),
              const SizedBox(height: 12),
              _notificationRow(
                icon: Icons.event_busy_outlined,
                color: serviceAmber,
                title: 'Servise binmeyecek',
                detail:
                    '${_students.where((item) => item.hasAbsenceRequest).length} öğrenci talebi',
              ),
              const Divider(height: 22),
              _notificationRow(
                icon: _locationTracking
                    ? Icons.location_on_outlined
                    : Icons.location_off_outlined,
                color: _locationTracking ? serviceGreen : serviceBlue,
                title: 'Konum paylaşımı',
                detail: _locationTracking
                    ? 'Aktif'
                    : 'Servis başlayınca açılır',
              ),
            ],
          ),
        );

        if (wide) {
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: mapPanel),
              const SizedBox(width: 12),
              Expanded(child: notifications),
            ],
          );
        }
        return Column(
          children: [mapPanel, const SizedBox(height: 12), notifications],
        );
      },
    );
  }

  Widget _notificationRow({
    required IconData icon,
    required Color color,
    required String title,
    required String detail,
  }) {
    return Row(
      children: [
        ServiceIconBadge(icon: icon, color: color, size: 38),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(
                  context,
                ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 3),
              Text(
                detail,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(
                    context,
                  ).textTheme.bodySmall?.color?.withValues(alpha: 0.66),
                ),
              ),
            ],
          ),
        ),
      ],
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
            'Konum izni kalıcı olarak kapalı. Ayarlardan SchoolAsist için konum izni verilmeli.';
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

  bool _isAttendanceCompleted(String status) {
    return status == 'Boarded' ||
        status == 'ArrivedSchool' ||
        status == 'BoardedFromSchool' ||
        status == 'ArrivedHome';
  }

  List<String> _routeStopNames() {
    final names = <String>[];
    for (final student in _students) {
      final name = student.stopName.trim();
      if (name.isNotEmpty && !names.contains(name)) {
        names.add(name);
      }
    }
    return names;
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}

String _tripStatusLabel(String value) {
  switch (value) {
    case 'InProgress':
      return 'Görevde';
    case 'Completed':
      return 'Tamamlandı';
    case 'Cancelled':
      return 'İptal';
    case 'Scheduled':
      return 'Planlandı';
    default:
      return value.isEmpty ? 'Bekliyor' : value;
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

class _RoutePreviewPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final gridPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.035)
      ..strokeWidth = 1;
    for (var x = 0.0; x < size.width; x += 38) {
      canvas.drawLine(Offset(x, 0), Offset(x + 42, size.height), gridPaint);
    }
    for (var y = 0.0; y < size.height; y += 34) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y + 20), gridPaint);
    }

    final routePaint = Paint()
      ..color = serviceBlue
      ..strokeWidth = 5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final path = Path()
      ..moveTo(size.width * 0.10, size.height * 0.70)
      ..lineTo(size.width * 0.24, size.height * 0.48)
      ..lineTo(size.width * 0.40, size.height * 0.55)
      ..lineTo(size.width * 0.58, size.height * 0.36)
      ..lineTo(size.width * 0.78, size.height * 0.42)
      ..lineTo(size.width * 0.90, size.height * 0.24);
    canvas.drawPath(path, routePaint);

    final glowPaint = Paint()
      ..color = serviceOrange.withValues(alpha: 0.16)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 18);
    canvas.drawCircle(
      Offset(size.width * 0.58, size.height * 0.36),
      28,
      glowPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
