import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/service_tracking_api_service.dart';
import '../widgets/admin_ui.dart';
import '../widgets/service_tracking_ui.dart';
import 'admin_staff_registration_page.dart';
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
                ServiceHeroPanel(
                  eyebrow: 'Servis Operasyon Merkezi',
                  title: 'Araç, şoför ve rotaları tek ekrandan yönetin.'.tr,
                  description:
                      'Yeni şoför kayıtları personel kaydında kişisel bilgi, araç ve rota bilgisiyle tek akışta yapılır. Burada durak ve öğrenci atamaları tamamlanır.',
                  icon: Icons.route_rounded,
                  colors: const [Color(0xFF07111F), Color(0xFF0F766E)],
                  stats: [
                    ServiceHeroStat(
                      label: 'Rota',
                      value: '${_routes.length}',
                      icon: Icons.alt_route_rounded,
                    ),
                    ServiceHeroStat(
                      label: 'Araç'.tr,
                      value: '${_vehicles.length}',
                      icon: Icons.directions_bus_rounded,
                    ),
                    ServiceHeroStat(
                      label: 'Şoför'.tr,
                      value: '${_drivers.length}',
                      icon: Icons.badge_rounded,
                    ),
                  ],
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  _errorBox(_error!),
                ],
                const SizedBox(height: 16),
                _quickActionGrid(),
                const SizedBox(height: 18),
                ServiceSectionHeader(
                  title: 'Servis Araçları'.tr,
                  subtitle: 'Plaka, kapasite ve aktiflik durumunu yönetin.'.tr,
                ),
                const SizedBox(height: 10),
                if (_vehicles.isEmpty)
                  ServiceEmptyPanel(
                    title: 'Henüz servis aracı eklenmedi'.tr,
                    description:
                        'İlk aracı ekleyerek rota planlamasına başlayabilirsiniz.',
                    icon: Icons.directions_bus_filled_outlined,
                  )
                else
                  ..._vehicles.map((vehicle) => _vehicleCard(vehicle)),
                const SizedBox(height: 18),
                ServiceSectionHeader(
                  title: 'Servis Şoförleri'.tr,
                  subtitle: 'Mevcut kullanıcıları servis şoförü olarak atayın.'.tr,
                ),
                const SizedBox(height: 10),
                if (_drivers.isEmpty)
                  ServiceEmptyPanel(
                    title: 'Henüz servis şoförü yok'.tr,
                    description:
                        'Personel/kullanıcı kaydını seçerek şoför profili oluşturabilirsiniz.',
                    icon: Icons.badge_outlined,
                  )
                else
                  ..._drivers.map((driver) => _driverCard(driver)),
                const SizedBox(height: 18),
                ServiceSectionHeader(
                  title: 'Rotalar',
                  subtitle: 'Sabah ve akşam rotalarını kapasiteyle izleyin.'.tr,
                ),
                const SizedBox(height: 10),
                if (_routes.isEmpty)
                  ServiceEmptyPanel(
                    title: 'Henüz servis rotası yok'.tr,
                    description:
                        'Araç ve şoför seçerek sabah veya akşam rotası oluşturun.',
                    icon: Icons.alt_route_rounded,
                  )
                else
                  ..._routes.map((route) => _routeCard(route)),
              ],
            ),
    );
  }

  Widget _quickActionGrid() {
    final actions = [
      ServiceQuickAction(
        title: 'Şoför + Araç'.tr,
        subtitle: 'Tek kayıt formu'.tr,
        icon: Icons.directions_bus_filled_outlined,
        color: serviceBlue,
        onTap: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => const AdminStaffRegistrationPage(),
            ),
          );
          _load();
        },
      ),
      ServiceQuickAction(
        title: 'Şoför Kaydı'.tr,
        subtitle: 'Personelden tek form',
        icon: Icons.badge_outlined,
        color: serviceGreen,
        onTap: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => const AdminStaffRegistrationPage(),
            ),
          );
          _load();
        },
      ),
      ServiceQuickAction(
        title: 'Rota Oluştur'.tr,
        subtitle: 'Sabah / akşam'.tr,
        icon: Icons.alt_route_rounded,
        color: serviceOrange,
        onTap: _showCreateRouteDialog,
      ),
      ServiceQuickAction(
        title: 'Şoför Ekranı'.tr,
        subtitle: 'Yoklama ve GPS'.tr,
        icon: Icons.fact_check_outlined,
        color: servicePurple,
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const DriverRouteStudentsPage()),
        ),
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final twoColumns = constraints.maxWidth >= 520;
        final itemWidth = twoColumns
            ? (constraints.maxWidth - 12) / 2
            : constraints.maxWidth;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: actions
              .map((action) => SizedBox(width: itemWidth, child: action))
              .toList(),
        );
      },
    );
  }

  Widget _routeCard(ServiceRouteRecord route) {
    final color = route.routeType == 'Morning' ? serviceBlue : serviceOrange;
    return ServiceGlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      glowColors: [color, serviceCyan],
      onTap: () async {
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ServiceRouteDetailPage(routeId: route.id),
          ),
        );
        _load();
      },
      child: Row(
        children: [
          ServiceIconBadge(
            icon: route.routeType == 'Morning'
                ? Icons.wb_sunny_outlined
                : Icons.nights_stay_outlined,
            color: color,
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        route.name,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                    ),
                    ServiceStatusPill(
                      label: route.isActive ? 'Aktif' : 'Pasif',
                      color: route.isActive
                          ? serviceGreen
                          : const Color(0xFF64748B),
                      icon: route.isActive
                          ? Icons.check_circle_outline
                          : Icons.pause_circle_outline,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ServiceInfoRow(
                  icon: Icons.schedule_rounded,
                  label: _routeTypeLabel(route.routeType),
                  value: '${route.startTime} - ${route.endTime}',
                  color: color,
                ),
                const SizedBox(height: 5),
                ServiceInfoRow(
                  icon: Icons.directions_bus_outlined,
                  label: 'Araç'.tr,
                  value: route.vehiclePlate.isEmpty
                      ? 'Araç seçilmedi'
                      : route.vehiclePlate,
                  color: serviceBlue,
                ),
                const SizedBox(height: 5),
                ServiceInfoRow(
                  icon: Icons.person_pin_circle_outlined,
                  label: 'Şoför'.tr,
                  value: route.driverName.isEmpty
                      ? 'Şoför seçilmedi'
                      : route.driverName,
                  color: serviceGreen,
                ),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    minHeight: 7,
                    value: route.capacity == 0
                        ? 0.0
                        : (route.totalStudents / route.capacity)
                              .clamp(0.0, 1.0)
                              .toDouble(),
                    backgroundColor: color.withValues(alpha: 0.12),
                    valueColor: AlwaysStoppedAnimation<Color>(color),
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  '${route.totalStudents}/${route.capacity} öğrenci kapasitesi',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: Theme.of(
                      context,
                    ).textTheme.bodySmall?.color?.withValues(alpha: 0.62),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Icon(
            Icons.arrow_forward_ios_rounded,
            size: 15,
            color: Theme.of(
              context,
            ).textTheme.bodySmall?.color?.withValues(alpha: 0.42),
          ),
        ],
      ),
    );
  }

  Widget _vehicleCard(ServiceVehicleRecord vehicle) {
    return ServiceGlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      glowColors: const [serviceBlue, serviceCyan],
      child: Row(
        children: [
          const ServiceIconBadge(
            icon: Icons.directions_bus_filled_outlined,
            color: serviceBlue,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  vehicle.plateNumber,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${vehicle.vehicleNumber.isEmpty ? '' : '${vehicle.vehicleNumber} • '}${vehicle.brand} ${vehicle.model} • ${vehicle.capacity} koltuk',
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
            label: vehicle.isActive ? 'Aktif' : 'Pasif',
            color: vehicle.isActive ? serviceGreen : const Color(0xFF64748B),
            icon: vehicle.isActive
                ? Icons.check_circle_outline
                : Icons.pause_circle_outline,
          ),
          IconButton(
            tooltip: vehicle.isActive ? 'Pasifleştir' : 'Aktifleştir',
            onPressed: () => _toggleVehicle(vehicle),
            icon: Icon(vehicle.isActive ? Icons.block_outlined : Icons.check),
          ),
        ],
      ),
    );
  }

  Widget _driverCard(ServiceDriverRecord driver) {
    return ServiceGlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      glowColors: const [serviceGreen, serviceBlue],
      child: Row(
        children: [
          const ServiceIconBadge(
            icon: Icons.badge_outlined,
            color: serviceGreen,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  driver.fullName,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    if (driver.phoneNumber.isNotEmpty) driver.phoneNumber,
                    if (driver.licenseNumber.isNotEmpty)
                      'Ehliyet: ${driver.licenseNumber}',
                  ].join(' • '),
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
            label: driver.isActive ? 'Aktif' : 'Pasif',
            color: driver.isActive ? serviceGreen : const Color(0xFF64748B),
            icon: driver.isActive
                ? Icons.check_circle_outline
                : Icons.pause_circle_outline,
          ),
          IconButton(
            tooltip: 'Pasifleştir'.tr,
            onPressed: driver.isActive ? () => _deactivateDriver(driver) : null,
            icon: const Icon(Icons.block_outlined),
          ),
        ],
      ),
    );
  }

  Future<void> _toggleVehicle(ServiceVehicleRecord vehicle) async {
    try {
      await _api.updateVehicle(
        vehicleId: vehicle.id,
        plateNumber: vehicle.plateNumber,
        vehicleNumber: vehicle.vehicleNumber,
        brand: vehicle.brand,
        model: vehicle.model,
        capacity: vehicle.capacity,
        isActive: !vehicle.isActive,
      );
      _showMessage(
        vehicle.isActive ? 'Araç pasifleştirildi.' : 'Araç aktifleştirildi.',
      );
      _load();
    } catch (e) {
      _showMessage(e.toString());
    }
  }

  Future<void> _deactivateDriver(ServiceDriverRecord driver) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Şoförü Pasifleştir'.tr),
        content: Text(
          '${driver.fullName} servis şoförü olarak pasifleştirilsin mi?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Vazgeç'.tr),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Pasifleştir'.tr),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await _api.deleteDriver(driver.id);
      _showMessage('Şoför kaydı pasifleştirildi.');
      _load();
    } catch (e) {
      _showMessage(e.toString());
    }
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
          title: Text('Rota Oluştur'.tr),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: name,
                  decoration: InputDecoration(labelText: 'Rota adı'.tr),
                ),
                DropdownButtonFormField<String>(
                  initialValue: routeType,
                  items: [
                    DropdownMenuItem(value: 'Morning', child: Text('Sabah')),
                    DropdownMenuItem(value: 'Evening', child: Text('Akşam'.tr)),
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
                  decoration: InputDecoration(labelText: 'Araç'.tr),
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
                  decoration: InputDecoration(labelText: 'Şoför'.tr),
                ),
                TextField(
                  controller: start,
                  decoration: InputDecoration(
                    labelText: 'Başlangıç 07:30'.tr,
                  ),
                ),
                TextField(
                  controller: end,
                  decoration: InputDecoration(labelText: 'Bitiş 09:00'.tr),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text('Vazgeç'.tr),
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
    return ServiceGlassCard(
      glowColors: const [serviceRed, serviceOrange],
      child: Row(
        children: [
          const ServiceIconBadge(
            icon: Icons.warning_amber_rounded,
            color: serviceRed,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: serviceRed,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
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
                ServiceHeroPanel(
                  eyebrow: detail.isActive ? 'Aktif rota' : 'Pasif rota',
                  title: detail.name,
                  description:
                      '${_routeTypeLabel(detail.routeType)} servisi • ${detail.startTime}-${detail.endTime}\n${detail.vehiclePlate} • ${detail.driverName}',
                  icon: detail.routeType == 'Morning'
                      ? Icons.wb_sunny_outlined
                      : Icons.nights_stay_outlined,
                  colors: const [Color(0xFF07111F), Color(0xFF1D4ED8)],
                  stats: [
                    ServiceHeroStat(
                      label: 'Öğrenci'.tr,
                      value: '${detail.totalStudents}',
                      icon: Icons.school_outlined,
                    ),
                    ServiceHeroStat(
                      label: 'Kapasite',
                      value: '${detail.capacity}',
                      icon: Icons.event_seat_outlined,
                    ),
                    ServiceHeroStat(
                      label: 'Boş'.tr,
                      value: '${detail.availableSeats}',
                      icon: Icons.airline_seat_recline_normal_outlined,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ServiceGlassCard(
                  glowColors: const [serviceOrange, serviceGreen],
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ServiceSectionHeader(
                        title: 'Rota Doluluğu'.tr,
                        subtitle: 'Araç kapasitesi ve aktif öğrenci sayısı'.tr,
                      ),
                      const SizedBox(height: 12),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(999),
                        child: LinearProgressIndicator(
                          minHeight: 9,
                          value: detail.capacity == 0
                              ? 0.0
                              : (detail.totalStudents / detail.capacity)
                                    .clamp(0.0, 1.0)
                                    .toDouble(),
                          backgroundColor: serviceOrange.withValues(
                            alpha: 0.14,
                          ),
                          valueColor: const AlwaysStoppedAnimation<Color>(
                            serviceOrange,
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Doluluk: ${detail.totalStudents}/${detail.capacity} • Boş koltuk: ${detail.availableSeats}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
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
                      label: Text('Öğrenci Ata'.tr),
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
                    OutlinedButton.icon(
                      onPressed: _deleteRoute,
                      icon: const Icon(Icons.delete_outline),
                      label: Text('Rotayı Sil/Pasifleştir'.tr),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                ServiceSectionHeader(
                  title: 'Duraklar ve Öğrenciler'.tr,
                  subtitle:
                      'Şoför ekranındaki sıralama bu listeye göre oluşur.'.tr,
                ),
                const SizedBox(height: 10),
                if (detail.stops.isEmpty)
                  ServiceEmptyPanel(
                    title: 'Bu rotada durak yok'.tr,
                    description:
                        'Durak ekleyip öğrencileri uygun durağa atayabilirsiniz.',
                    icon: Icons.add_location_alt_outlined,
                  )
                else
                  ...detail.stops.map((stop) => _stopCard(stop)),
              ],
            ),
    );
  }

  Widget _stopCard(ServiceStopRecord stop) {
    return ServiceGlassCard(
      margin: const EdgeInsets.only(bottom: 12),
      glowColors: const [serviceOrange, serviceBlue],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: serviceOrange.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: serviceOrange.withValues(alpha: 0.26),
                  ),
                ),
                child: Center(
                  child: Text(
                    '${stop.sortOrder}',
                    style: const TextStyle(
                      color: serviceOrange,
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                    ),
                  ),
                ),
              ),
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
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(
                          context,
                        ).textTheme.bodySmall?.color?.withValues(alpha: 0.64),
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Yukarı taşı'.tr,
                onPressed: stop.sortOrder <= 1
                    ? null
                    : () => _moveStop(stop, -1),
                icon: const Icon(Icons.arrow_upward_rounded),
              ),
              IconButton(
                tooltip: 'Aşağı taşı'.tr,
                onPressed: () => _moveStop(stop, 1),
                icon: const Icon(Icons.arrow_downward_rounded),
              ),
              IconButton(
                tooltip: 'Düzenle'.tr,
                onPressed: () => _showEditStopDialog(stop),
                icon: const Icon(Icons.edit_outlined),
              ),
              IconButton(
                tooltip: 'Sil',
                onPressed: () => _deleteStop(stop),
                icon: const Icon(Icons.delete_outline),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (stop.students.isEmpty)
            ServiceStatusPill(
              label: 'Bu durakta öğrenci yok'.tr,
              color: Color(0xFF64748B),
              icon: Icons.info_outline_rounded,
            )
          else
            ...stop.students.map(
              (student) => Container(
                margin: const EdgeInsets.only(top: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(
                    context,
                  ).scaffoldBackgroundColor.withValues(alpha: 0.58),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: Theme.of(
                      context,
                    ).dividerColor.withValues(alpha: 0.18),
                  ),
                ),
                child: Row(
                  children: [
                    const ServiceIconBadge(
                      icon: Icons.school_outlined,
                      color: serviceBlue,
                      size: 38,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            student.studentFullName,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${student.className} • ${student.parentFullName} • ${student.parentPhone}',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: Theme.of(context)
                                      .textTheme
                                      .bodySmall
                                      ?.color
                                      ?.withValues(alpha: 0.62),
                                ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'Atamayı kaldır'.tr,
                      onPressed: () => _deleteAssignment(student),
                      icon: const Icon(Icons.person_remove_outlined),
                    ),
                  ],
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
                decoration: InputDecoration(labelText: 'Durak adı'.tr),
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
                decoration: InputDecoration(labelText: 'Sıra'.tr),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Vazgeç'.tr),
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

  Future<void> _showEditStopDialog(ServiceStopRecord stop) async {
    final name = TextEditingController(text: stop.name);
    final address = TextEditingController(text: stop.address);
    final lat = TextEditingController(text: '${stop.latitude}');
    final lng = TextEditingController(text: '${stop.longitude}');
    final order = TextEditingController(text: '${stop.sortOrder}');
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Durak Düzenle'.tr),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                decoration: InputDecoration(labelText: 'Durak adı'.tr),
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
                decoration: InputDecoration(labelText: 'Sıra'.tr),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Vazgeç'.tr),
          ),
          FilledButton(
            onPressed: () async {
              await _api.updateStop(
                stopId: stop.id,
                name: name.text,
                address: address.text,
                latitude: double.tryParse(lat.text.replaceAll(',', '.')) ?? 0,
                longitude: double.tryParse(lng.text.replaceAll(',', '.')) ?? 0,
                sortOrder: int.tryParse(order.text) ?? stop.sortOrder,
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

  Future<void> _moveStop(ServiceStopRecord stop, int direction) async {
    final detail = _detail;
    if (detail == null) return;
    final sorted = [...detail.stops]
      ..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    final index = sorted.indexWhere((item) => item.id == stop.id);
    final target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;
    final currentOrder = sorted[index].sortOrder;
    final targetOrder = sorted[target].sortOrder;
    sorted[index] = ServiceStopRecord(
      id: sorted[index].id,
      routeId: sorted[index].routeId,
      name: sorted[index].name,
      address: sorted[index].address,
      latitude: sorted[index].latitude,
      longitude: sorted[index].longitude,
      sortOrder: targetOrder,
      students: sorted[index].students,
    );
    sorted[target] = ServiceStopRecord(
      id: sorted[target].id,
      routeId: sorted[target].routeId,
      name: sorted[target].name,
      address: sorted[target].address,
      latitude: sorted[target].latitude,
      longitude: sorted[target].longitude,
      sortOrder: currentOrder,
      students: sorted[target].students,
    );
    try {
      await _api.reorderStops(routeId: widget.routeId, stops: sorted);
      _load();
    } catch (e) {
      _showMessage(e.toString());
    }
  }

  Future<void> _deleteStop(ServiceStopRecord stop) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Durak Sil'),
        content: Text(
          '${stop.name} durağı silinsin mi? Bu durakta aktif öğrenci varsa backend engeller.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Vazgeç'.tr),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sil'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await _api.deleteStop(stop.id);
      _showMessage('Durak silindi.');
      _load();
    } catch (e) {
      _showMessage(e.toString());
    }
  }

  Future<void> _deleteAssignment(AssignedServiceStudentRecord student) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Öğrenciyi Servisten Çıkar'.tr),
        content: Text(
          '${student.studentFullName} servis ataması pasifleştirilsin mi?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Vazgeç'.tr),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Çıkar'.tr),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await _api.deleteAssignment(student.assignmentId);
      _showMessage('Öğrenci servis ataması kaldırıldı.');
      _load();
    } catch (e) {
      _showMessage(e.toString());
    }
  }

  Future<void> _deleteRoute() async {
    final detail = _detail;
    if (detail == null) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Rota Sil/Pasifleştir'.tr),
        content: Text('${detail.name} rotası pasifleştirilsin mi?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Vazgeç'.tr),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Pasifleştir'.tr),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await _api.deleteRoute(detail.id);
      _showMessage('Rota pasifleştirildi.');
      if (mounted) Navigator.pop(context);
    } catch (e) {
      _showMessage(e.toString());
    }
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
          title: Text('Öğrenciyi Servise Ata'.tr),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: keyword,
                  decoration: InputDecoration(
                    labelText: 'Öğrenci ara'.tr,
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
                    decoration: InputDecoration(labelText: 'Öğrenci'.tr),
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
              child: Text('Vazgeç'.tr),
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
