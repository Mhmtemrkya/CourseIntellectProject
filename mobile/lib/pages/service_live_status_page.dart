import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../services/service_tracking_api_service.dart';
import '../services/service_tracking_realtime_service.dart';
import '../widgets/admin_ui.dart';
import '../widgets/service_tracking_ui.dart';

class ServiceLiveStatusPage extends StatefulWidget {
  final bool parentMode;

  const ServiceLiveStatusPage({super.key, required this.parentMode});

  @override
  State<ServiceLiveStatusPage> createState() => _ServiceLiveStatusPageState();
}

class _ServiceLiveStatusPageState extends State<ServiceLiveStatusPage> {
  final _api = ServiceTrackingApiService.instance;
  final _realtime = ServiceTrackingRealtimeService();
  bool _loading = true;
  String? _error;
  List<ServiceLiveStatusRecord> _statuses = const [];
  List<ServiceHistoryRecord> _history = const [];
  List<ServiceAbsenceRequestRecord> _requests = const [];
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _load();
    _refreshTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      _load(silent: true);
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _realtime.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      if (widget.parentMode) {
        final results = await Future.wait([
          _api.fetchParentLiveStatus(),
          _api.fetchParentHistory(),
          _api.fetchParentAbsenceRequests(),
        ]);
        if (!mounted) return;
        setState(() {
          _statuses = results[0] as List<ServiceLiveStatusRecord>;
          _history = results[1] as List<ServiceHistoryRecord>;
          _requests = results[2] as List<ServiceAbsenceRequestRecord>;
          _loading = false;
          _error = null;
        });
        await _syncRealtimeSubscriptions();
      } else {
        final results = await Future.wait([
          _api.fetchStudentLiveStatus(),
          _api.fetchStudentHistory(),
        ]);
        if (!mounted) return;
        setState(() {
          _statuses = results[0] as List<ServiceLiveStatusRecord>;
          _history = results[1] as List<ServiceHistoryRecord>;
          _requests = const [];
          _loading = false;
          _error = null;
        });
        await _syncRealtimeSubscriptions();
      }
    } catch (e) {
      if (!mounted) return;
      if (silent) return;
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
        title: Text(widget.parentMode ? 'Servis Takip' : 'Servisim'),
        actions: [
          IconButton(
            onPressed: () => _load(),
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
                  eyebrow: widget.parentMode
                      ? 'Veli Canlı Servis'
                      : 'Öğrenci Servisim',
                  title: widget.parentMode
                      ? 'Çocuğunuzun servis durumunu canlı izleyin.'
                      : 'Servis durumunuzu ve geçmişinizi görün.',
                  description:
                      'Bindi, binmedi, okula ulaştı ve eve ulaştı bildirimleri burada takip edilir.',
                  icon: widget.parentMode
                      ? Icons.family_restroom_outlined
                      : Icons.directions_bus_filled_outlined,
                  colors: const [Color(0xFF06101F), Color(0xFF2563EB)],
                  stats: [
                    ServiceHeroStat(
                      label: 'Aktif',
                      value: '${_statuses.length}',
                      icon: Icons.sensors_rounded,
                    ),
                    ServiceHeroStat(
                      label: 'Geçmiş',
                      value: '${_history.length}',
                      icon: Icons.history_rounded,
                    ),
                    ServiceHeroStat(
                      label: 'Talep',
                      value: '${_requests.length}',
                      icon: Icons.event_busy_outlined,
                    ),
                  ],
                ),
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
                const SizedBox(height: 16),
                if (widget.parentMode)
                  ServiceQuickAction(
                    title: 'Servis Kullanmayacak Talebi',
                    subtitle:
                        'Yarın sabah, akşam veya tüm gün için talep açın.',
                    icon: Icons.event_busy_outlined,
                    color: serviceOrange,
                    onTap: _statuses.isEmpty ? null : _showAbsenceRequestDialog,
                  ),
                if (widget.parentMode) const SizedBox(height: 16),
                const ServiceSectionHeader(
                  title: 'Canlı Durum',
                  subtitle: 'Servis, durak ve tahmini varış bilgileri',
                ),
                const SizedBox(height: 10),
                if (_statuses.isEmpty)
                  const ServiceEmptyPanel(
                    title: 'Servis ataması bulunamadı',
                    description:
                        'Atama yapıldığında canlı servis durumu burada görünecek.',
                    icon: Icons.directions_bus_outlined,
                  )
                else
                  ..._statuses.map(_statusCard),
                if (widget.parentMode) ...[
                  const SizedBox(height: 18),
                  const ServiceSectionHeader(
                    title: 'Servis Kullanmayacak Talepleri',
                    subtitle: 'Oluşturduğunuz taleplerin son durumu',
                  ),
                  const SizedBox(height: 10),
                  if (_requests.isEmpty)
                    const ServiceEmptyPanel(
                      title: 'Henüz talep yok',
                      description:
                          'Yarın servise binmeyecek durumları için buradan talep oluşturabilirsiniz.',
                      icon: Icons.event_available_outlined,
                    )
                  else
                    ..._requests.map(_requestCard),
                ],
                const SizedBox(height: 18),
                const ServiceSectionHeader(
                  title: 'Geçmiş',
                  subtitle: 'Önceki servis hareketleri',
                ),
                const SizedBox(height: 10),
                if (_history.isEmpty)
                  const ServiceEmptyPanel(
                    title: 'Geçmiş henüz oluşmadı',
                    description:
                        'Servis hareketleri tamamlandıkça kayıtlar burada listelenecek.',
                    icon: Icons.history_rounded,
                  )
                else
                  ..._history.map(_historyCard),
              ],
            ),
    );
  }

  Widget _statusCard(ServiceLiveStatusRecord item) {
    final statusColor = _attendanceColor(item.attendanceStatus);
    return ServiceGlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      glowColors: [statusColor, serviceBlue],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ServiceIconBadge(
                icon: Icons.directions_bus_filled_outlined,
                color: statusColor,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.studentFullName,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_routeTypeLabel(item.routeType)} • ${item.routeName}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              ServiceStatusPill(
                label: item.tripStatus.isEmpty ? 'Bekliyor' : item.tripStatus,
                color: serviceBlue,
                icon: Icons.sensors_rounded,
              ),
            ],
          ),
          const SizedBox(height: 14),
          ServiceInfoRow(
            icon: Icons.place_outlined,
            label: 'Durak',
            value: item.stopName,
            color: serviceOrange,
          ),
          const SizedBox(height: 8),
          ServiceInfoRow(
            icon: Icons.fact_check_outlined,
            label: 'Durum',
            value: _attendanceLabel(item.attendanceStatus),
            color: statusColor,
          ),
          if (item.etaMinutes != null) ...[
            const SizedBox(height: 8),
            ServiceInfoRow(
              icon: Icons.timer_outlined,
              label: 'ETA',
              value: '${item.etaMinutes} dk',
              color: serviceGreen,
            ),
          ],
          const SizedBox(height: 14),
          _liveMapCard(item),
        ],
      ),
    );
  }

  Widget _liveMapCard(ServiceLiveStatusRecord item) {
    final distance = _formatDistance(item.distanceMeters);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: LinearGradient(
          colors: [
            serviceBlue.withValues(alpha: 0.14),
            serviceOrange.withValues(alpha: 0.08),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: serviceBlue.withValues(alpha: 0.16)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const ServiceIconBadge(
                icon: Icons.map_outlined,
                color: serviceBlue,
                size: 38,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Canlı servis haritası',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      item.hasVehicleLocation
                          ? 'Servis durağa $distance uzaklıkta.'
                          : 'Servis konumu henüz gelmedi.',
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
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 220,
            width: double.infinity,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: Stack(
                children: [
                  _OpenStreetServiceMap(item: item),
                  const Positioned(
                    left: 14,
                    bottom: 12,
                    child: _MapLegendDot(
                      color: serviceOrange,
                      label: 'Durak',
                      icon: Icons.place_outlined,
                    ),
                  ),
                  Positioned(
                    right: 14,
                    top: 12,
                    child: _MapLegendDot(
                      color: item.hasVehicleLocation
                          ? serviceGreen
                          : const Color(0xFF64748B),
                      label: item.hasVehicleLocation ? 'Servis' : 'Bekleniyor',
                      icon: Icons.directions_bus_filled_outlined,
                    ),
                  ),
                  const Positioned(
                    right: 10,
                    bottom: 10,
                    child: _MapAttribution(),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _LiveMapMetric(
                  label: 'Mesafe',
                  value: item.hasVehicleLocation ? distance : 'Bekleniyor',
                  icon: Icons.straighten_rounded,
                  color: serviceOrange,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _LiveMapMetric(
                  label: 'Son konum',
                  value: _formatLocationTime(item.lastLocationAt),
                  icon: Icons.update_rounded,
                  color: serviceGreen,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _requestCard(ServiceAbsenceRequestRecord item) {
    return ServiceGlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      glowColors: const [serviceAmber, serviceBlue],
      child: Row(
        children: [
          const ServiceIconBadge(
            icon: Icons.event_busy_outlined,
            color: serviceAmber,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.studentFullName,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  '${item.date} • ${_routeTypeLabel(item.tripType)} • ${item.routeName}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(
                      context,
                    ).textTheme.bodySmall?.color?.withValues(alpha: 0.65),
                  ),
                ),
                if (item.reason.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    item.reason,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ],
            ),
          ),
          item.status == 'Cancelled'
              ? const ServiceStatusPill(
                  label: 'İptal',
                  color: Color(0xFF64748B),
                  icon: Icons.cancel_outlined,
                )
              : IconButton(
                  tooltip: 'Talebi iptal et',
                  onPressed: () => _cancelRequest(item.id),
                  icon: const Icon(Icons.cancel_outlined),
                ),
        ],
      ),
    );
  }

  Widget _historyCard(ServiceHistoryRecord item) {
    return ServiceGlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      glowColors: const [servicePurple, serviceBlue],
      child: Row(
        children: [
          const ServiceIconBadge(
            icon: Icons.history_rounded,
            color: servicePurple,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${_routeTypeLabel(item.tripType)} • ${item.routeName}',
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  '${item.tripDate} • ${_attendanceLabel(item.attendanceStatus)}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(
                      context,
                    ).textTheme.bodySmall?.color?.withValues(alpha: 0.65),
                  ),
                ),
              ],
            ),
          ),
          ServiceStatusPill(
            label: _attendanceLabel(item.attendanceStatus),
            color: _attendanceColor(item.attendanceStatus),
          ),
        ],
      ),
    );
  }

  Future<void> _showAbsenceRequestDialog() async {
    var selected = _statuses.first;
    var tripType = 'Both';
    final reason = TextEditingController();
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    final date =
        '${tomorrow.year.toString().padLeft(4, '0')}-${tomorrow.month.toString().padLeft(2, '0')}-${tomorrow.day.toString().padLeft(2, '0')}';
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Servis Kullanmayacak Talebi'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<ServiceLiveStatusRecord>(
                  initialValue: selected,
                  isExpanded: true,
                  items: _statuses
                      .map(
                        (item) => DropdownMenuItem(
                          value: item,
                          child: Text(
                            '${item.studentFullName} • ${item.routeName}',
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => selected = value ?? selected),
                  decoration: const InputDecoration(
                    labelText: 'Öğrenci / Rota',
                  ),
                ),
                DropdownButtonFormField<String>(
                  initialValue: tripType,
                  items: const [
                    DropdownMenuItem(
                      value: 'Morning',
                      child: Text('Yarın sabah'),
                    ),
                    DropdownMenuItem(
                      value: 'Evening',
                      child: Text('Yarın akşam'),
                    ),
                    DropdownMenuItem(
                      value: 'Both',
                      child: Text('Yarın sabah ve akşam'),
                    ),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => tripType = value ?? 'Both'),
                  decoration: const InputDecoration(labelText: 'Servis tipi'),
                ),
                TextField(
                  controller: reason,
                  decoration: const InputDecoration(labelText: 'Açıklama'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Vazgeç'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Gönder'),
            ),
          ],
        ),
      ),
    );
    if (saved != true) return;
    try {
      await _api.createParentAbsenceRequest(
        studentId: selected.studentId,
        routeId: selected.routeId,
        date: date,
        tripType: tripType,
        reason: reason.text,
      );
      _showMessage('Servis kullanmayacak talebi oluşturuldu.');
      _load();
    } catch (e) {
      _showMessage(e.toString());
    }
  }

  Future<void> _cancelRequest(String id) async {
    try {
      await _api.cancelParentAbsenceRequest(id);
      _showMessage('Talep iptal edildi.');
      _load();
    } catch (e) {
      _showMessage(e.toString());
    }
  }

  Future<void> _syncRealtimeSubscriptions() async {
    await _realtime.ensureConnected(
      onVehicleLocation: _handleVehicleLocation,
      onServiceDataChanged: () => _load(silent: true),
    );
    await _realtime.joinTrips(_statuses.map((item) => item.tripId));
    await _realtime.joinVehicles(_statuses.map((item) => item.vehicleId));
  }

  void _handleVehicleLocation(ServiceVehicleLocationEvent event) {
    if (!mounted) return;
    var changed = false;
    final updated = _statuses.map((item) {
      final matchesTrip = item.tripId.isNotEmpty && item.tripId == event.tripId;
      final matchesVehicle =
          item.vehicleId.isNotEmpty && item.vehicleId == event.vehicleId;
      if (!matchesTrip && !matchesVehicle) return item;

      changed = true;
      final meters = _calculateDistanceMeters(
        event.latitude,
        event.longitude,
        item.stopLatitude,
        item.stopLongitude,
      );
      return item.copyWith(
        etaMinutes: _calculateEtaMinutes(meters, event.speed),
        vehicleLatitude: event.latitude,
        vehicleLongitude: event.longitude,
        distanceMeters: meters,
        lastLocationAt: event.recordedAt.isEmpty
            ? DateTime.now().toUtc().toIso8601String()
            : event.recordedAt,
      );
    }).toList();

    if (changed) {
      setState(() => _statuses = updated);
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _LiveMapMetric extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _LiveMapMetric({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.16)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(
                      context,
                    ).textTheme.bodySmall?.color?.withValues(alpha: 0.62),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MapLegendDot extends StatelessWidget {
  final Color color;
  final String label;
  final IconData icon;

  const _MapLegendDot({
    required this.color,
    required this.label,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0xFF020617).withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 14),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _OpenStreetServiceMap extends StatelessWidget {
  final ServiceLiveStatusRecord item;

  const _OpenStreetServiceMap({required this.item});

  @override
  Widget build(BuildContext context) {
    final stopPoint = LatLng(item.stopLatitude, item.stopLongitude);
    final vehiclePoint = item.hasVehicleLocation
        ? LatLng(item.vehicleLatitude!, item.vehicleLongitude!)
        : null;
    final points = [stopPoint, ?vehiclePoint];
    final center = vehiclePoint == null
        ? stopPoint
        : LatLng(
            (stopPoint.latitude + vehiclePoint.latitude) / 2,
            (stopPoint.longitude + vehiclePoint.longitude) / 2,
          );

    return FlutterMap(
      options: MapOptions(
        initialCenter: center,
        initialZoom: vehiclePoint == null ? 15 : 14,
        initialCameraFit: vehiclePoint == null
            ? null
            : CameraFit.bounds(
                bounds: LatLngBounds.fromPoints(points),
                padding: const EdgeInsets.fromLTRB(42, 54, 42, 58),
              ),
        minZoom: 4,
        maxZoom: 18,
        backgroundColor: const Color(0xFF07111F),
        interactionOptions: const InteractionOptions(
          flags:
              InteractiveFlag.drag |
              InteractiveFlag.pinchZoom |
              InteractiveFlag.doubleTapZoom |
              InteractiveFlag.flingAnimation,
        ),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.courseintellect.student',
        ),
        if (vehiclePoint != null)
          PolylineLayer(
            polylines: [
              Polyline(
                points: [vehiclePoint, stopPoint],
                color: serviceOrange,
                strokeWidth: 4,
                borderColor: const Color(0xFF07111F).withValues(alpha: 0.76),
                borderStrokeWidth: 7,
              ),
            ],
          ),
        MarkerLayer(
          markers: [
            Marker(
              point: stopPoint,
              width: 58,
              height: 68,
              alignment: Alignment.topCenter,
              child: const _ServiceMapMarker(
                color: serviceOrange,
                icon: Icons.place_rounded,
                label: 'Durak',
              ),
            ),
            if (vehiclePoint != null)
              Marker(
                point: vehiclePoint,
                width: 58,
                height: 68,
                alignment: Alignment.topCenter,
                child: const _ServiceMapMarker(
                  color: serviceGreen,
                  icon: Icons.directions_bus_rounded,
                  label: 'Servis',
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _ServiceMapMarker extends StatelessWidget {
  final Color color;
  final IconData icon;
  final String label;

  const _ServiceMapMarker({
    required this.color,
    required this.icon,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white, width: 2),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.36),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Icon(icon, color: Colors.white, size: 23),
        ),
        Container(
          margin: const EdgeInsets.only(top: 4),
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
          decoration: BoxDecoration(
            color: const Color(0xFF020617).withValues(alpha: 0.82),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      ],
    );
  }
}

class _MapAttribution extends StatelessWidget {
  const _MapAttribution();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF020617).withValues(alpha: 0.66),
        borderRadius: BorderRadius.circular(999),
      ),
      child: const Text(
        '© OpenStreetMap',
        style: TextStyle(
          color: Colors.white,
          fontSize: 9,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

String _routeTypeLabel(String value) {
  return value == 'Morning'
      ? 'Sabah'
      : value == 'Evening'
      ? 'Akşam'
      : value == 'Both'
      ? 'Sabah + Akşam'
      : value;
}

String _attendanceLabel(String value) {
  switch (value) {
    case 'Boarded':
      return 'Servise bindi';
    case 'NotBoarded':
      return 'Servise binmedi';
    case 'ArrivedSchool':
      return 'Okula ulaştı';
    case 'BoardedFromSchool':
      return 'Okul çıkışında servise bindi';
    case 'ArrivedHome':
      return 'Eve ulaştı';
    default:
      return value.isEmpty ? 'Bekliyor' : value;
  }
}

String _formatDistance(double? meters) {
  if (meters == null) return 'Bekleniyor';
  if (meters < 1000) return '${meters.round()} m';
  return '${(meters / 1000).toStringAsFixed(1)} km';
}

double _calculateDistanceMeters(
  double fromLatitude,
  double fromLongitude,
  double toLatitude,
  double toLongitude,
) {
  const earthRadiusMeters = 6371000.0;
  final dLat = _toRadians(toLatitude - fromLatitude);
  final dLon = _toRadians(toLongitude - fromLongitude);
  final lat1 = _toRadians(fromLatitude);
  final lat2 = _toRadians(toLatitude);
  final a =
      math.pow(math.sin(dLat / 2), 2) +
      math.cos(lat1) * math.cos(lat2) * math.pow(math.sin(dLon / 2), 2);
  return earthRadiusMeters * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
}

int _calculateEtaMinutes(double distanceMeters, double? speedKmh) {
  final effectiveSpeed = speedKmh != null && speedKmh > 1 ? speedKmh : 30.0;
  return math.max(1, (distanceMeters / 1000 / effectiveSpeed * 60).ceil());
}

double _toRadians(double degrees) => degrees * math.pi / 180;

String _formatLocationTime(String value) {
  if (value.isEmpty) return 'Bekleniyor';
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return value;
  final local = parsed.toLocal();
  return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
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
