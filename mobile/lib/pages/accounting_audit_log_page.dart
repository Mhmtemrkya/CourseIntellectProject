import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../widgets/accounting_ui.dart';
import '../widgets/app_header.dart';

class AccountingAuditLogPage extends StatefulWidget {
  const AccountingAuditLogPage({super.key});

  @override
  State<AccountingAuditLogPage> createState() => _AccountingAuditLogPageState();
}

class _AccountingAuditLogPageState extends State<AccountingAuditLogPage> {
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
    return AccountingScaffold(
      appBar: const AppHeader(title: 'İşlem Kayıtları'),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: 'Audit log',
            title:
                'Muhasebe modülünde yapılan finans işlemleri kronolojik olarak kaydedilir.',
            description:
                'Kimin neyi ne zaman tetiklediğini görmek için bu kayıtlar kullanılır.',
            colors: const [Color(0xFF0F172A), Color(0xFF4F46E5)],
            metrics: [
              AccountingHeroMetric(
                label: 'Kayıt',
                value: '${_store.auditLogs.length}',
              ),
              AccountingHeroMetric(
                label: 'Son',
                value: _store.auditLogs.firstOrNull?.time ?? '-',
              ),
            ],
          ),
          const SizedBox(height: 16),
          ..._store.auditLogs.map(
            (item) => AccountingPanel(
              margin: const EdgeInsets.only(bottom: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE0E7FF),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(
                      Icons.history_rounded,
                      color: Color(0xFF4F46E5),
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
                          item.detail,
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
