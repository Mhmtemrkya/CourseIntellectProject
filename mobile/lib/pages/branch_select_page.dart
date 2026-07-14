import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../navigation/admin_bottom_nav.dart';
import '../navigation/driving_school_bottom_nav.dart';
import '../services/driving_school_api_service.dart';
import '../services/admin_workflow_api_service.dart';
import '../services/branch_scope_store.dart';

const _branchTypes = ['şube', 'sube', 'kampüs', 'kampus'];

/// Kurum yöneticisi ilk girişte yönetmek istediği şubeyi seçer. Tek/sıfır şubeli
/// kurumlarda otomatik devam edilir.
class BranchSelectPage extends StatefulWidget {
  const BranchSelectPage({super.key});

  @override
  State<BranchSelectPage> createState() => _BranchSelectPageState();
}

class _BranchSelectPageState extends State<BranchSelectPage> {
  bool _loading = true;
  List<Map<String, dynamic>> _branches = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    await BranchScopeStore.instance.ensureLoaded();
    if (BranchScopeStore.instance.isSelected) {
      _enter();
      return;
    }
    List<Map<String, dynamic>> units = const [];
    try {
      units = await AdminWorkflowApiService.instance.getOrgUnits();
    } catch (_) {}
    final branches = units
        .where((u) =>
            u['isActive'] != false &&
            _branchTypes.contains((u['unitType'] ?? '').toString().toLowerCase()))
        .toList();
    if (branches.length <= 1) {
      await BranchScopeStore.instance.select(
        branches.isEmpty ? null : branches.first['id']?.toString(),
      );
      _enter();
      return;
    }
    if (!mounted) return;
    setState(() {
      _branches = branches;
      _loading = false;
    });
  }

  Future<void> _choose(Map<String, dynamic> branch) async {
    await BranchScopeStore.instance.select(branch['id']?.toString());
    _enter();
  }

  Future<void> _enter() async {
    if (!mounted) return;
    var drivingSchool = false;
    try { drivingSchool = await DrivingSchoolApiService.instance.isAvailable(); } catch (_) {}
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => drivingSchool ? const DrivingSchoolBottomNav() : const AdminBottomNav()),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text('Şube Seçin'.tr)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Yönetmek istediğiniz şubeyi seçin'.tr,
            style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 4),
          Text(
            'Tüm ekranlar seçtiğiniz şubeye göre görüntülenir.'.tr,
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: 16),
          ..._branches.map(
            (branch) => Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                leading: const CircleAvatar(child: Icon(Icons.apartment_outlined)),
                title: Text(
                  '${branch['name'] ?? 'Şube'}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text('${branch['unitType'] ?? ''}${(branch['managerName'] ?? '').toString().isNotEmpty ? ' • ${branch['managerName']}' : ''}'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => _choose(branch),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
