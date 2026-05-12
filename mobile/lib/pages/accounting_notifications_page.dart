import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../widgets/accounting_ui.dart';
import '../widgets/app_header.dart';

class AccountingNotificationsPage extends StatefulWidget {
  const AccountingNotificationsPage({super.key});

  @override
  State<AccountingNotificationsPage> createState() =>
      _AccountingNotificationsPageState();
}

class _AccountingNotificationsPageState
    extends State<AccountingNotificationsPage> {
  final _store = AccountingFinanceStore.instance;

  @override
  void initState() {
    super.initState();
    _store.addListener(_refresh);
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
    final unreadCount = _store.notifications
        .where((item) => item.unread)
        .length;

    return AccountingScaffold(
      appBar: const AppHeader(title: 'Finans Bildirimleri'),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: 'Bildirim merkezi',
            title: 'Tahsilat, onay ve riskli bakiye bildirimleri tek listede.',
            description:
                'Muhasebe ekibi için kritik olaylar okunma durumu ile birlikte izlenir.',
            colors: const [Color(0xFF0F172A), Color(0xFF14532D)],
            metrics: [
              AccountingHeroMetric(
                label: 'Toplam',
                value: '${_store.notifications.length}',
              ),
              AccountingHeroMetric(label: 'Okunmamış', value: '$unreadCount'),
            ],
          ),
          const SizedBox(height: 16),
          AccountingSectionTitle(
            title: 'Son Bildirimler',
            actionLabel: 'Tümünü Okundu Yap',
            onAction: () => _store.markAllNotificationsRead(),
          ),
          const SizedBox(height: 12),
          ..._store.notifications.map(
            (item) => AccountingPanel(
              margin: const EdgeInsets.only(bottom: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: (item.unread
                          ? const Color(0xFFDCFCE7)
                          : const Color(0xFFE5E7EB)),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      item.unread
                          ? Icons.notifications_active_outlined
                          : Icons.notifications_none_outlined,
                    ),
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
                        const SizedBox(height: 6),
                        Text(
                          item.message,
                          style: Theme.of(
                            context,
                          ).textTheme.bodySmall?.copyWith(height: 1.4),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          item.time,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ],
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
