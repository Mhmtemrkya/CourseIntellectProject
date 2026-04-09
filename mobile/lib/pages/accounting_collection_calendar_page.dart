import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../widgets/accounting_ui.dart';

class AccountingCollectionCalendarPage extends StatefulWidget {
  const AccountingCollectionCalendarPage({super.key});

  @override
  State<AccountingCollectionCalendarPage> createState() =>
      _AccountingCollectionCalendarPageState();
}

class _AccountingCollectionCalendarPageState
    extends State<AccountingCollectionCalendarPage> {
  @override
  void initState() {
    super.initState();
    AccountingFinanceStore.instance.loadDashboard();
  }

  @override
  Widget build(BuildContext context) {
    final store = AccountingFinanceStore.instance;
    final items = [...store.collections]
      ..sort((a, b) => b.time.compareTo(a.time));

    return AccountingScaffold(
      appBar: AppBar(title: const Text('Tahsilat Takvimi', style: TextStyle(fontWeight: FontWeight.bold))),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const AccountingHeroCard(
            eyebrow: 'Tahsilat akisi',
            title: 'Son kaydedilen tahsilatlar tarih sirasi ile izlenir.',
            description: 'Odeme yontemi, sinif ve tutar bilgisi tek listede gorunur.',
            colors: [Color(0xFF0F172A), Color(0xFF0EA5E9)],
            metrics: [
              AccountingHeroMetric(label: 'Kayit', value: 'Canli'),
              AccountingHeroMetric(label: 'Kaynak', value: 'Muhasebe store'),
            ],
          ),
          const SizedBox(height: 16),
          if (items.isEmpty)
            const AccountingPanel(child: Text('Henuz kayitli tahsilat bulunmuyor.'))
          else
            ...items.map(
              (item) => AccountingPanel(
                margin: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    const CircleAvatar(child: Icon(Icons.calendar_month_rounded)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.name, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                          const SizedBox(height: 4),
                          Text('${item.className} • ${item.method}', style: Theme.of(context).textTheme.bodySmall),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(item.amount, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
                        const SizedBox(height: 4),
                        Text(item.time, style: Theme.of(context).textTheme.bodySmall),
                      ],
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
