import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../widgets/accounting_ui.dart';

class AccountingReceiptArchivePage extends StatelessWidget {
  const AccountingReceiptArchivePage({super.key});

  @override
  Widget build(BuildContext context) {
    final store = AccountingFinanceStore.instance;
    final items = [...store.collections]
      ..sort((a, b) => b.time.compareTo(a.time));

    return AccountingScaffold(
      appBar: AppBar(
        title: const Text(
          'Makbuz Arşivi',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: 'Belge arşivi',
            title:
                'Canlı tahsilat kayıtlarından üretilen makbuzlar burada listelenir.',
            description:
                'Her satır son tahsilat zamanı, öğrenci ve ödeme yöntemiyle birlikte tutulur.',
            colors: const [Color(0xFF0F172A), Color(0xFF7C3AED)],
            metrics: [
              AccountingHeroMetric(label: 'Makbuz', value: '${items.length}'),
              AccountingHeroMetric(label: 'Kaynak', value: 'Canlı tahsilat'),
            ],
          ),
          const SizedBox(height: 16),
          if (items.isEmpty)
            const AccountingPanel(
              child: Text('Henüz makbuz arşivine düşen tahsilat bulunmuyor.'),
            )
          else
            ...items.map(
              (item) => AccountingPanel(
                margin: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'REC-${item.id.isEmpty ? item.time.hashCode.abs() : item.id.substring(0, 8).toUpperCase()}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      item.name,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${item.className} • ${item.method}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${item.amount} • ${item.time}',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
