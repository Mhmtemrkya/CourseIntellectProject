import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/admin_workflow_api_service.dart';
import '../services/branch_scope_store.dart';
import '../services/tenant_scope_store.dart';
import 'branch_select_page.dart';

/// Konsolide görünüm: kurum sahibi/MEB'in erişebildiği tüm kurumların özet metrikleri
/// + genel toplam. Bir kuruma dokununca o kuruma drill-down yapılır (bağlam ayarlanır).
class ConsolidatedOverviewPage extends StatefulWidget {
  const ConsolidatedOverviewPage({super.key});

  @override
  State<ConsolidatedOverviewPage> createState() => _ConsolidatedOverviewPageState();
}

class _ConsolidatedOverviewPageState extends State<ConsolidatedOverviewPage> {
  bool _loading = true;
  Map<String, dynamic>? _data;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    Map<String, dynamic>? data;
    try {
      data = await AdminWorkflowApiService.instance.getMyScopeRollup();
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _data = data;
      _loading = false;
    });
  }

  Future<void> _openTenant(String tenantId) async {
    await TenantScopeStore.instance.select(tenantId);
    await BranchScopeStore.instance.clear();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const BranchSelectPage()),
    );
  }

  static String _num(dynamic value) {
    final n = (value is num) ? value.toInt() : int.tryParse('$value') ?? 0;
    final s = n.abs().toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write('.');
      buf.write(s[i]);
    }
    return (n < 0 ? '-' : '') + buf.toString();
  }

  static String _money(dynamic value) => '₺${_num(value)}';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final totals = (_data?['totals'] as Map?) ?? const {};
    final tenants = ((_data?['tenants'] as List<dynamic>?) ?? const [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    final readOnly = _data?['readOnly'] == true;

    return Scaffold(
      appBar: AppBar(
        title: Text('Konsolide Görünüm'.tr),
        actions: [
          if (readOnly)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Chip(
                avatar: const Icon(Icons.lock_outline, size: 16),
                label: Text('Salt-okunur'.tr),
              ),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  '${_num(_data?['tenantCount'])} ${'kurumun toplamı'.tr}',
                  style: theme.textTheme.bodyMedium?.copyWith(color: theme.hintColor),
                ),
                const SizedBox(height: 12),
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  childAspectRatio: 2.4,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  children: [
                    _tile(theme, 'Öğrenci'.tr, _num(totals['students']), Icons.school_outlined),
                    _tile(theme, 'Personel'.tr, _num(totals['staff']), Icons.badge_outlined),
                    _tile(theme, 'Şube'.tr, _num(totals['branches']), Icons.apartment_outlined),
                    _tile(theme, 'Tahsilat'.tr, _money(totals['collected']), Icons.payments_outlined),
                  ],
                ),
                const SizedBox(height: 20),
                Text(
                  'Kurum Karşılaştırması'.tr,
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 8),
                ...tenants.map(
                  (t) => Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: ListTile(
                      leading: const CircleAvatar(child: Icon(Icons.business_outlined)),
                      title: Text(
                        '${t['name'] ?? 'Kurum'}',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: Text(
                        '${_num(t['students'])} ${'öğrenci'.tr} • ${_num(t['staff'])} ${'personel'.tr} • ${_num(t['branches'])} ${'şube'.tr}',
                      ),
                      trailing: const Icon(Icons.chevron_right_rounded),
                      onTap: () => _openTenant(t['id']?.toString() ?? ''),
                    ),
                  ),
                ),
                if (tenants.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40),
                    child: Center(child: Text('Görüntülenecek kurum yok.'.tr)),
                  ),
              ],
            ),
    );
  }

  Widget _tile(ThemeData theme, String label, String value, IconData icon) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(
          children: [
            Icon(icon, color: theme.hintColor, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(value, style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
                  Text(label, style: theme.textTheme.bodySmall?.copyWith(color: theme.hintColor)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
