import 'package:flutter/material.dart';

import '../services/service_tracking_api_service.dart';
import '../widgets/admin_ui.dart';
import 'driver_route_students_page.dart';

class ServiceRoutesPage extends StatefulWidget {
  const ServiceRoutesPage({super.key});

  @override
  State<ServiceRoutesPage> createState() => _ServiceRoutesPageState();
}

class _ServiceRoutesPageState extends State<ServiceRoutesPage> {
  final _api = ServiceTrackingApiService.instance;
  bool _loading = true;
  String? _error;
  List<ServiceRouteRecord> _routes = const [];
  List<ServiceVehicleRecord> _vehicles = const [];
  List<ServiceDriverRecord> _drivers = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final results = await Future.wait([
        _api.fetchRoutes(),
        _api.fetchVehicles(),
        _api.fetchDrivers(),
      ]);
      if (!mounted) return;
      setState(() {
        _routes = results[0] as List<ServiceRouteRecord>;
        _vehicles = results[1] as List<ServiceVehicleRecord>;
        _drivers = results[2] as List<ServiceDriverRecord>;
        _loading = false;
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
        title: const Text('Servis Takip'),
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded)),
        ],
      ),
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                AdminHeroCard(
                  eyebrow: 'Servis takip modülü',
                  title: 'Araç, şoför, rota ve öğrenci atamalarını yönetin.',
                  description:
                      'Kurum servisleri sabah/akşam rotaları, durak sırası ve yoklama akışıyla burada yönetilir.',
                  colors: const [Color(0xFF0F172A), Color(0xFF0F766E)],
                  metrics: [
                    AdminHeroMetric(label: 'Rota', value: '${_routes.length}'),
                    AdminHeroMetric(
                      label: 'Araç',
                      value: '${_vehicles.length}',
                    ),
                  ],
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  _errorBox(_error!),
                ],
                const SizedBox(height: 16),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    FilledButton.icon(
                      onPressed: _showCreateVehicleDialog,
                      icon: const Icon(Icons.directions_bus_outlined),
                      label: const Text('Araç Ekle'),
                    ),
                    FilledButton.icon(
                      onPressed: _showCreateDriverDialog,
                      icon: const Icon(Icons.badge_outlined),
                      label: const Text('Şoför Ata'),
                    ),
                    FilledButton.icon(
                      onPressed: _showCreateRouteDialog,
                      icon: const Icon(Icons.alt_route_rounded),
                      label: const Text('Rota Oluştur'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const DriverRouteStudentsPage(),
                        ),
                      ),
                      icon: const Icon(Icons.fact_check_outlined),
                      label: const Text('Şoför Ekranı'),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                const AdminSectionTitle(title: 'Rotalar'),
                const SizedBox(height: 10),
                if (_routes.isEmpty)
                  const AdminPanel(
                    child: Text('Henüz servis rotası oluşturulmadı.'),
                  )
                else
                  ..._routes.map((route) => _routeCard(route)),
              ],
            ),
    );
  }

  Widget _routeCard(ServiceRouteRecord route) {
    final color = route.routeType == 'Morning'
        ? const Color(0xFF2563EB)
        : const Color(0xFFB45309);
    return AdminPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => ServiceRouteDetailPage(routeId: route.id),
            ),
          );
          _load();
        },
        child: Padding(
          padding: const EdgeInsets.all(2),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: color.withValues(alpha: 0.12),
                foregroundColor: color,
                child: Icon(
                  route.routeType == 'Morning'
                      ? Icons.wb_sunny_outlined
                      : Icons.nights_stay_outlined,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      route.name,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_routeTypeLabel(route.routeType)} • ${route.startTime}-${route.endTime}',
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${route.vehiclePlate.isEmpty ? 'Araç seçilmedi' : route.vehiclePlate} • ${route.driverName.isEmpty ? 'Şoför seçilmedi' : route.driverName}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  AdminAccentBadge(
                    label: route.isActive ? 'Aktif' : 'Pasif',
                    color: route.isActive
                        ? const Color(0xFF0F766E)
                        : const Color(0xFF64748B),
                  ),
                  const SizedBox(height: 8),
                  Text('${route.totalStudents}/${route.capacity} öğrenci'),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showCreateVehicleDialog() async {
    final plate = TextEditingController();
    final brand = TextEditingController();
    final model = TextEditingController();
    final capacity = TextEditingController(text: '15');
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Servis Aracı Ekle'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: plate,
              decoration: const InputDecoration(labelText: 'Plaka'),
            ),
            TextField(
              controller: brand,
              decoration: const InputDecoration(labelText: 'Marka'),
            ),
            TextField(
              controller: model,
              decoration: const InputDecoration(labelText: 'Model'),
            ),
            TextField(
              controller: capacity,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Kapasite'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () async {
              await _api.createVehicle(
                plateNumber: plate.text,
                brand: brand.text,
                model: model.text,
                capacity: int.tryParse(capacity.text) ?? 0,
              );
              if (context.mounted) Navigator.pop(context, true);
            },
            child: const Text('Kaydet'),
          ),
        ],
      ),
    );
    if (saved == true) _load();
  }

  Future<void> _showCreateDriverDialog() async {
    final users = await _api.fetchUsers();
    if (!mounted) return;
    ServiceUserRecord? selected = users.isNotEmpty ? users.first : null;
    final phone = TextEditingController(text: selected?.phone ?? '');
    final license = TextEditingController();
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Şoför Ata'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<ServiceUserRecord>(
                initialValue: selected,
                isExpanded: true,
                items: users
                    .map(
                      (user) => DropdownMenuItem(
                        value: user,
                        child: Text('${user.fullName} • ${user.role}'),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  setDialogState(() {
                    selected = value;
                    phone.text = value?.phone ?? '';
                  });
                },
                decoration: const InputDecoration(labelText: 'Kullanıcı'),
              ),
              TextField(
                controller: phone,
                decoration: const InputDecoration(labelText: 'Telefon'),
              ),
              TextField(
                controller: license,
                decoration: const InputDecoration(labelText: 'Ehliyet No'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Vazgeç'),
            ),
            FilledButton(
              onPressed: selected == null
                  ? null
                  : () async {
                      await _api.createDriver(
                        userId: selected!.id,
                        phoneNumber: phone.text,
                        licenseNumber: license.text,
                      );
                      if (context.mounted) Navigator.pop(context, true);
                    },
              child: const Text('Kaydet'),
            ),
          ],
        ),
      ),
    );
    if (saved == true) _load();
  }

  Future<void> _showCreateRouteDialog() async {
    if (_vehicles.isEmpty || _drivers.isEmpty) {
      _showMessage('Önce en az bir araç ve şoför eklemelisin.');
      return;
    }
    final name = TextEditingController();
    var routeType = 'Morning';
    var vehicleId = _vehicles.first.id;
    var driverId = _drivers.first.id;
    final start = TextEditingController(text: '07:30');
    final end = TextEditingController(text: '09:00');
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Rota Oluştur'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Rota adı'),
                ),
                DropdownButtonFormField<String>(
                  initialValue: routeType,
                  items: const [
                    DropdownMenuItem(value: 'Morning', child: Text('Sabah')),
                    DropdownMenuItem(value: 'Evening', child: Text('Akşam')),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => routeType = value ?? 'Morning'),
                  decoration: const InputDecoration(labelText: 'Rota tipi'),
                ),
                DropdownButtonFormField<String>(
                  initialValue: vehicleId,
                  items: _vehicles
                      .map(
                        (v) => DropdownMenuItem(
                          value: v.id,
                          child: Text('${v.plateNumber} • ${v.capacity}'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => vehicleId = value ?? vehicleId),
                  decoration: const InputDecoration(labelText: 'Araç'),
                ),
                DropdownButtonFormField<String>(
                  initialValue: driverId,
                  items: _drivers
                      .map(
                        (d) => DropdownMenuItem(
                          value: d.id,
                          child: Text(d.fullName),
                        ),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => driverId = value ?? driverId),
                  decoration: const InputDecoration(labelText: 'Şoför'),
                ),
                TextField(
                  controller: start,
                  decoration: const InputDecoration(
                    labelText: 'Başlangıç 07:30',
                  ),
                ),
                TextField(
                  controller: end,
                  decoration: const InputDecoration(labelText: 'Bitiş 09:00'),
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
              onPressed: () async {
                await _api.createRoute(
                  name: name.text,
                  routeType: routeType,
                  vehicleId: vehicleId,
                  driverId: driverId,
                  startTime: start.text,
                  endTime: end.text,
                  isActive: false,
                );
                if (context.mounted) Navigator.pop(context, true);
              },
              child: const Text('Kaydet'),
            ),
          ],
        ),
      ),
    );
    if (saved == true) _load();
  }

  Widget _errorBox(String message) {
    return AdminPanel(
      child: Text(message, style: const TextStyle(color: Color(0xFFB42318))),
    );
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}

class ServiceRouteDetailPage extends StatefulWidget {
  final String routeId;

  const ServiceRouteDetailPage({super.key, required this.routeId});

  @override
  State<ServiceRouteDetailPage> createState() => _ServiceRouteDetailPageState();
}

class _ServiceRouteDetailPageState extends State<ServiceRouteDetailPage> {
  final _api = ServiceTrackingApiService.instance;
  ServiceRouteDetailRecord? _detail;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final detail = await _api.fetchRouteDetail(widget.routeId);
    if (!mounted) return;
    setState(() {
      _detail = detail;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;
    return AdminScaffold(
      appBar: AppBar(title: Text(detail?.name ?? 'Rota Detayı')),
      child: _loading || detail == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                AdminPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              detail.name,
                              style: Theme.of(context).textTheme.titleLarge
                                  ?.copyWith(fontWeight: FontWeight.w900),
                            ),
                          ),
                          AdminAccentBadge(
                            label: detail.isActive ? 'Aktif' : 'Pasif',
                            color: detail.isActive
                                ? const Color(0xFF0F766E)
                                : const Color(0xFF64748B),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${_routeTypeLabel(detail.routeType)} • ${detail.startTime}-${detail.endTime}',
                      ),
                      Text(
                        'Araç: ${detail.vehiclePlate} • Şoför: ${detail.driverName}',
                      ),
                      const SizedBox(height: 12),
                      LinearProgressIndicator(
                        value: detail.capacity == 0
                            ? 0
                            : detail.totalStudents / detail.capacity,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Doluluk: ${detail.totalStudents}/${detail.capacity} • Boş koltuk: ${detail.availableSeats}',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    FilledButton.icon(
                      onPressed: _showAddStopDialog,
                      icon: const Icon(Icons.add_location_alt_outlined),
                      label: const Text('Durak Ekle'),
                    ),
                    FilledButton.icon(
                      onPressed: detail.stops.isEmpty
                          ? null
                          : _showAssignStudentDialog,
                      icon: const Icon(Icons.person_add_alt_1_outlined),
                      label: const Text('Öğrenci Ata'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () async {
                        await _api.setRouteActive(detail.id, !detail.isActive);
                        _load();
                      },
                      icon: Icon(
                        detail.isActive
                            ? Icons.pause_circle_outline
                            : Icons.play_circle_outline,
                      ),
                      label: Text(
                        detail.isActive ? 'Pasifleştir' : 'Aktifleştir',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const AdminSectionTitle(title: 'Duraklar ve Öğrenciler'),
                const SizedBox(height: 10),
                if (detail.stops.isEmpty)
                  const AdminPanel(
                    child: Text('Bu rotaya henüz durak eklenmedi.'),
                  )
                else
                  ...detail.stops.map((stop) => _stopCard(stop)),
              ],
            ),
    );
  }

  Widget _stopCard(ServiceStopRecord stop) {
    return AdminPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(child: Text('${stop.sortOrder}')),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      stop.name,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      stop.address,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (stop.students.isEmpty)
            const Text('Bu durakta öğrenci yok.')
          else
            ...stop.students.map(
              (student) => ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.school_outlined),
                title: Text(student.studentFullName),
                subtitle: Text(
                  '${student.className} • ${student.parentFullName} • ${student.parentPhone}',
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _showAddStopDialog() async {
    final name = TextEditingController();
    final address = TextEditingController();
    final lat = TextEditingController(text: '41.0000');
    final lng = TextEditingController(text: '29.0000');
    final order = TextEditingController(
      text: '${(_detail?.stops.length ?? 0) + 1}',
    );
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Durak Ekle'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Durak adı'),
              ),
              TextField(
                controller: address,
                decoration: const InputDecoration(labelText: 'Adres'),
              ),
              TextField(
                controller: lat,
                decoration: const InputDecoration(labelText: 'Latitude'),
              ),
              TextField(
                controller: lng,
                decoration: const InputDecoration(labelText: 'Longitude'),
              ),
              TextField(
                controller: order,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Sıra'),
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
            onPressed: () async {
              await _api.createStop(
                routeId: widget.routeId,
                name: name.text,
                address: address.text,
                latitude: double.tryParse(lat.text.replaceAll(',', '.')) ?? 0,
                longitude: double.tryParse(lng.text.replaceAll(',', '.')) ?? 0,
                sortOrder: int.tryParse(order.text) ?? 1,
              );
              if (context.mounted) Navigator.pop(context, true);
            },
            child: const Text('Kaydet'),
          ),
        ],
      ),
    );
    if (saved == true) _load();
  }

  Future<void> _showAssignStudentDialog() async {
    final keyword = TextEditingController();
    List<ServiceStudentSearchRecord> students = const [];
    ServiceStudentSearchRecord? selectedStudent;
    var stopId = _detail!.stops.first.id;
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Öğrenciyi Servise Ata'),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: keyword,
                  decoration: InputDecoration(
                    labelText: 'Öğrenci ara',
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.search),
                      onPressed: () async {
                        final result = await _api.searchStudents(keyword.text);
                        setDialogState(() {
                          students = result;
                          selectedStudent = result.isNotEmpty
                              ? result.first
                              : null;
                        });
                      },
                    ),
                  ),
                ),
                if (students.isNotEmpty)
                  DropdownButtonFormField<ServiceStudentSearchRecord>(
                    initialValue: selectedStudent,
                    isExpanded: true,
                    items: students
                        .map(
                          (s) => DropdownMenuItem(
                            value: s,
                            child: Text(
                              '${s.studentFullName} • ${s.className}',
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (value) =>
                        setDialogState(() => selectedStudent = value),
                    decoration: const InputDecoration(labelText: 'Öğrenci'),
                  ),
                DropdownButtonFormField<String>(
                  initialValue: stopId,
                  isExpanded: true,
                  items: _detail!.stops
                      .map(
                        (s) => DropdownMenuItem(
                          value: s.id,
                          child: Text('${s.sortOrder}. ${s.name}'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setDialogState(() => stopId = value ?? stopId),
                  decoration: const InputDecoration(labelText: 'Durak'),
                ),
                if (selectedStudent != null)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Veli: ${selectedStudent!.parentFullName} • ${selectedStudent!.parentPhone}',
                    ),
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
              onPressed: selectedStudent == null
                  ? null
                  : () async {
                      await _api.assignStudent(
                        studentId: selectedStudent!.studentId,
                        parentId: selectedStudent!.parentId.isEmpty
                            ? null
                            : selectedStudent!.parentId,
                        routeId: widget.routeId,
                        stopId: stopId,
                      );
                      if (context.mounted) Navigator.pop(context, true);
                    },
              child: const Text('Ata'),
            ),
          ],
        ),
      ),
    );
    if (saved == true) _load();
  }
}

String _routeTypeLabel(String value) {
  return value == 'Morning'
      ? 'Sabah'
      : value == 'Evening'
      ? 'Akşam'
      : value;
}
