import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/admin_workflow_api_service.dart';
import '../services/branch_scope_store.dart';
import '../services/tenant_scope_store.dart';
import 'branch_select_page.dart';
import 'consolidated_overview_page.dart';
import 'scope_management_page.dart';

/// Sahip/MEB ilk girişte yönetmek istediği kurumu seçer. Tek kurumlu (veya kurum
/// geçiş yetkisi olmayan) kullanıcıda otomatik olarak şube seçimine devam edilir.
/// Şube seçiminin bir üst adımıdır; kurum seçilince şube seçimi o kuruma göre yapılır.
class TenantSelectPage extends StatefulWidget {
  const TenantSelectPage({super.key});

  @override
  State<TenantSelectPage> createState() => _TenantSelectPageState();
}

class _TenantSelectPageState extends State<TenantSelectPage> {
  bool _loading = true;
  bool _canManageScopes = false;
  List<Map<String, dynamic>> _tenants = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    await TenantScopeStore.instance.ensureLoaded();
    if (TenantScopeStore.instance.isSelected) {
      _toBranch();
      return;
    }
    Map<String, dynamic>? scope;
    try {
      scope = await AdminWorkflowApiService.instance.getMyScope();
    } catch (_) {}
    final canSwitch = scope?['canSwitchTenant'] == true;
    final tenants = ((scope?['tenants'] as List<dynamic>?) ?? const [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    if (!canSwitch || tenants.length <= 1) {
      // Tek kurum: bağlam ev kurumu kalır (header gönderilmez), şubeye geç.
      await TenantScopeStore.instance.select(null);
      _toBranch();
      return;
    }
    if (!mounted) return;
    setState(() {
      _tenants = tenants;
      _canManageScopes = scope?['canManageScopes'] == true;
      _loading = false;
    });
  }

  Future<void> _choose(Map<String, dynamic> tenant) async {
    await TenantScopeStore.instance.select(tenant['id']?.toString());
    await BranchScopeStore.instance.clear(); // kurum değişti → şube seçimi sıfırlanır
    _toBranch();
  }

  void _toBranch() {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const BranchSelectPage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text('Kurum Seçin'.tr)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Yönetmek istediğiniz kurumu seçin'.tr,
            style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 4),
          Text(
            'Tüm ekranlar seçtiğiniz kuruma göre görüntülenir.'.tr,
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: 16),
          // Tüm kurumların toplamı — konsolide görünüm.
          Card(
            color: Theme.of(context).colorScheme.primaryContainer,
            margin: const EdgeInsets.only(bottom: 12),
            child: ListTile(
              leading: const CircleAvatar(child: Icon(Icons.bar_chart_rounded)),
              title: Text(
                'Konsolide Görünüm'.tr,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              subtitle: Text('Tüm kurumların toplamı'.tr),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ConsolidatedOverviewPage()),
              ),
            ),
          ),
          // Kapsam yönetimi — platform admin veya delege yönetici (grup + yetki atama).
          if (_canManageScopes)
            Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                leading: const CircleAvatar(child: Icon(Icons.hub_outlined)),
                title: Text(
                  'Kapsam Yönetimi'.tr,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text('Grup hiyerarşisi + yetki atama'.tr),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const ScopeManagementPage()),
                ),
              ),
            ),
          ..._tenants.map(
            (tenant) => Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                leading: const CircleAvatar(child: Icon(Icons.business_outlined)),
                title: Text(
                  '${tenant['name'] ?? 'Kurum'}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                subtitle: Text('${((tenant['branches'] as List?) ?? const []).length} şube'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => _choose(tenant),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
