import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import 'accounting_salary_detail_page.dart';
import 'accounting_salary_form_page.dart';
import '../widgets/app_header.dart';
import '../widgets/accounting_ui.dart';

class AccountingSalaryPage extends StatefulWidget {
  const AccountingSalaryPage({super.key});

  @override
  State<AccountingSalaryPage> createState() => _AccountingSalaryPageState();
}

class _AccountingSalaryPageState extends State<AccountingSalaryPage> {
  final AccountingFinanceStore _store = AccountingFinanceStore.instance;

  @override
  void initState() {
    super.initState();
    _store.addListener(_refresh);
    if (!_store.isLoaded) {
      _store.loadDashboard();
    }
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
    return AccountingScaffold(
      appBar: const AppHeader(title: 'Maaş Ödemeleri'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateSalary,
        backgroundColor: const Color(0xFF0F172A),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.badge_outlined),
        label: const Text('Yeni Bordro'),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: 'Bordro görünümü',
            title:
                'Personel maaş, planlanan ödeme ve onay bekleyen bordroları izleyin.',
            description:
                'Öğretmen ve idari kadro ödemeleri aynı modülde toplanır.',
            colors: const [Color(0xFF0F172A), Color(0xFF1D4ED8)],
            metrics: [
              AccountingHeroMetric(
                label: 'Bu Ay Bordro',
                value:
                    '₺${_store.salaries.fold<int>(0, (sum, item) => sum + _parseAmount(item.amount)).toString()}',
              ),
              AccountingHeroMetric(
                label: 'Bekleyen',
                value:
                    '${_store.salaries.where((item) => _store.approvalStatusFor('Salary', item.id) == 'Bekliyor').length} ödeme',
              ),
            ],
          ),
          const SizedBox(height: 16),
          ..._store.salaries.map(
            (salary) => InkWell(
              borderRadius: BorderRadius.circular(24),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => AccountingSalaryDetailPage(salary: salary),
                ),
              ),
              child: AccountingPanel(
                margin: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: const Color(
                        0xFF0F766E,
                      ).withValues(alpha: 0.12),
                      child: const Icon(
                        Icons.badge_outlined,
                        color: Color(0xFF0F766E),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            salary.employee,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${salary.role} • ${salary.payDate}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          const SizedBox(height: 8),
                          AccountingAccentBadge(
                            label: salary.status,
                            color: _statusColor(salary.status),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          salary.amount,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 4),
                        Icon(
                          Icons.chevron_right_rounded,
                          color: _statusColor(salary.status),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openCreateSalary() async {
    final result = await Navigator.push<Map<String, String>>(
      context,
      MaterialPageRoute(builder: (_) => const AccountingSalaryFormPage()),
    );

    if (!mounted || result == null) {
      return;
    }

    try {
      await _store.addSalary(
        employee: result['employee']!,
        role: result['role']!,
        amount: result['amount']!,
        payDate: result['payDate']!,
        reason: result['reason']!,
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Yeni bordro oluşturuldu ve onaya gönderildi.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  int _parseAmount(String amount) {
    final normalized = amount
        .replaceAll('₺', '')
        .replaceAll('.', '')
        .replaceAll(',', '')
        .trim();
    return int.tryParse(normalized) ?? 0;
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'Ödendi':
        return const Color(0xFF0F766E);
      case 'Planlandı':
        return const Color(0xFF2563EB);
      case 'Reddedildi':
        return const Color(0xFFB91C1C);
      default:
        return const Color(0xFFB45309);
    }
  }
}
