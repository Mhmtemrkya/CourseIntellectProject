import 'package:flutter/material.dart';

import 'admin_accounting_registration_page.dart';
import 'accounting_approvals_page.dart';
import 'accounting_exports_page.dart';
import 'accounting_home_page.dart';
import 'accounting_overdue_page.dart';
import 'accounting_receipts_page.dart';
import '../services/accounting_finance_store.dart';
import '../widgets/admin_ui.dart';

class AdminFinancePage extends StatefulWidget {
  const AdminFinancePage({super.key});

  @override
  State<AdminFinancePage> createState() => _AdminFinancePageState();
}

class _AdminFinancePageState extends State<AdminFinancePage> {
  final _store = AccountingFinanceStore.instance;

  @override
  void initState() {
    super.initState();
    _store.addListener(_refresh);
    _store.loadDashboard();
  }

  @override
  void dispose() {
    _store.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final financeRows = [
      (
        'Toplam Alacak',
        _store.formatAmount(_store.totalReceivables),
        const Color(0xFF14532D),
      ),
      (
        'Tahsil Edilen',
        _store.formatAmount(_store.collectedTotal),
        const Color(0xFF2563EB),
      ),
      (
        'Bekleyen',
        _store.formatAmount(_store.pendingTotal),
        const Color(0xFFB45309),
      ),
      (
        'Geciken',
        _store.formatAmount(_store.overdueTotal),
        const Color(0xFFB42318),
      ),
    ];

    final actions = [
      _AdminFinanceAction(
        'Tahsilatlar',
        'Güncel ödeme hareketleri',
        Icons.payments_outlined,
        const Color(0xFF14532D),
        const AccountingReceiptsPage(),
      ),
      _AdminFinanceAction(
        'Onaylar',
        'Finans ve indirim onaylari',
        Icons.verified_user_outlined,
        const Color(0xFF475569),
        const AccountingApprovalsPage(
          canApprove: true,
          pageTitle: 'Yönetici Onayları',
        ),
      ),
      _AdminFinanceAction(
        'Dışa Aktar',
        'PDF / Excel ciktilari',
        Icons.ios_share_outlined,
        const Color(0xFF4F46E5),
        const AccountingExportsPage(),
      ),
      _AdminFinanceAction(
        'Gecikenler',
        'Riskli ödeme listesi',
        Icons.warning_amber_rounded,
        const Color(0xFFB42318),
        const AccountingOverduePage(),
      ),
      _AdminFinanceAction(
        'Muhasebe Kaydı',
        'Sadece yönetiçi yeni muhasebe hesabı açar',
        Icons.person_add_alt_1_rounded,
        const Color(0xFF0F766E),
        const AdminAccountingRegistrationPage(),
      ),
    ];

    final riskCount = _store.installments
        .where((item) => item.status == 'Geciken')
        .length;

    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Finans Kontrolu',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Finans görünümü',
            title:
                'Tahsilat, onay ve riskli bakiye akışlarını yönetiçi perspektifiyle izleyin.',
            description:
                'Muhasebe modülundeki hareketler özetlenir ve kritik finans süreçleri doğrudan açılır.',
            metrics: [
              AdminHeroMetric(
                label: 'Nakit Sagligi',
                value: riskCount == 0 ? 'Dengede' : 'Izleme',
              ),
              AdminHeroMetric(label: 'Riskli Kayıt', value: '$riskCount'),
            ],
          ),
          const SizedBox(height: 16),
          ...financeRows.map(
            (item) => AdminPanel(
              margin: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: item.$3.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(Icons.monetization_on_outlined, color: item.$3),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      item.$1,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  Text(
                    item.$2,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: item.$3,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          const AdminSectionTitle(title: 'Finans Aksiyonlari'),
          const SizedBox(height: 12),
          ...actions.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: InkWell(
                borderRadius: BorderRadius.circular(22),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => item.page),
                ),
                child: AdminPanel(
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: item.color.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Icon(item.icon, color: item.color),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.title,
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.subtitle,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const AccountingHomePage()),
            ),
            icon: const Icon(Icons.open_in_new_rounded),
            label: const Text('Muhasebe Modulunu Ac'),
          ),
        ],
      ),
    );
  }
}

class _AdminFinanceAction {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final Widget page;

  _AdminFinanceAction(
    this.title,
    this.subtitle,
    this.icon,
    this.color,
    this.page,
  );
}
