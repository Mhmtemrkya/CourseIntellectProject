import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../services/driving_permissions_store.dart';
import '../services/driving_school_api_service.dart';

class DrivingSchoolOperationsPage extends StatefulWidget {
  const DrivingSchoolOperationsPage({super.key});
  @override
  State<DrivingSchoolOperationsPage> createState() =>
      _DrivingSchoolOperationsPageState();
}

class _DrivingSchoolOperationsPageState
    extends State<DrivingSchoolOperationsPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  bool _loading = true;
  String? _error;
  DrivingPermissionSnapshot _permissions = DrivingPermissionSnapshot.empty;
  List<Map<String, dynamic>> _packages = const [],
      _vehicles = const [],
      _documents = const [],
      _serviceRecords = const [];
  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _tabs.addListener(() {
      // FAB'ın görünürlüğü aktif sekmenin iznine bağlı; sekme değişince yenile.
      if (mounted) setState(() {});
    });
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  /// Aktif sekmede bir kayıt oluşturabiliyor mu? (FAB buna göre gizlenir.)
  bool get _canCreateOnActiveTab => switch (_tabs.index) {
    0 => _permissions.can(DrivingPermissions.packageCreate),
    1 => _permissions.can(DrivingPermissions.vehicleCreate),
    _ => _permissions.canAny([
      DrivingPermissions.vehicleDocumentUpload,
      DrivingPermissions.vehicleServiceManage,
      DrivingPermissions.vehicleServiceReport,
    ]),
  };

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final permissions = await DrivingPermissionsStore.instance.load();
      // Görme izni olmayan listeyi hiç istemeyiz: tek bir 403, sayfanın
      // tamamını hata ekranına düşürürdü (ör. filo sorumlusu ve paketler).
      final result = await Future.wait([
        permissions.can(DrivingPermissions.packageView)
            ? DrivingSchoolApiService.instance.packages()
            : Future.value(const <Map<String, dynamic>>[]),
        permissions.can(DrivingPermissions.vehicleView)
            ? DrivingSchoolApiService.instance.vehicles()
            : Future.value(const <Map<String, dynamic>>[]),
        permissions.can(DrivingPermissions.vehicleDocumentView)
            ? DrivingSchoolApiService.instance.vehicleDocuments()
            : Future.value(const <Map<String, dynamic>>[]),
        permissions.can(DrivingPermissions.vehicleServiceView)
            ? DrivingSchoolApiService.instance.vehicleServiceRecords()
            : Future.value(const <Map<String, dynamic>>[]),
      ]);
      if (mounted) {
        setState(() {
          _permissions = permissions;
          _packages = result[0];
          _vehicles = result[1];
          _documents = result[2];
          _serviceRecords = result[3];
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Paket ve Filo'),
      bottom: TabBar(
        controller: _tabs,
        tabs: const [
          Tab(icon: Icon(Icons.inventory_2_rounded), text: 'Paketler'),
          Tab(icon: Icon(Icons.directions_car_rounded), text: 'Araçlar'),
          Tab(icon: Icon(Icons.verified_user_rounded), text: 'Uygunluk'),
        ],
      ),
    ),
    floatingActionButton: _loading || !_canCreateOnActiveTab
        ? null
        : FloatingActionButton.extended(
            onPressed: () => _tabs.index == 0
                ? _packageSheet()
                : _tabs.index == 1
                ? _vehicleSheet()
                : _complianceActions(),
            icon: const Icon(Icons.add),
            label: const Text('Yeni Kayıt'),
          ),
    body: _loading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
        ? Center(
            child: FilledButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh),
              label: Text(_error!),
            ),
          )
        : TabBarView(
            controller: _tabs,
            children: [_packageList(), _vehicleList(), _complianceList()],
          ),
  );
  Widget _packageList() => RefreshIndicator(
    onRefresh: _load,
    child: ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _packages.length,
      separatorBuilder: (context, index) => const SizedBox(height: 10),
      itemBuilder: (_, i) {
        final p = _packages[i];
        return Card(
          child: ListTile(
            leading: const CircleAvatar(child: Icon(Icons.school_rounded)),
            title: Text(
              '${p['name']}',
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
            subtitle: Text(
              '${p['licenseClass']} • ${p['transmissionType'] == 1 ? 'Manuel' : 'Otomatik'} • ${p['drivingLessonMinutes']} dk',
            ),
            trailing: Text(
              '₺${p['price']}',
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
        );
      },
    ),
  );
  Widget _vehicleList() => RefreshIndicator(
    onRefresh: _load,
    child: ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _vehicles.length,
      separatorBuilder: (context, index) => const SizedBox(height: 10),
      itemBuilder: (_, i) {
        final v = _vehicles[i];
        final maintenance = v['isInMaintenance'] == true;
        return Card(
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: (maintenance ? Colors.red : Colors.orange)
                  .withValues(alpha: .12),
              child: Icon(
                Icons.directions_car_rounded,
                color: maintenance ? Colors.red : Colors.orange,
              ),
            ),
            title: Text(
              '${v['plateNumber']}',
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
            subtitle: Text(
              '${v['brand']} ${v['model']} • ${v['licenseClass']} • ${v['transmissionType'] == 1 ? 'Manuel' : 'Otomatik'}',
            ),
            trailing: Chip(label: Text(maintenance ? 'Bakımda' : 'Aktif')),
          ),
        );
      },
    ),
  );
  Widget _complianceList() {
    final open = _serviceRecords.where((x) => x['status'] == 'Open').toList();
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        children: [
          const Text(
            'Evrak Durumları',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          if (_documents.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(22),
                child: Text(
                  'Henüz araç evrakı yüklenmedi.',
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ..._documents.map((document) {
            final status = '${document['status']}';
            final color = status == 'Valid'
                ? Colors.green
                : status == 'ExpiringSoon'
                ? Colors.orange
                : Colors.red;
            return Card(
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: color.withValues(alpha: .12),
                  child: Icon(Icons.description_rounded, color: color),
                ),
                title: Text(
                  '${document['plateNumber']} • ${document['documentType']}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text(
                  '${document['documentNumber']} • ${_date(document['expiresAtUtc'])}',
                ),
                trailing: Chip(label: Text(status)),
              ),
            );
          }),
          const SizedBox(height: 18),
          const Text(
            'Açık Bakım ve Arızalar',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          if (open.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(22),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.check_circle_rounded, color: Colors.green),
                    SizedBox(width: 8),
                    Text('Açık servis kaydı yok.'),
                  ],
                ),
              ),
            ),
          ...open.map(
            (record) => Card(
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor:
                      (record['vehicleUsable'] == true
                              ? Colors.orange
                              : Colors.red)
                          .withValues(alpha: .12),
                  child: Icon(
                    Icons.build_rounded,
                    color: record['vehicleUsable'] == true
                        ? Colors.orange
                        : Colors.red,
                  ),
                ),
                title: Text(
                  '${record['plateNumber']} • ${record['title']}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text(
                  '${record['recordType']} • ${record['priority']}',
                ),
                trailing:
                    _permissions.can(DrivingPermissions.vehicleServiceManage)
                    ? IconButton(
                        icon: const Icon(Icons.task_alt_rounded),
                        tooltip: 'Kaydı kapat',
                        onPressed: () => _completeService(record),
                      )
                    : null,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _date(dynamic raw) {
    final value = DateTime.tryParse('$raw')?.toLocal();
    if (value == null) return '-';
    return '${value.day}.${value.month}.${value.year}';
  }

  Future<void> _packageSheet() async {
    final name = TextEditingController(),
        license = TextEditingController(text: 'B'),
        driving = TextEditingController(text: '840'),
        theory = TextEditingController(text: '720'),
        price = TextEditingController(text: '0');
    var transmission = 1;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setLocal) => _sheet(
          'Yeni Eğitim Paketi',
          [
            TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Paket adı'),
            ),
            TextField(
              controller: license,
              decoration: const InputDecoration(labelText: 'Ehliyet sınıfı'),
            ),
            DropdownButtonFormField<int>(
              initialValue: transmission,
              decoration: const InputDecoration(labelText: 'Vites'),
              items: const [
                DropdownMenuItem(value: 1, child: Text('Manuel')),
                DropdownMenuItem(value: 2, child: Text('Otomatik')),
              ],
              onChanged: (v) => setLocal(() => transmission = v ?? 1),
            ),
            TextField(
              controller: driving,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Direksiyon süresi (dk)',
              ),
            ),
            TextField(
              controller: theory,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Teorik süre (dk)'),
            ),
            TextField(
              controller: price,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Fiyat'),
            ),
          ],
          () async {
            await DrivingSchoolApiService.instance.createPackage({
              'name': name.text,
              'licenseClass': license.text,
              'transmissionType': transmission,
              'drivingLessonMinutes': int.tryParse(driving.text) ?? 0,
              'theoryLessonMinutes': int.tryParse(theory.text) ?? 0,
              'price': double.tryParse(price.text) ?? 0,
            });
            if (context.mounted) Navigator.pop(context);
          },
        ),
      ),
    );
    await _load();
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
        builder: (context, setLocal) => _sheet(
          'Yeni Eğitim Aracı',
          [
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
              items: const [
                DropdownMenuItem(value: 1, child: Text('Manuel')),
                DropdownMenuItem(value: 2, child: Text('Otomatik')),
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
                      inspection = await showDatePicker(
                        context: context,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(
                          const Duration(days: 3650),
                        ),
                      );
                      setLocal(() {});
                    },
                    child: Text(
                      inspection == null
                          ? 'Muayene tarihi'
                          : '${inspection!.day}.${inspection!.month}.${inspection!.year}',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () async {
                      insurance = await showDatePicker(
                        context: context,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(
                          const Duration(days: 3650),
                        ),
                      );
                      setLocal(() {});
                    },
                    child: Text(
                      insurance == null
                          ? 'Sigorta tarihi'
                          : '${insurance!.day}.${insurance!.month}.${insurance!.year}',
                    ),
                  ),
                ),
              ],
            ),
          ],
          () async {
            await DrivingSchoolApiService.instance.createVehicle({
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
            const ListTile(
              title: Text(
                'Yeni uygunluk kaydı',
                style: TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
            if (_permissions.can(DrivingPermissions.vehicleDocumentUpload))
              ListTile(
                leading: const Icon(Icons.upload_file_rounded),
                title: const Text('Araç evrakı yükle'),
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
        builder: (context, setLocal) => _sheet(
          'Araç Evrakı Yükle',
          [
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
              items: const [
                DropdownMenuItem(value: 'Inspection', child: Text('Muayene')),
                DropdownMenuItem(
                  value: 'TrafficInsurance',
                  child: Text('Trafik Sigortası'),
                ),
                DropdownMenuItem(value: 'Registration', child: Text('Ruhsat')),
                DropdownMenuItem(value: 'Casco', child: Text('Kasko')),
                DropdownMenuItem(
                  value: 'Emission',
                  child: Text('Egzoz Emisyon'),
                ),
                DropdownMenuItem(
                  value: 'CourseUsage',
                  child: Text('Kurs Kullanım Belgesi'),
                ),
                DropdownMenuItem(value: 'Other', child: Text('Diğer')),
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
                      starts = await showDatePicker(
                        context: context,
                        firstDate: DateTime(2000),
                        lastDate: DateTime.now().add(
                          const Duration(days: 7300),
                        ),
                      );
                      setLocal(() {});
                    },
                    child: Text(
                      starts == null
                          ? 'Başlangıç'
                          : _date(starts!.toIso8601String()),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () async {
                      expires = await showDatePicker(
                        context: context,
                        firstDate: DateTime.now().subtract(
                          const Duration(days: 3650),
                        ),
                        lastDate: DateTime.now().add(
                          const Duration(days: 7300),
                        ),
                      );
                      setLocal(() {});
                    },
                    child: Text(
                      expires == null
                          ? 'Bitiş'
                          : _date(expires!.toIso8601String()),
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
              label: Text(file?.name ?? 'PDF veya görsel seç'),
            ),
            TextField(
              controller: description,
              maxLength: 1000,
              decoration: const InputDecoration(labelText: 'Açıklama'),
            ),
          ],
          () async {
            if (vehicleId.isEmpty ||
                expires == null ||
                file == null ||
                number.text.trim().length < 2) {
              throw StateError(
                'Araç, belge, numara ve bitiş tarihi zorunludur.',
              );
            }
            final url = await DrivingSchoolApiService.instance
                .uploadVehicleDocument(file!);
            await DrivingSchoolApiService.instance.createVehicleDocument({
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
        builder: (context, setLocal) => _sheet(
          canManage ? 'Bakım / Arıza Bildir' : 'Arıza / Hasar Bildir',
          [
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
                  const DropdownMenuItem(
                    value: 'Maintenance',
                    child: Text('Bakım'),
                  ),
                const DropdownMenuItem(value: 'Fault', child: Text('Arıza')),
                const DropdownMenuItem(value: 'Damage', child: Text('Hasar')),
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
              items: const [
                DropdownMenuItem(value: 'Low', child: Text('Düşük')),
                DropdownMenuItem(value: 'Normal', child: Text('Normal')),
                DropdownMenuItem(value: 'High', child: Text('Yüksek')),
                DropdownMenuItem(value: 'Critical', child: Text('Kritik')),
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
              title: const Text('Araç güvenle kullanılabilir'),
              contentPadding: EdgeInsets.zero,
            ),
          ],
          () async {
            await DrivingSchoolApiService.instance.createVehicleServiceRecord({
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
        title: const Text('Servis kaydını kapat'),
        content: TextField(
          controller: controller,
          maxLength: 2000,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Çözüm ve yapılan işlemler',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Kapat'),
          ),
        ],
      ),
    );
    if (confirmed == true && controller.text.trim().length >= 3) {
      await DrivingSchoolApiService.instance.completeVehicleServiceRecord(
        '${record['id']}',
        controller.text,
      );
      await _load();
    }
  }

  Widget _sheet(
    String title,
    List<Widget> fields,
    Future<void> Function() save,
  ) => Padding(
    padding: EdgeInsets.fromLTRB(
      20,
      20,
      20,
      MediaQuery.viewInsetsOf(context).bottom + 24,
    ),
    child: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 16),
          ...fields.expand((w) => [w, const SizedBox(height: 12)]),
          FilledButton.icon(
            onPressed: save,
            icon: const Icon(Icons.save_rounded),
            label: const Text('Kaydet'),
          ),
        ],
      ),
    ),
  );
}
