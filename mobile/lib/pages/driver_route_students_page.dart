import 'package:flutter/material.dart';

import '../services/service_tracking_api_service.dart';
import '../widgets/admin_ui.dart';

class DriverRouteStudentsPage extends StatefulWidget {
  const DriverRouteStudentsPage({super.key});

  @override
  State<DriverRouteStudentsPage> createState() =>
      _DriverRouteStudentsPageState();
}

class _DriverRouteStudentsPageState extends State<DriverRouteStudentsPage> {
  final _api = ServiceTrackingApiService.instance;
  bool _loading = true;
  String? _error;
  List<DriverTodayRouteRecord> _routes = const [];
  List<DriverRouteStudentRecord> _students = const [];
  DriverTodayRouteRecord? _selectedRoute;
  String? _tripId;

  @override
  void initState() {
    super.initState();
    _loadRoutes();
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
    final students = await _api.fetchDriverRouteStudents(routeId);
    if (!mounted) return;
    setState(() {
      _students = students;
      _loading = false;
    });
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
                AdminHeroCard(
                  eyebrow: 'Şoför ekranı',
                  title: 'Bugünkü rotanı başlat ve öğrencileri işaretle.',
                  description:
                      'Her öğrenci için Bindi / Binmedi seçimi veliye bildirim olarak gider.',
                  colors: const [Color(0xFF0F172A), Color(0xFF2563EB)],
                  metrics: [
                    AdminHeroMetric(label: 'Rota', value: '${_routes.length}'),
                    AdminHeroMetric(
                      label: 'Öğrenci',
                      value: '${_students.length}',
                    ),
                  ],
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  AdminPanel(
                    child: Text(
                      _error!,
                      style: const TextStyle(color: Color(0xFFB42318)),
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                if (_routes.isEmpty)
                  const AdminPanel(
                    child: Text('Bugün için atanmış servis rotası bulunamadı.'),
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
                      await _loadStudents(route.routeId);
                    },
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      FilledButton.icon(
                        onPressed: _selectedRoute == null ? null : _startTrip,
                        icon: const Icon(Icons.play_arrow_rounded),
                        label: const Text('Servisi Başlat'),
                      ),
                      OutlinedButton.icon(
                        onPressed: _tripId == null
                            ? null
                            : () => _api.arrivedSchool(_tripId!),
                        icon: const Icon(Icons.school_outlined),
                        label: const Text('Okula Ulaştı'),
                      ),
                      OutlinedButton.icon(
                        onPressed: _tripId == null
                            ? null
                            : () => _api.completeTrip(_tripId!),
                        icon: const Icon(Icons.home_outlined),
                        label: const Text('Servis Tamamlandı'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const AdminSectionTitle(title: 'Öğrenciler'),
                  const SizedBox(height: 10),
                  ..._students.map(_studentCard),
                ],
              ],
            ),
    );
  }

  Widget _studentCard(DriverRouteStudentRecord student) {
    return AdminPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const CircleAvatar(child: Icon(Icons.school_outlined)),
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
                    Text('${student.className} • ${student.stopName}'),
                    Text('${student.parentFullName} • ${student.parentPhone}'),
                  ],
                ),
              ),
              if (student.hasAbsenceRequest)
                const AdminAccentBadge(
                  label: 'Bugün binmeyecek',
                  color: Color(0xFFB45309),
                )
              else
                AdminAccentBadge(
                  label: student.attendanceStatus,
                  color: const Color(0xFF2563EB),
                ),
            ],
          ),
          if (student.etaMinutes != null) ...[
            const SizedBox(height: 8),
            Text('Tahmini varış: ${student.etaMinutes} dk'),
          ],
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: _tripId == null
                      ? null
                      : () => _mark(student.studentId, 'Boarded'),
                  child: const Text('Bindi'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(
                  onPressed: _tripId == null
                      ? null
                      : () => _mark(student.studentId, 'NotBoarded'),
                  child: const Text('Binmedi'),
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
    final trip = await _api.startTrip(route.routeId);
    setState(() => _tripId = trip['id']?.toString());
    await _loadStudents(route.routeId);
  }

  Future<void> _mark(String studentId, String status) async {
    final tripId = _tripId;
    final routeId = _selectedRoute?.routeId;
    if (tripId == null || routeId == null) return;
    await _api.markAttendance(
      tripId: tripId,
      studentId: studentId,
      status: status,
    );
    await _loadStudents(routeId);
  }
}

String _routeTypeLabel(String value) {
  return value == 'Morning'
      ? 'Sabah'
      : value == 'Evening'
      ? 'Akşam'
      : value;
}
