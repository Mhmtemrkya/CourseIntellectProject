import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../widgets/accounting_ui.dart';

class AccountingReconciliationPage extends StatelessWidget {
  const AccountingReconciliationPage({super.key});

  @override
  Widget build(BuildContext context) {
    final store = AccountingFinanceStore.instance;
    final invoiceTotal = store.invoices.fold<int>(
      0,
      (sum, item) => sum + store.parseAmount(item.amount),
    );
    final collectionTotal = store.collections.fold<int>(
      0,
      (sum, item) => sum + store.parseAmount(item.amount),
    );
    final pendingGap = invoiceTotal - collectionTotal;
    final bankGap = pendingGap > 0 ? 'Fark var' : 'Eşleşme';
    final cardCollections = store.collections
        .where((item) => item.method.toLowerCase().contains('kart'))
        .length;
    final posGap = cardCollections > 0
        ? 'Canlı kayıt var'
        : 'Kart hareketi yok';
    final pendingApprovals = store.approvals
        .where((item) => item.status == 'Bekliyor')
        .length;
    final cashGap = pendingApprovals > 0
        ? 'Gün sonu onayı bekliyor'
        : 'Kapanış tamam';
    final items = [
      (
        'Banka Mutabakatı',
        bankGap,
        const Color(0xFFB45309),
        'Fatura toplamı ile tahsil edilen tutar canlı backend kayıtlarından karşılaştırılır.',
      ),
      (
        'POS Mutabakatı',
        posGap,
        const Color(0xFF0F766E),
        'Kart tahsilatları mevcut collection kayıtlarından okunur.',
      ),
      (
        'Kasa Sayımı',
        cashGap,
        const Color(0xFF2563EB),
        'Bekleyen muhasebe onayları kasa kapanış riskini gösterir.',
      ),
    ];

    return AccountingScaffold(
      appBar: AppBar(
        title: const Text(
          'Mutabakat Merkezi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: 'Canlı denetim',
            title:
                'Fatura, tahsilat ve onay kayıtlarıyla anlık mutabakat özeti.',
            description:
                'Bu ekran artık sabit senaryo yerine muhasebe dashboard verisini kullanır.',
            colors: const [Color(0xFF0F172A), Color(0xFF2563EB)],
            metrics: [
              AccountingHeroMetric(
                label: 'Fatura',
                value: store.formatAmount(invoiceTotal),
              ),
              AccountingHeroMetric(
                label: 'Tahsilat',
                value: store.formatAmount(collectionTotal),
              ),
            ],
          ),
          const SizedBox(height: 16),
          AccountingPanel(
            margin: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                Expanded(
                  child: _summary(
                    context,
                    'Açık Fark',
                    store.formatAmount(pendingGap > 0 ? pendingGap : 0),
                  ),
                ),
                Expanded(
                  child: _summary(
                    context,
                    'Kart İşlemi',
                    '$cardCollections kayıt',
                  ),
                ),
                Expanded(
                  child: _summary(
                    context,
                    'Bekleyen Onay',
                    '$pendingApprovals',
                  ),
                ),
              ],
            ),
          ),
          ...items.map(
            (item) => AccountingPanel(
              margin: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          item.$1,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                      AccountingAccentBadge(label: item.$2, color: item.$3),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(item.$4),
                  const SizedBox(height: 12),
                  FilledButton.tonalIcon(
                    onPressed: () {
                      store.addFinanceNotification(
                        title: '${item.$1} raporu hazırlandı',
                        message:
                            '${item.$1} için mutabakat özeti oluşturuldu. Durum: ${item.$2}.',
                      );
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('${item.$1} detayı oluşturuldu.'),
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    },
                    icon: const Icon(Icons.assignment_turned_in_outlined),
                    label: const Text('Mutabakat Kaydını Oluştur'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _summary(BuildContext context, String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 6),
        Text(
          value,
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
        ),
      ],
    );
  }
}
