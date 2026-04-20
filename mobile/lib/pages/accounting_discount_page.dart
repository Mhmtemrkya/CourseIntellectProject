import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../services/student_registry_store.dart';
import 'accounting_discount_form_page.dart';
import '../widgets/app_header.dart';
import '../widgets/accounting_ui.dart';

class AccountingDiscountPage extends StatefulWidget {
  const AccountingDiscountPage({super.key});

  @override
  State<AccountingDiscountPage> createState() => _AccountingDiscountPageState();
}

class _AccountingDiscountPageState extends State<AccountingDiscountPage> {
  final StudentRegistryStore _studentStore = StudentRegistryStore.instance;
  final AccountingFinanceStore _financeStore = AccountingFinanceStore.instance;
  String _filter = 'Tümü';

  @override
  void initState() {
    super.initState();
    _studentStore.addListener(_refresh);
    _financeStore.addListener(_refresh);
    _studentStore.ensureLoaded();
    if (!_financeStore.isLoaded) {
      _financeStore.loadDashboard();
    }
  }

  @override
  void dispose() {
    _studentStore.removeListener(_refresh);
    _financeStore.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final records = _buildRecords();
    final filtered = records
        .where(
          (record) =>
              _filter == 'Tümü' ||
              record['status'] == _filter ||
              record['type'] == _filter,
        )
        .toList();
    final activeDiscount = records
        .where((item) => item['type'] == 'İndirim' && item['status'] == 'Aktif')
        .length;
    final activeScholarship = records
        .where((item) => item['type'] == 'Burs' && item['status'] == 'Aktif')
        .length;
    final beneficiaries = records.length;
    final totalEstimated = records.fold<int>(0, (sum, item) {
      final rate = int.tryParse((item['rate'] ?? '').replaceAll('%', '')) ?? 0;
      final balance = _financeStore.parseAmount(item['balance'] ?? '');
      return sum + ((balance * rate) ~/ 100);
    });

    return AccountingScaffold(
      appBar: const AppHeader(title: 'İndirim ve Burs'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openNewDiscountPage,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Yeni İndirim'),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: 'Burs ve indirim merkezi',
            title:
                'Aktif tanımları, yararlanan öğrencileri ve onay bekleyen kayıtları yönetin.',
            description:
                'Bu görünüm artık öğrenci ve muhasebe kayıtlarından türetilen canlı finansal destek adaylarını gösterir.',
            colors: const [Color(0xFF0F172A), Color(0xFF0891B2)],
            metrics: [
              AccountingHeroMetric(
                label: 'Aktif Kayıt',
                value: '$activeDiscount',
              ),
              AccountingHeroMetric(
                label: 'Toplam Etki',
                value: _financeStore.formatAmount(totalEstimated),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _statsCard(
            context,
            activeDiscount,
            activeScholarship,
            beneficiaries,
            records.length,
          ),
          const SizedBox(height: 16),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children:
                  ['Tümü', 'Aktif', 'Pasif', 'Onay Bekliyor', 'İndirim', 'Burs']
                      .map(
                        (value) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: AccountingFilterChip(
                            label: value,
                            selected: _filter == value,
                            onTap: () => setState(() => _filter = value),
                          ),
                        ),
                      )
                      .toList(),
            ),
          ),
          const SizedBox(height: 16),
          ...filtered.map((record) => _recordCard(context, record)),
        ],
      ),
    );
  }

  Widget _statsCard(
    BuildContext context,
    int activeDiscount,
    int activeScholarship,
    int beneficiaries,
    int totalRecords,
  ) {
    return AccountingPanel(
      child: Row(
        children: [
          Expanded(child: _metric(context, 'Aktif İndirim', '$activeDiscount')),
          Expanded(child: _metric(context, 'Aktif Burs', '$activeScholarship')),
          Expanded(
            child: _metric(context, 'Yararlanan', '$beneficiaries öğrenci'),
          ),
          Expanded(
            child: _metric(context, 'Toplam Tanım', '$totalRecords kayıt'),
          ),
        ],
      ),
    );
  }

  Widget _metric(BuildContext context, String title, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 6),
        Text(
          value,
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w900),
        ),
      ],
    );
  }

  Widget _recordCard(BuildContext context, Map<String, String> record) {
    final color = record['type'] == 'Burs'
        ? const Color(0xFF7C3AED)
        : const Color(0xFF0891B2);
    return AccountingPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(Icons.workspace_premium_outlined, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  record['name']!,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  '${record['type']} • ${record['status']} • ${record['balance']}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          Text(
            record['rate']!,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openNewDiscountPage() async {
    final result = await Navigator.push<Map<String, String>>(
      context,
      MaterialPageRoute(builder: (_) => const AccountingDiscountFormPage()),
    );

    if (!mounted || result == null) return;

    await _financeStore.addBenefit(
      studentName: result['studentName'] ?? '',
      studentUsername: result['studentUsername'] ?? '',
      className: result['className'] ?? '',
      benefitType: result['type'] ?? 'İndirim',
      title: result['title'] ?? '',
      rate: result['rate'] ?? '0',
      totalAmount: result['totalAmount'] ?? '0',
      note: result['note'] ?? '',
    );
    setState(() => _filter = 'Tümü');

    await _financeStore.addFinanceNotification(
      title: '${result['type']} talebi oluşturuldu',
      message:
          '${result['studentName']} için ${result['rate']} oranlı kayıt finans incelemesine alındı.',
    );

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('İndirim / burs tanımı onay sürecine alındı.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  List<Map<String, String>> _buildRecords() {
    return _financeStore.benefits
        .map(
          (item) => <String, String>{
            'name': item.studentName,
            'type': item.benefitType,
            'rate': '%${item.rate}',
            'status': item.status,
            'balance': _financeStore.formatAmount(
              _financeStore.parseAmount(item.netAmount),
            ),
          },
        )
        .toList();
  }
}
