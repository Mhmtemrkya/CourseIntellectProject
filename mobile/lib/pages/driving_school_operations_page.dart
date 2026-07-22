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
                        trailing: Text(
                          '₺${p['price']}',
                          style: const TextStyle(fontWeight: FontWeight.w900),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
  );

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
        builder: (context, setLocal) => DrivingFormSheet(
          title: 'Yeni Eğitim Paketi'.tr,
          fields: [
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
}
