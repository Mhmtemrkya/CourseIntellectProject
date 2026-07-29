import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:student/i18n/app_locale.dart';
import '../navigation/admin_bottom_nav.dart';
import '../navigation/driving_school_bottom_nav.dart';
import '../services/driving_school_api_service.dart';
import '../services/admin_workflow_api_service.dart';
import '../services/branding_service.dart';
import '../services/branch_scope_store.dart';
import '../theme_provider.dart';

const _branchTypes = ['şube', 'sube', 'kampüs', 'kampus'];

/// Kurum yöneticisi ilk girişte yönetmek istediği şubeyi seçer. En az bir şube
/// varsa "Tüm Şubeler" dahil seçim açıkça gösterilir.
class BranchSelectPage extends StatefulWidget {
  const BranchSelectPage({super.key});

  @override
  State<BranchSelectPage> createState() => _BranchSelectPageState();
}

class _BranchSelectPageState extends State<BranchSelectPage> {
  bool _loading = true;
  bool _canViewAllBranches = false;
  List<Map<String, dynamic>> _branches = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    List<Map<String, dynamic>> units = const [];
    Map<String, dynamic>? scope;
    try {
      units = await AdminWorkflowApiService.instance.getOrgUnits();
    } catch (_) {}
    try {
      scope = await AdminWorkflowApiService.instance.getMyScope();
    } catch (_) {}
    final tenants = ((scope?['tenants'] as List<dynamic>?) ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    final activeTenantId = (scope?['active'] as Map?)?['tenantId']?.toString();
    final activeTenant = tenants
        .where((tenant) => tenant['id']?.toString() == activeTenantId)
        .firstOrNull;
    final effectiveTenant =
        activeTenant ?? (tenants.isNotEmpty ? tenants.first : null);
    final allowedIds =
        (((effectiveTenant?['branches'] as List<dynamic>?) ?? const [])
                .map((item) => (item as Map)['id']?.toString())
                .whereType<String>())
            .toSet();
    final branches = units
        .where(
          (u) =>
              u['isActive'] != false &&
              _branchTypes.contains(
                (u['unitType'] ?? '').toString().toLowerCase(),
              ) &&
              (effectiveTenant == null ||
                  allowedIds.contains(u['id']?.toString())),
        )
        .toList();
    if (branches.isEmpty) {
      await BranchScopeStore.instance.select(null);
      _enter();
      return;
    }
    if (!mounted) return;
    setState(() {
      _branches = branches;
      _canViewAllBranches = scope?['canViewAllBranches'] == true;
      _loading = false;
    });
  }

  Future<void> _choose(Map<String, dynamic> branch) async {
    await BranchScopeStore.instance.select(branch['id']?.toString());
    _enter();
  }

  Future<void> _chooseAll() async {
    await BranchScopeStore.instance.select(null);
    _enter();
  }

  Future<void> _enter() async {
    if (!mounted) return;
    await BrandingService.instance.applyBranding(context.read<ThemeProvider>());
    if (!mounted) return;
    var drivingSchool = false;
    try {
      drivingSchool = await DrivingSchoolApiService.instance.isAvailable();
    } catch (_) {}
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => drivingSchool
            ? const DrivingSchoolBottomNav()
            : const AdminBottomNav(),
      ),
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
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Tüm ekranlar seçtiğiniz şubeye göre görüntülenir.'.tr,
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: 16),
          if (_canViewAllBranches)
            Card(
              color: theme.colorScheme.primaryContainer,
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                leading: const CircleAvatar(
                  child: Icon(Icons.account_tree_outlined),
                ),
                title: Text(
                  'Tüm Şubeler'.tr,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text(
                  'Bütün şubelerin birleşik verilerini gösterir.'.tr,
                ),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: _chooseAll,
              ),
            ),
          ..._branches.map(
            (branch) => Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                leading: const CircleAvatar(
                  child: Icon(Icons.apartment_outlined),
                ),
                title: Text(
                  '${branch['name'] ?? 'Şube'}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text(
                  '${branch['unitType'] ?? ''}${(branch['managerName'] ?? '').toString().isNotEmpty ? ' • ${branch['managerName']}' : ''}',
                ),
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
