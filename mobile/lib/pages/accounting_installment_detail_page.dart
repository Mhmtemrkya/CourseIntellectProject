import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../widgets/accounting_ui.dart';
import '../widgets/app_header.dart';

class AccountingInstallmentDetailPage extends StatelessWidget {
  final String student;

  const AccountingInstallmentDetailPage({
    super.key,
    required this.student,
  });

  @override
  Widget build(BuildContext context) {
    final store = AccountingFinanceStore.instance;
    final records = store.installments.where((item) => item.student == student).toList();
    final summary = _studentSummary(store, student, records);

    return AccountingScaffold(
      appBar: const AppHeader(title: 'Taksit Detayı'),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: summary.className,
            title: student,
            description: 'Öğrencinin taksit planı, ödeme dengesi ve dönem içi taksit hareketleri bu ekranda izlenir.',
            colors: const [Color(0xFF0F172A), Color(0xFF7C3AED)],
            metrics: [
              AccountingHeroMetric(label: 'Toplam Plan', value: summary.total),
              AccountingHeroMetric(label: 'Kalan', value: summary.remaining),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _metricCard(
                  context,
                  title: 'Ödenen',
                  value: summary.paid,
                  color: const Color(0xFF0F766E),
                  icon: Icons.check_circle_outline_rounded,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _metricCard(
                  context,
                  title: 'Geciken',
                  value: summary.overdue,
                  color: const Color(0xFFB42318),
                  icon: Icons.warning_amber_rounded,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _metricCard(
                  context,
                  title: 'Tamamlanan',
                  value: '${records.where((item) => item.status == 'Alınan').length} taksit',
                  color: const Color(0xFF2563EB),
                  icon: Icons.task_alt_rounded,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _metricCard(
                  context,
                  title: 'Bekleyen',
                  value: '${records.where((item) => item.status == 'Bekleyen' || item.status == 'Sonraki Ay').length} taksit',
                  color: const Color(0xFFB45309),
                  icon: Icons.pending_actions_rounded,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          AccountingPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(child: AccountingSectionTitle(title: 'Plan Özeti')),
                    OutlinedButton.icon(
                      onPressed: records.isEmpty ? null : () => _openEditSheet(context, store, records.first),
                      icon: const Icon(Icons.edit_outlined),
                      label: const Text('Taksidi Duzenle'),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                _detailRow(context, 'Öğrenci', student),
                _detailRow(context, 'Sınıf', summary.className),
                _detailRow(context, 'Toplam Ücret', summary.total),
                _detailRow(context, 'Ödenen Toplam', summary.paid),
                _detailRow(context, 'Kalan Bakiye', summary.remaining),
                _detailRow(context, 'Geciken Tutar', summary.overdue),
              ],
            ),
          ),
          const SizedBox(height: 14),
          AccountingPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AccountingSectionTitle(title: 'Taksit Hareketleri'),
                const SizedBox(height: 14),
                ...records.map((record) => _installmentRow(context, record)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _metricCard(
    BuildContext context, {
    required String title,
    required String value,
    required Color color,
    required IconData icon,
  }) {
    return AccountingPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: color),
          ),
          const SizedBox(height: 12),
          Text(title, style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(value, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }

  Widget _detailRow(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }

  Widget _installmentRow(BuildContext context, InstallmentRecord record) {
    final color = switch (record.status) {
      'Alınan' => const Color(0xFF0F766E),
      'Geciken' => const Color(0xFFB42318),
      'Sonraki Ay' => const Color(0xFF7C3AED),
      _ => const Color(0xFFB45309),
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(Icons.calendar_month_outlined, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(record.amount, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w900)),
                const SizedBox(height: 4),
                Text('${record.status} • ${record.due}', style: Theme.of(context).textTheme.bodySmall),
                if (record.note.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(record.note, style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.35)),
                ],
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              AccountingAccentBadge(label: record.status, color: color),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => _openEditSheet(context, AccountingFinanceStore.instance, record),
                child: const Text('Duzenle'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _openEditSheet(
    BuildContext context,
    AccountingFinanceStore store,
    InstallmentRecord record,
  ) async {
    final amountController = TextEditingController(text: record.amount);
    final dueController = TextEditingController(text: record.due);
    final noteController = TextEditingController(text: record.note);
    var status = record.status;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 8,
            bottom: MediaQuery.of(context).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: amountController,
                decoration: const InputDecoration(labelText: 'Tutar', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: dueController,
                decoration: const InputDecoration(labelText: 'Vade', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: status,
                decoration: const InputDecoration(labelText: 'Durum', border: OutlineInputBorder()),
                items: const ['Bekleyen', 'Alınan', 'Geciken', 'Sonraki Ay']
                    .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                    .toList(),
                onChanged: (value) => status = value ?? status,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: noteController,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Not', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    store.updateInstallment(
                      id: record.id,
                      amount: amountController.text.trim(),
                      due: dueController.text.trim(),
                      status: status,
                      note: noteController.text.trim(),
                    );
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Taksit plani guncellendi.'),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  },
                  child: const Text('Kaydet'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  _StudentInstallmentSummary _studentSummary(
    AccountingFinanceStore store,
    String student,
    List<InstallmentRecord> records,
  ) {
    final className = store.collections
            .where((item) => item.name == student)
            .map((item) => item.className)
            .firstOrNull ??
        'Genel';
    final planned = records.fold<int>(0, (sum, item) => sum + store.parseAmount(item.amount));
    final paid = records
        .where((item) => item.status == 'Alınan')
        .fold<int>(0, (sum, item) => sum + store.parseAmount(item.amount));
    final overdue = records
        .where((item) => item.status == 'Geciken')
        .fold<int>(0, (sum, item) => sum + store.parseAmount(item.amount));
    final remaining = planned - paid;

    return _StudentInstallmentSummary(
      className: className,
      total: store.formatAmount(planned),
      paid: store.formatAmount(paid),
      remaining: store.formatAmount(remaining < 0 ? 0 : remaining),
      overdue: store.formatAmount(overdue),
    );
  }
}

class _StudentInstallmentSummary {
  final String className;
  final String total;
  final String paid;
  final String remaining;
  final String overdue;

  const _StudentInstallmentSummary({
    required this.className,
    required this.total,
    required this.paid,
    required this.remaining,
    required this.overdue,
  });
}
