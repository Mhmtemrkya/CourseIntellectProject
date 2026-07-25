import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/driving_permissions_store.dart';
import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';

/// Yalnızca eğitim paketleri. Araçla ilgili her şey (araç ekleme, evrak, bakım)
/// "Araçlar" ekranındadır — masaüstündeki ayrımın mobil karşılığı.
class DrivingSchoolOperationsPage extends StatefulWidget {
  const DrivingSchoolOperationsPage({super.key});
  @override
  State<DrivingSchoolOperationsPage> createState() =>
      _DrivingSchoolOperationsPageState();
}

class _DrivingSchoolOperationsPageState
    extends State<DrivingSchoolOperationsPage> {
  static const _licenseClasses = [
    'A',
    'A1',
    'A2',
    'B',
    'BE',
    'C',
    'C1',
    'CE',
    'C1E',
    'D',
    'D1',
    'DE',
    'D1E',
    'F',
    'M',
  ];

  bool _loading = true;
  String? _error;
  DrivingPermissionSnapshot _permissions = DrivingPermissionSnapshot.empty;
  List<Map<String, dynamic>> _packages = const [];

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
      final permissions = await DrivingPermissionsStore.instance.load();
      // Görme izni yoksa listeyi hiç istemeyiz: tek bir 403 sayfanın tamamını
      // hata ekranına düşürürdü.
      final packages = permissions.can(DrivingPermissions.packageView)
          ? await DrivingSchoolApiService.instance.packages()
          : const <Map<String, dynamic>>[];
      if (mounted) {
        setState(() {
          _permissions = permissions;
          _packages = packages;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => DrivingScaffold(
    appBar: AppBar(title: Text('Paketler'.tr)),
    floatingActionButton:
        _loading || !_permissions.can(DrivingPermissions.packageCreate)
        ? null
        : FloatingActionButton.extended(
            onPressed: _packageSheet,
            icon: const Icon(Icons.add),
            label: Text('Yeni Paket'.tr),
          ),
    child: _loading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
        ? Center(
            child: FilledButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh),
              label: Text(_error!),
            ),
          )
        : RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              children: [
                DrivingHero(
                  eyebrow: 'PAKETLER'.tr,
                  title: 'Eğitim Paketleri'.tr,
                  description:
                      'Ders süresi ve fiyat tanımları. Araç işlemleri "Araçlar" ekranındadır.'
                          .tr,
                  icon: Icons.inventory_2_rounded,
                  metrics: [
                    DrivingHeroMetric(
                      label: 'Tanımlı'.tr,
                      value: '${_packages.length}',
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                if (_packages.isEmpty)
                  DrivingEmptyState(
                    icon: Icons.inventory_2_rounded,
                    title: 'Tanımlı eğitim paketi yok.'.tr,
                  )
                else
                  ..._packages.map(
                    (p) => Card(
                      child: ListTile(
                        leading: const CircleAvatar(
                          child: Icon(Icons.school_rounded),
                        ),
                        title: Text(
                          '${p['name']}',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        subtitle: Text(
                          '${p['licenseClass']} • ${p['transmissionType'] == 1 ? 'Manuel' : 'Otomatik'} • ${p['drivingLessonMinutes']} dk',
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '₺${p['price']}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            if (_permissions.can(
                              DrivingPermissions.packageUpdate,
                            ))
                              IconButton(
                                tooltip: 'Düzenle'.tr,
                                onPressed: () => _packageSheet(p),
                                icon: const Icon(Icons.edit_outlined),
                              ),
                            if (_permissions.can(
                              DrivingPermissions.packageDelete,
                            ))
                              IconButton(
                                tooltip: 'Sil'.tr,
                                onPressed: () => _confirmDeletePackage(p),
                                icon: const Icon(
                                  Icons.delete_outline,
                                  color: Colors.red,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
  );

  Future<void> _packageSheet([Map<String, dynamic>? existing]) async {
    final name = TextEditingController(text: existing?['name']?.toString()),
        driving = TextEditingController(
          text: existing?['drivingLessonMinutes']?.toString() ?? '840',
        ),
        theory = TextEditingController(
          text: existing?['theoryLessonMinutes']?.toString() ?? '720',
        ),
        price = TextEditingController(
          text: existing?['price']?.toString() ?? '0',
        );
    var licenseClass = existing?['licenseClass']?.toString() ?? 'B';
    if (!_licenseClasses.contains(licenseClass)) licenseClass = 'B';
    var transmission =
        int.tryParse(existing?['transmissionType']?.toString() ?? '') ?? 1;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setLocal) => DrivingFormSheet(
          title: existing == null
              ? 'Yeni Eğitim Paketi'.tr
              : 'Eğitim Paketini Düzenle'.tr,
          fields: [
            TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Paket adı'),
            ),
            DropdownButtonFormField<String>(
              initialValue: licenseClass,
              decoration: const InputDecoration(labelText: 'Ehliyet sınıfı'),
              items: _licenseClasses
                  .map(
                    (item) => DropdownMenuItem(value: item, child: Text(item)),
                  )
                  .toList(),
              onChanged: (value) => setLocal(() => licenseClass = value ?? 'B'),
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
          onSave: () async {
            final payload = {
              'name': name.text,
              'licenseClass': licenseClass,
              'transmissionType': transmission,
              'drivingLessonMinutes': int.tryParse(driving.text) ?? 0,
              'theoryLessonMinutes': int.tryParse(theory.text) ?? 0,
              'price': double.tryParse(price.text) ?? 0,
            };
            if (existing == null) {
              await DrivingSchoolApiService.instance.createPackage(payload);
            } else {
              await DrivingSchoolApiService.instance.updatePackage(
                existing['id'].toString(),
                payload,
              );
            }
            if (context.mounted) Navigator.pop(context);
          },
        ),
      ),
    );
    await _load();
  }

  Future<void> _confirmDeletePackage(Map<String, dynamic> item) async {
    final approved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Paketi Sil'.tr),
        content: Text(
          '“${item['name']}” paketini silmek istediğinize emin misiniz?'.tr,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text('Vazgeç'.tr),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: Text('Sil'.tr),
          ),
        ],
      ),
    );
    if (approved != true) return;

    try {
      await DrivingSchoolApiService.instance.deletePackage(
        item['id'].toString(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Paket silindi'.tr)));
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString()), backgroundColor: Colors.red),
      );
    }
  }
}
