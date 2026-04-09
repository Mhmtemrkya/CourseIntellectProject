import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../widgets/accounting_ui.dart';
import '../widgets/app_header.dart';

class AccountingApprovalDetailPage extends StatelessWidget {
  final ApprovalRecord approval;

  const AccountingApprovalDetailPage({
    super.key,
    required this.approval,
  });

  @override
  Widget build(BuildContext context) {
    final current = AccountingFinanceStore.instance.approvals
        .where((item) => item.id == approval.id || item.title == approval.title)
        .firstOrNull ?? approval;

    final color = current.status == 'Onaylandı'
        ? const Color(0xFF0F766E)
        : current.status == 'Reddedildi'
            ? const Color(0xFFB42318)
            : const Color(0xFFB45309);

    return AccountingScaffold(
      appBar: const AppHeader(title: 'Onay Detayı'),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: current.category,
            title: current.title,
            description: 'Onay gerekçesi, kaynak kaydı ve güncel karar akışı burada yer alır.',
            colors: [const Color(0xFF0F172A), color],
            metrics: [
              AccountingHeroMetric(label: 'Durum', value: current.status),
              AccountingHeroMetric(label: 'Kaynak', value: current.sourceType),
            ],
          ),
          const SizedBox(height: 16),
          AccountingPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AccountingSectionTitle(title: 'Talep Detayı'),
                const SizedBox(height: 14),
                Text(current.reason, style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.5)),
                const SizedBox(height: 16),
                AccountingAccentBadge(label: current.status, color: color),
              ],
            ),
          ),
          const SizedBox(height: 14),
          AccountingPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AccountingSectionTitle(title: 'Onay Çerçevesi'),
                const SizedBox(height: 14),
                _line(context, 'Kategori', current.category),
                _line(context, 'Kaynak Tipi', current.sourceType),
                _line(context, 'Kaynak Anahtar', current.sourceKey),
                _line(context, 'Durum', current.status),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _line(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          SizedBox(width: 120, child: Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700))),
          const SizedBox(width: 12),
          Expanded(child: Text(value, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800))),
        ],
      ),
    );
  }
}
