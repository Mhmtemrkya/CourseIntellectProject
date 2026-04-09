import 'package:flutter/material.dart';

import '../services/accounting_api_service.dart';
import '../services/accounting_finance_store.dart';
import '../widgets/accounting_ui.dart';

class AccountingBulkActionsPage extends StatelessWidget {
  const AccountingBulkActionsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final store = AccountingFinanceStore.instance;
    final overdue = store.installments.where((item) => item.status == 'Geciken').toList();

    return AccountingScaffold(
      appBar: AppBar(title: const Text('Toplu Tahsilat ve Mesaj', style: TextStyle(fontWeight: FontWeight.bold))),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: 'Toplu işlem merkezi',
            title: 'Aynı akışta tahsilat planı ve hatırlatma adımlarını yönetin.',
            description: 'Geciken planlar için toplu hatırlatma ve özet kontrol bu ekranda yapılır.',
            colors: const [Color(0xFF0F172A), Color(0xFF14532D)],
            metrics: [
              AccountingHeroMetric(label: 'Geciken', value: '${overdue.length} kayıt'),
              AccountingHeroMetric(label: 'Tahsilat', value: store.formatAmount(store.collectedTotal)),
            ],
          ),
          const SizedBox(height: 16),
          AccountingPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FilledButton.tonalIcon(
                  onPressed: () {
                    for (final item in overdue) {
                      store.addFinanceNotification(
                        title: '${item.student} icin toplu tahsilat kaydi',
                        message: '${item.amount} tutarli geciken plan toplu tahsilat listesine alindi.',
                      );
                    }
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('${overdue.length} geciken plan için toplu tahsilat listesi hazırlandı.'),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  },
                  icon: const Icon(Icons.payments_outlined),
                  label: const Text('Toplu Tahsilat Baslat'),
                ),
                const SizedBox(height: 10),
                FilledButton.tonalIcon(
                  onPressed: overdue.isEmpty
                      ? null
                      : () async {
                          try {
                            final payload = await AccountingApiService.instance.sendBulkReminders();
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  payload['message']?.toString() ??
                                      '${overdue.length} veliye canlı hatırlatma gönderildi.',
                                ),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          } catch (error) {
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(error.toString()),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                          }
                        },
                  icon: const Icon(Icons.sms_outlined),
                  label: const Text('Toplu Hatirlatma Gonder'),
                ),
                const SizedBox(height: 16),
                ...overdue.take(5).map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: AccountingPanel(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        children: [
                          const Icon(Icons.warning_amber_rounded, color: Color(0xFFB42318)),
                          const SizedBox(width: 10),
                          Expanded(child: Text('${item.student} • ${item.amount} • ${item.due}')),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
