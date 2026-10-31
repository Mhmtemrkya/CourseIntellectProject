import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
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
  // Personel süzgeci: boş = herkes.
  String _actor = '';

  String _timeLabel(AuditLogRecord item) {
    final at = item.createdAtUtc?.toLocal();
    if (at == null || at.year < 2000) return item.time;
    String two(int value) => value.toString().padLeft(2, '0');
    return '${two(at.day)}.${two(at.month)}.${at.year} ${two(at.hour)}:${two(at.minute)}';
  }

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
    final actors = _store.auditLogs
        .map((item) => item.actorName)
        .where((name) => name.isNotEmpty)
        .toSet()
        .toList()
      ..sort();
    final logs = _actor.isEmpty
        ? _store.auditLogs
        : _store.auditLogs.where((item) => item.actorName == _actor).toList();
    return AccountingScaffold(
      appBar: AppHeader(title: 'İşlem Kayıtları'.tr),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: 'Audit log',
            title:
                'Muhasebe modülünde yapılan finans işlemleri kronolojik olarak kaydedilir.'.tr,
            description:
                'Kimin neyi ne zaman tetiklediğini görmek için bu kayıtlar kullanılır.',
            colors: const [Color(0xFF0F172A), Color(0xFF4F46E5)],
            metrics: [
              AccountingHeroMetric(
                label: 'Kayıt'.tr,
                value: '${_store.auditLogs.length}',
              ),
              AccountingHeroMetric(
                label: 'Son',
                value: _store.auditLogs.isEmpty ? '-' : _timeLabel(_store.auditLogs.first),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (actors.isNotEmpty)
            DropdownButtonFormField<String>(
              initialValue: _actor,
              decoration: const InputDecoration(labelText: 'İşlem yapan'),
              items: [
                const DropdownMenuItem(value: '', child: Text('Tüm personel')),
                ...actors.map((name) => DropdownMenuItem(value: name, child: Text(name))),
              ],
              onChanged: (value) => setState(() => _actor = value ?? ''),
            ),
          const SizedBox(height: 12),
          ...logs.map(
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
                          item.actorName.isEmpty
                              ? _timeLabel(item)
                              : '${_timeLabel(item)} • ${item.actorName}',
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
