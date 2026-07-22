import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../i18n/app_locale.dart';
import '../services/api_config.dart';
import '../services/driving_permissions_store.dart';
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

/// Araçla ilgili HER ŞEYİN tek merkezi: filo listesi + araç ekleme + evrak ve
/// bakım kayıtları. Paket tanımları "Paketler" ekranındadır.
class DrivingSchoolVehiclesPage extends StatefulWidget {
  const DrivingSchoolVehiclesPage({super.key});

  @override
  State<DrivingSchoolVehiclesPage> createState() => _DrivingSchoolVehiclesPageState();
}

class _DrivingSchoolVehiclesPageState extends State<DrivingSchoolVehiclesPage>
    with SingleTickerProviderStateMixin {
  final _service = DrivingSchoolApiService.instance;
  late final TabController _tabs;
  bool _loading = true;
  Object? _error;
  DrivingPermissionSnapshot _permissions = DrivingPermissionSnapshot.empty;
  List<Map<String, dynamic>> _vehicles = [];
  List<Map<String, dynamic>> _documents = const [];
  List<Map<String, dynamic>> _serviceRecords = const [];
  String _search = '';

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    // FAB'ın görünürlüğü aktif sekmenin iznine bağlı; sekme değişince yenile.
    _tabs.addListener(() {
      if (mounted) setState(() {});
    });
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  /// Aktif sekmede kayıt oluşturabiliyor mu? (FAB buna göre gizlenir.)
  bool get _canCreateOnActiveTab => _tabs.index == 0
      ? _permissions.can(DrivingPermissions.vehicleCreate)
      : _permissions.canAny([
          DrivingPermissions.vehicleDocumentUpload,
          DrivingPermissions.vehicleServiceManage,
          DrivingPermissions.vehicleServiceReport,
        ]);

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final permissions = await DrivingPermissionsStore.instance.load();
      // Görme izni olmayan listeyi hiç istemeyiz: tek bir 403 sayfanın
      // tamamını hata ekranına düşürürdü (ör. evrak izni olmayan kullanıcı).
      final result = await Future.wait([
        permissions.can(DrivingPermissions.vehicleView)
            ? _service.vehicles()
            : Future.value(const <Map<String, dynamic>>[]),
        permissions.can(DrivingPermissions.vehicleDocumentView)
            ? _service.vehicleDocuments()
            : Future.value(const <Map<String, dynamic>>[]),
        permissions.can(DrivingPermissions.vehicleServiceView)
            ? _service.vehicleServiceRecords()
            : Future.value(const <Map<String, dynamic>>[]),
      ]);
      if (!mounted) return;
      setState(() {
        _permissions = permissions;
        _vehicles = result[0];
        _documents = result[1];
        _serviceRecords = result[2];
      });
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
      appBar: AppBar(
        title: Text('Araçlar'.tr),
        bottom: TabBar(
          controller: _tabs,
          tabs: [
            Tab(icon: const Icon(Icons.directions_car_rounded), text: 'Filo'.tr),
            Tab(
              icon: const Icon(Icons.verified_user_rounded),
              text: 'Evrak & Bakım'.tr,
            ),
          ],
        ),
      ),
      floatingActionButton: _loading || _error != null || !_canCreateOnActiveTab
          ? null
          : FloatingActionButton.extended(
              onPressed: _tabs.index == 0 ? _vehicleSheet : _complianceActions,
              icon: const Icon(Icons.add),
              label: Text(_tabs.index == 0 ? 'Araç Ekle'.tr : 'Yeni Kayıt'.tr),
            ),
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? DrivingErrorState(error: _error!, onRetry: _load)
          : TabBarView(
              controller: _tabs,
              children: [
                _fleetTab(active: active, inMaintenance: inMaintenance),
                _complianceTab(),
              ],
            ),
    );
  }

  Widget _fleetTab({required int active, required int inMaintenance}) =>
      RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          children: [
            DrivingHero(
              eyebrow: 'FİLO'.tr,
              title: 'Araçlar'.tr,
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
      );

  Widget _complianceTab() {
    final open = _serviceRecords.where((x) => x['status'] == 'Open').toList();
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        children: [
          const DrivingSectionTitle(title: 'Evrak durumları'),
          if (_documents.isEmpty)
            DrivingEmptyState(
              icon: Icons.folder_off_rounded,
              title: 'Henüz araç evrakı yüklenmedi.'.tr,
            )
          else
            ..._documents.map(
              (document) => DrivingListRow(
                icon: Icons.description_rounded,
                title: '${document['plateNumber'] ?? '—'} • ${document['documentType'] ?? ''}',
                subtitle:
                    '${document['documentNumber'] ?? ''} • Bitiş: ${_dateOnly(document['expiresAtUtc'])}',
                trailing: DrivingStatusPill(
                  label: _documentStatus['${document['status']}'] ?? '${document['status']}',
                  tone: _docTone(document['status']),
                ),
              ),
            ),
          const SizedBox(height: 18),
          const DrivingSectionTitle(title: 'Açık bakım ve arızalar'),
          if (open.isEmpty)
            DrivingEmptyState(
              icon: Icons.check_circle_rounded,
              title: 'Açık servis kaydı yok.'.tr,
            )
          else
            ...open.map(
              (record) => DrivingListRow(
                icon: Icons.build_rounded,
                iconColor: record['vehicleUsable'] == true
                    ? const Color(0xFFF59E0B)
                    : const Color(0xFFEF4444),
                title: '${record['plateNumber'] ?? '—'} • ${record['title'] ?? ''}',
                subtitle:
                    '${_recordType['${record['recordType']}'] ?? record['recordType']} • ${_priority['${record['priority']}'] ?? record['priority']}',
                trailing: _permissions.can(DrivingPermissions.vehicleServiceManage)
                    ? IconButton(
                        icon: const Icon(Icons.task_alt_rounded),
                        tooltip: 'Kaydı kapat',
                        onPressed: () => _completeService(record),
                      )
                    : null,
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _vehicleSheet() async {
    final plate = TextEditingController(),
        brand = TextEditingController(),
        model = TextEditingController(),
        year = TextEditingController(text: '${DateTime.now().year}'),
        license = TextEditingController(text: 'B'),
        km = TextEditingController(text: '0');
    var transmission = 1;
    DateTime? inspection, insurance;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setLocal) => DrivingFormSheet(
          title: 'Yeni Eğitim Aracı'.tr,
          fields: [
            TextField(
              controller: plate,
              textCapitalization: TextCapitalization.characters,
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
              controller: year,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Model yılı'),
            ),
            TextField(
              controller: license,
              decoration: const InputDecoration(labelText: 'Ehliyet sınıfı'),
            ),
            DropdownButtonFormField<int>(
              initialValue: transmission,
              decoration: const InputDecoration(labelText: 'Vites'),
              items: [
                DropdownMenuItem(value: 1, child: Text('Manuel'.tr)),
                DropdownMenuItem(value: 2, child: Text('Otomatik'.tr)),
              ],
              onChanged: (v) => setLocal(() => transmission = v ?? 1),
            ),
            TextField(
              controller: km,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Kilometre'),
            ),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: context,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 3650)),
                      );
                      setLocal(() => inspection = picked ?? inspection);
                    },
                    child: Text(
                      inspection == null
                          ? 'Muayene tarihi'
                          : _dateOnly(inspection!.toIso8601String()),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: context,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 3650)),
                      );
                      setLocal(() => insurance = picked ?? insurance);
                    },
                    child: Text(
                      insurance == null
                          ? 'Sigorta tarihi'
                          : _dateOnly(insurance!.toIso8601String()),
                    ),
                  ),
                ),
              ],
            ),
          ],
          onSave: () async {
            if (plate.text.trim().length < 4) {
              throw StateError('Plaka zorunludur.');
            }
            await _service.createVehicle({
              'plateNumber': plate.text,
              'brand': brand.text,
              'model': model.text,
              'modelYear': int.tryParse(year.text) ?? 0,
              'licenseClass': license.text,
              'transmissionType': transmission,
              'currentKilometer': int.tryParse(km.text) ?? 0,
              'inspectionExpiresAtUtc': inspection?.toUtc().toIso8601String(),
              'insuranceExpiresAtUtc': insurance?.toUtc().toIso8601String(),
            });
            if (context.mounted) Navigator.pop(context);
          },
        ),
      ),
    );
    await _load();
  }

  Future<void> _complianceActions() async {
    final action = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              title: Text(
                'Yeni uygunluk kaydı'.tr,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
            if (_permissions.can(DrivingPermissions.vehicleDocumentUpload))
              ListTile(
                leading: const Icon(Icons.upload_file_rounded),
                title: Text('Araç evrakı yükle'.tr),
                onTap: () => Navigator.pop(context, 'document'),
              ),
            if (_permissions.canAny([
              DrivingPermissions.vehicleServiceManage,
              DrivingPermissions.vehicleServiceReport,
            ]))
              ListTile(
                leading: const Icon(Icons.build_circle_rounded),
                title: Text(
                  _permissions.can(DrivingPermissions.vehicleServiceManage)
                      ? 'Bakım / arıza bildir'
                      : 'Arıza / hasar bildir',
                ),
                onTap: () => Navigator.pop(context, 'service'),
              ),
          ],
        ),
      ),
    );
    if (!mounted) return;
    if (action == 'document') await _documentSheet();
    if (action == 'service') await _serviceSheet();
  }

  Future<void> _documentSheet() async {
    String vehicleId = '', type = 'Inspection';
    final number = TextEditingController(),
        reminder = TextEditingController(text: '30'),
        description = TextEditingController();
    DateTime? starts, expires;
    PlatformFile? file;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setLocal) => DrivingFormSheet(
          title: 'Araç Evrakı Yükle'.tr,
          fields: [
            DropdownButtonFormField<String>(
              initialValue: vehicleId.isEmpty ? null : vehicleId,
              decoration: const InputDecoration(labelText: 'Araç'),
              items: _vehicles
                  .map(
                    (v) => DropdownMenuItem(
                      value: '${v['id']}',
                      child: Text('${v['plateNumber']}'),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setLocal(() => vehicleId = v ?? ''),
            ),
            DropdownButtonFormField<String>(
              initialValue: type,
              decoration: const InputDecoration(labelText: 'Belge türü'),
              items: [
                DropdownMenuItem(value: 'Inspection', child: Text('Muayene'.tr)),
                DropdownMenuItem(
                  value: 'TrafficInsurance',
                  child: Text('Trafik Sigortası'.tr),
                ),
                DropdownMenuItem(value: 'Registration', child: Text('Ruhsat'.tr)),
                DropdownMenuItem(value: 'Casco', child: Text('Kasko'.tr)),
                DropdownMenuItem(value: 'Emission', child: Text('Egzoz Emisyon'.tr)),
                DropdownMenuItem(
                  value: 'CourseUsage',
                  child: Text('Kurs Kullanım Belgesi'.tr),
                ),
                DropdownMenuItem(value: 'DualControl', child: Text('Çift Kumanda'.tr)),
                DropdownMenuItem(value: 'Other', child: Text('Diğer'.tr)),
              ],
              onChanged: (v) => setLocal(() => type = v ?? type),
            ),
            TextField(
              controller: number,
              decoration: const InputDecoration(labelText: 'Belge numarası'),
            ),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: context,
                        firstDate: DateTime(2000),
                        lastDate: DateTime.now().add(const Duration(days: 7300)),
                      );
                      setLocal(() => starts = picked ?? starts);
                    },
                    child: Text(
                      starts == null ? 'Başlangıç' : _dateOnly(starts!.toIso8601String()),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: context,
                        firstDate: DateTime.now().subtract(const Duration(days: 3650)),
                        lastDate: DateTime.now().add(const Duration(days: 7300)),
                      );
                      setLocal(() => expires = picked ?? expires);
                    },
                    child: Text(
                      expires == null ? 'Bitiş' : _dateOnly(expires!.toIso8601String()),
                    ),
                  ),
                ),
              ],
            ),
            TextField(
              controller: reminder,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Hatırlatma günü'),
            ),
            OutlinedButton.icon(
              onPressed: () async {
                final result = await FilePicker.platform.pickFiles(
                  type: FileType.custom,
                  allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
                  withData: true,
                );
                setLocal(() => file = result?.files.single);
              },
              icon: const Icon(Icons.attach_file),
              label: Text(file?.name ?? 'Belge yükle'.tr),
            ),
            TextField(
              controller: description,
              maxLength: 1000,
              decoration: const InputDecoration(labelText: 'Açıklama'),
            ),
          ],
          onSave: () async {
            if (vehicleId.isEmpty ||
                expires == null ||
                file == null ||
                number.text.trim().length < 2) {
              throw StateError('Araç, belge, numara ve bitiş tarihi zorunludur.');
            }
            final url = await _service.uploadVehicleDocument(file!);
            await _service.createVehicleDocument({
              'vehicleId': vehicleId,
              'documentType': type,
              'documentNumber': number.text,
              'startsAtUtc': starts?.toUtc().toIso8601String(),
              'expiresAtUtc': expires!.toUtc().toIso8601String(),
              'fileUrl': url,
              'reminderDays': int.tryParse(reminder.text) ?? 30,
              'description': description.text,
            });
            if (context.mounted) Navigator.pop(context);
          },
        ),
      ),
    );
    await _load();
  }

  Future<void> _serviceSheet() async {
    // Yalnızca bildirim yetkisi olan (öğretmen) bakım kaydı açamaz ve maliyet
    // giremez; formu backend'in kabul edeceği şekle indiriyoruz.
    final canManage = _permissions.can(DrivingPermissions.vehicleServiceManage);
    String vehicleId = '',
        type = canManage ? 'Maintenance' : 'Fault',
        priority = 'Normal';
    bool usable = false;
    final title = TextEditingController(),
        provider = TextEditingController(),
        description = TextEditingController(),
        kilometer = TextEditingController(text: '0'),
        labor = TextEditingController(text: '0'),
        parts = TextEditingController(text: '0');
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setLocal) => DrivingFormSheet(
          title: canManage ? 'Bakım / Arıza Bildir'.tr : 'Arıza / Hasar Bildir'.tr,
          fields: [
            DropdownButtonFormField<String>(
              initialValue: vehicleId.isEmpty ? null : vehicleId,
              decoration: const InputDecoration(labelText: 'Araç'),
              items: _vehicles
                  .map(
                    (v) => DropdownMenuItem(
                      value: '${v['id']}',
                      child: Text('${v['plateNumber']}'),
                    ),
                  )
                  .toList(),
              onChanged: (v) {
                setLocal(() {
                  vehicleId = v ?? '';
                  kilometer.text =
                      '${_vehicles.where((x) => '${x['id']}' == vehicleId).firstOrNull?['currentKilometer'] ?? 0}';
                });
              },
            ),
            DropdownButtonFormField<String>(
              initialValue: type,
              decoration: const InputDecoration(labelText: 'Kayıt türü'),
              items: [
                if (canManage)
                  DropdownMenuItem(value: 'Maintenance', child: Text('Bakım'.tr)),
                DropdownMenuItem(value: 'Fault', child: Text('Arıza'.tr)),
                DropdownMenuItem(value: 'Damage', child: Text('Hasar'.tr)),
              ],
              onChanged: (v) => setLocal(() => type = v ?? type),
            ),
            TextField(
              controller: title,
              decoration: const InputDecoration(labelText: 'Başlık'),
            ),
            TextField(
              controller: provider,
              decoration: const InputDecoration(labelText: 'Servis'),
            ),
            TextField(
              controller: description,
              maxLength: 2000,
              decoration: const InputDecoration(labelText: 'Açıklama'),
            ),
            DropdownButtonFormField<String>(
              initialValue: priority,
              decoration: const InputDecoration(labelText: 'Öncelik'),
              items: [
                DropdownMenuItem(value: 'Low', child: Text('Düşük'.tr)),
                DropdownMenuItem(value: 'Normal', child: Text('Normal'.tr)),
                DropdownMenuItem(value: 'High', child: Text('Yüksek'.tr)),
                DropdownMenuItem(value: 'Critical', child: Text('Kritik'.tr)),
              ],
              onChanged: (v) => setLocal(() => priority = v ?? priority),
            ),
            TextField(
              controller: kilometer,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Kilometre'),
            ),
            if (canManage)
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: labor,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'İşçilik'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: parts,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Parça'),
                    ),
                  ),
                ],
              ),
            SwitchListTile(
              value: usable,
              onChanged: (v) => setLocal(() => usable = v),
              title: Text('Araç güvenle kullanılabilir'.tr),
              contentPadding: EdgeInsets.zero,
            ),
          ],
          onSave: () async {
            if (vehicleId.isEmpty || title.text.trim().length < 3) {
              throw StateError('Araç ve başlık zorunludur.');
            }
            await _service.createVehicleServiceRecord({
              'vehicleId': vehicleId,
              'recordType': type,
              'title': title.text,
              'serviceProvider': provider.text,
              'description': description.text,
              'priority': priority,
              'reportedAtUtc': DateTime.now().toUtc().toIso8601String(),
              'kilometer': int.tryParse(kilometer.text) ?? 0,
              'vehicleUsable': usable,
              'laborCost': double.tryParse(labor.text) ?? 0,
              'partsCost': double.tryParse(parts.text) ?? 0,
              'nextServiceAtUtc': null,
              'nextServiceKilometer': null,
            });
            if (context.mounted) Navigator.pop(context);
          },
        ),
      ),
    );
    await _load();
  }

  Future<void> _completeService(Map<String, dynamic> record) async {
    final controller = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Servis kaydını kapat'.tr),
        content: TextField(
          controller: controller,
          maxLength: 2000,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'Çözüm ve yapılan işlemler'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Vazgeç'.tr),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Kapat'.tr),
          ),
        ],
      ),
    );
    if (confirmed == true && controller.text.trim().length >= 3) {
      await _service.completeVehicleServiceRecord('${record['id']}', controller.text);
      await _load();
    }
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
