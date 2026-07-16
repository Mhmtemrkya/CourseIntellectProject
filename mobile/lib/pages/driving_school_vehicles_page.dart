import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../i18n/app_locale.dart';
import '../services/api_config.dart';
import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';

const _recordType = {'Maintenance': 'Bakım', 'Fault': 'Arıza', 'Damage': 'Hasar'};
const _priority = {'Low': 'Düşük', 'Normal': 'Normal', 'High': 'Yüksek', 'Critical': 'Kritik'};
const _assignmentType = {
  'Primary': 'Birincil',
  'Secondary': 'İkincil',
  'Temporary': 'Geçici',
  'Shared': 'Ortak',
};
const _documentStatus = {
  'Valid': 'Geçerli',
  'ExpiringSoon': 'Süresi yaklaşıyor',
  'Expired': 'Süresi doldu',
};

String _transmission(dynamic v) => (v == 1 || v == 'Manual') ? 'Manuel' : 'Otomatik';

String _dateOnly(dynamic value) {
  final raw = '${value ?? ''}';
  if (raw.isEmpty) return '—';
  final d = DateTime.tryParse(raw);
  if (d == null) return '—';
  final l = d.toLocal();
  return '${l.day.toString().padLeft(2, '0')}.${l.month.toString().padLeft(2, '0')}.${l.year}';
}

String _money(dynamic value) {
  final n = value is num ? value : num.tryParse('${value ?? 0}') ?? 0;
  return '₺${n.toStringAsFixed(n == n.roundToDouble() ? 0 : 2)}';
}

DrivingTone _docTone(dynamic status) {
  switch ('$status') {
    case 'Valid':
      return DrivingTone.success;
    case 'ExpiringSoon':
      return DrivingTone.warning;
    case 'Expired':
      return DrivingTone.danger;
    default:
      return DrivingTone.neutral;
  }
}

class DrivingSchoolVehiclesPage extends StatefulWidget {
  const DrivingSchoolVehiclesPage({super.key});

  @override
  State<DrivingSchoolVehiclesPage> createState() => _DrivingSchoolVehiclesPageState();
}

class _DrivingSchoolVehiclesPageState extends State<DrivingSchoolVehiclesPage> {
  final _service = DrivingSchoolApiService.instance;
  bool _loading = true;
  Object? _error;
  List<Map<String, dynamic>> _vehicles = [];
  String _search = '';

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
      final rows = await _service.vehicles();
      if (!mounted) return;
      setState(() => _vehicles = rows);
    } catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filtered {
    final term = _search.trim().toLowerCase();
    if (term.isEmpty) return _vehicles;
    return _vehicles.where((v) {
      final hay = '${v['plateNumber'] ?? ''} ${v['brand'] ?? ''} ${v['model'] ?? ''}'.toLowerCase();
      return hay.contains(term);
    }).toList();
  }

  void _openVehicle(Map<String, dynamic> vehicle) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _VehicleDetailSheet(vehicle: vehicle),
    );
  }

  @override
  Widget build(BuildContext context) {
    final inMaintenance = _vehicles.where((v) => v['isInMaintenance'] == true).length;
    final active = _vehicles.where((v) => v['isActive'] == true && v['isInMaintenance'] != true).length;

    return DrivingScaffold(
      appBar: AppBar(title: Text('Araçlarım'.tr)),
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? DrivingErrorState(error: _error!, onRetry: _load)
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  DrivingHero(
                    eyebrow: 'FİLO'.tr,
                    title: 'Araçlarım'.tr,
                    description:
                        'Bir araca dokunarak bakım, evrak ve atama bilgilerini inceleyin.'.tr,
                    icon: Icons.directions_car_filled_rounded,
                    metrics: [
                      DrivingHeroMetric(label: 'Toplam'.tr, value: '${_vehicles.length}'),
                      const SizedBox(width: 10),
                      DrivingHeroMetric(label: 'Kullanımda'.tr, value: '$active'),
                      const SizedBox(width: 10),
                      DrivingHeroMetric(label: 'Bakımda'.tr, value: '$inMaintenance'),
                    ],
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    onChanged: (v) => setState(() => _search = v),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search_rounded),
                      hintText: 'Plaka veya marka ara...'.tr,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  if (_filtered.isEmpty)
                    DrivingEmptyState(
                      icon: Icons.directions_car_rounded,
                      title: _search.isEmpty ? 'Filoda araç yok.'.tr : 'Eşleşen araç yok.'.tr,
                    )
                  else
                    ..._filtered.map((v) {
                      final maintenance = v['isInMaintenance'] == true;
                      return DrivingListRow(
                        icon: Icons.directions_car_rounded,
                        iconColor: maintenance ? const Color(0xFFEF4444) : null,
                        title: '${v['plateNumber'] ?? '—'}',
                        subtitle:
                            '${v['brand'] ?? ''} ${v['model'] ?? ''} • ${v['licenseClass'] ?? ''} • ${_transmission(v['transmissionType'])}',
                        trailing: DrivingStatusPill(
                          label: maintenance ? 'Bakımda' : 'Uygun',
                          tone: maintenance ? DrivingTone.danger : DrivingTone.success,
                          icon: maintenance ? Icons.build_rounded : Icons.check_circle_rounded,
                        ),
                        onTap: () => _openVehicle(v),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}

class _VehicleDetailSheet extends StatefulWidget {
  final Map<String, dynamic> vehicle;

  const _VehicleDetailSheet({required this.vehicle});

  @override
  State<_VehicleDetailSheet> createState() => _VehicleDetailSheetState();
}

class _VehicleDetailSheetState extends State<_VehicleDetailSheet> {
  late Future<List<List<Map<String, dynamic>>>> _future;

  @override
  void initState() {
    super.initState();
    final service = DrivingSchoolApiService.instance;
    final vehicleId = '${widget.vehicle['id']}';
    final plate = '${widget.vehicle['plateNumber']}';
    _future = Future.wait([
      service.vehicleServiceRecords().then((r) => r.where((x) => '${x['vehicleId']}' == vehicleId).toList()).catchError((_) => <Map<String, dynamic>>[]),
      service.instructorVehicleAssignments().then((r) => r.where((x) => '${x['vehicleId']}' == vehicleId).toList()).catchError((_) => <Map<String, dynamic>>[]),
      service.vehicleDocuments().then((r) => r.where((x) => '${x['plateNumber']}' == plate).toList()).catchError((_) => <Map<String, dynamic>>[]),
    ]);
  }

  Future<void> _openFile(String? url) async {
    if (url == null || url.isEmpty) return;
    final uri = Uri.tryParse(ApiConfig.resolveAssetUrl(url));
    if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final v = widget.vehicle;
    final maintenance = v['isInMaintenance'] == true;

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      builder: (context, controller) => FutureBuilder<List<List<Map<String, dynamic>>>>(
        future: _future,
        builder: (context, snapshot) {
          final records = snapshot.data?[0] ?? const [];
          final assignments = snapshot.data?[1] ?? const [];
          final documents = snapshot.data?[2] ?? const [];
          final loading = snapshot.connectionState != ConnectionState.done;

          return ListView(
            controller: controller,
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            children: [
              Row(
                children: [
                  Text(
                    '${v['plateNumber']}',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(width: 10),
                  DrivingStatusPill(
                    label: maintenance ? 'Bakımda' : 'Kullanımda',
                    tone: maintenance ? DrivingTone.danger : DrivingTone.success,
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '${v['brand'] ?? ''} ${v['model'] ?? ''} • ${v['modelYear'] ?? ''} • ${v['licenseClass'] ?? ''} • ${_transmission(v['transmissionType'])}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 4),
              Text(
                'Km: ${v['currentKilometer'] ?? 0} • Muayene: ${_dateOnly(v['inspectionExpiresAtUtc'])} • Sigorta: ${_dateOnly(v['insuranceExpiresAtUtc'])}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 16),

              const DrivingSectionTitle(title: 'Atanan öğretmenler'),
              const SizedBox(height: 8),
              if (loading)
                const _SheetLoading()
              else if (assignments.isEmpty)
                DrivingEmptyState(icon: Icons.person_off_rounded, title: 'Atanmış öğretmen yok.'.tr)
              else
                ...assignments.map((a) => DrivingListRow(
                      icon: Icons.person_pin_rounded,
                      iconColor: const Color(0xFF3B82F6),
                      title: '${a['instructorName'] ?? '—'}',
                      subtitle: _assignmentType['${a['assignmentType']}'] ?? '${a['assignmentType'] ?? 'Atama'}',
                      trailing: DrivingStatusPill(
                        label: a['isActive'] == true ? 'Aktif' : 'Pasif',
                        tone: a['isActive'] == true ? DrivingTone.success : DrivingTone.neutral,
                      ),
                    )),

              const SizedBox(height: 16),
              const DrivingSectionTitle(title: 'Bakım ve arıza kayıtları'),
              const SizedBox(height: 8),
              if (loading)
                const _SheetLoading()
              else if (records.isEmpty)
                DrivingEmptyState(icon: Icons.build_circle_rounded, title: 'Kayıt yok.'.tr)
              else
                ...records.map((r) {
                  final open = r['status'] == 'Open';
                  return DrivingListRow(
                    icon: Icons.build_rounded,
                    iconColor: const Color(0xFFF59E0B),
                    title: '${r['title'] ?? '—'}',
                    subtitle:
                        '${_recordType['${r['recordType']}'] ?? r['recordType']} • ${_priority['${r['priority']}'] ?? r['priority']} • ${_money(r['totalCost'])}${r['resolution'] != null ? '\nÇözüm: ${r['resolution']}' : ''}',
                    trailing: DrivingStatusPill(
                      label: open ? 'Açık' : 'Kapandı',
                      tone: open ? DrivingTone.warning : DrivingTone.success,
                    ),
                  );
                }),

              const SizedBox(height: 16),
              const DrivingSectionTitle(title: 'Araç evrakları'),
              const SizedBox(height: 8),
              if (loading)
                const _SheetLoading()
              else if (documents.isEmpty)
                DrivingEmptyState(icon: Icons.folder_off_rounded, title: 'Evrak yok.'.tr)
              else
                ...documents.map((d) => DrivingListRow(
                      icon: Icons.description_rounded,
                      iconColor: const Color(0xFF3B82F6),
                      title: '${d['documentType'] ?? '—'}',
                      subtitle: '${d['documentNumber'] ?? ''} • Bitiş: ${_dateOnly(d['expiresAtUtc'])}',
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if ((d['fileUrl'] as String?)?.isNotEmpty == true)
                            IconButton(
                              icon: const Icon(Icons.open_in_new_rounded, size: 18),
                              onPressed: () => _openFile(d['fileUrl'] as String?),
                            ),
                          DrivingStatusPill(
                            label: _documentStatus['${d['status']}'] ?? '${d['status']}',
                            tone: _docTone(d['status']),
                          ),
                        ],
                      ),
                    )),
            ],
          );
        },
      ),
    );
  }
}

class _SheetLoading extends StatelessWidget {
  const _SheetLoading();

  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.symmetric(vertical: 16),
        child: Center(child: CircularProgressIndicator()),
      );
}
