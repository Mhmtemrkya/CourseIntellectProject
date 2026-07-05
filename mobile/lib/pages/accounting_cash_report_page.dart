import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/accounting_finance_store.dart';
import '../widgets/accounting_ui.dart';

class AccountingCashReportPage extends StatefulWidget {
  const AccountingCashReportPage({super.key});

  @override
  State<AccountingCashReportPage> createState() =>
      _AccountingCashReportPageState();
}

class _AccountingCashReportPageState extends State<AccountingCashReportPage> {
  final _store = AccountingFinanceStore.instance;

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
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final collections = _store.collections;
    bool isCash(String m) => m.contains('nakit');
    bool isCard(String m) =>
        m.contains('kart') || m.contains('card') || m.contains('pos');
    bool isBank(String m) =>
        m.contains('havale') ||
        m.contains('eft') ||
        m.contains('bank') ||
        m.contains('banka') ||
        m.contains('transfer');
    final cashTotal = collections
        .where((item) => isCash(item.method.toLowerCase()))
        .fold<int>(0, (sum, item) => sum + _store.parseAmount(item.amount));
    final cardTotal = collections
        .where((item) => isCard(item.method.toLowerCase()))
        .fold<int>(0, (sum, item) => sum + _store.parseAmount(item.amount));
    final bankTotal = collections
        .where((item) => isBank(item.method.toLowerCase()))
        .fold<int>(0, (sum, item) => sum + _store.parseAmount(item.amount));
    // Nakit/Kart/Havale dışı yöntemler (çek, senet, diğer, belirtilmemiş) —
    // aksi halde Toplam eksik çıkar ve yüzdeler gerçek toplamı yansıtmaz.
    final otherTotal = collections.where((item) {
      final m = item.method.toLowerCase();
      return !isCash(m) && !isCard(m) && !isBank(m);
    }).fold<int>(0, (sum, item) => sum + _store.parseAmount(item.amount));
    final grandTotal = cashTotal + cardTotal + bankTotal + otherTotal;

    return AccountingScaffold(
      appBar: AppBar(
        title: Text(
          'Kasa ve Ödeme Dağılımı'.tr,
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: 'Kasa görünümü',
            title:
                'Nakit, kart ve havale tahsilatlarını canlı dağılımla izleyin.'.tr,
            description:
                'Bu ekran artık doğrudan tahsilat kayıtlarını okuyup ödeme yöntemi kırılımını gösterir.',
            colors: const [Color(0xFF0F172A), Color(0xFF0EA5E9)],
            metrics: [
              AccountingHeroMetric(
                label: 'Toplam',
                value: _store.formatAmount(grandTotal),
              ),
              AccountingHeroMetric(
                label: 'İşlem'.tr,
                value: '${collections.length}',
              ),
            ],
          ),
          const SizedBox(height: 16),
          AccountingPanel(
            child: Column(
              children: [
                _metricRow(
                  'Nakit',
                  cashTotal,
                  grandTotal,
                  const Color(0xFF15803D),
                ),
                const SizedBox(height: 12),
                _metricRow(
                  'Kart',
                  cardTotal,
                  grandTotal,
                  const Color(0xFF2563EB),
                ),
                const SizedBox(height: 12),
                _metricRow(
                  'Havale/EFT',
                  bankTotal,
                  grandTotal,
                  const Color(0xFF7C3AED),
                ),
                if (otherTotal > 0) ...[
                  const SizedBox(height: 12),
                  _metricRow(
                    'Diğer',
                    otherTotal,
                    grandTotal,
                    const Color(0xFF64748B),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          ...collections
              .take(20)
              .map(
                (item) => AccountingPanel(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      const CircleAvatar(
                        child: Icon(Icons.account_balance_wallet_outlined),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.name,
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${item.className} • ${item.method}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            item.amount,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            item.time,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
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

  Widget _metricRow(String label, int amount, int grandTotal, Color color) {
    final percent = grandTotal == 0 ? 0 : ((amount / grandTotal) * 100).round();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w800)),
            const Spacer(),
            Text('${_store.formatAmount(amount)} • %$percent'),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: grandTotal == 0 ? 0 : amount / grandTotal,
            minHeight: 10,
            color: color,
            backgroundColor: color.withValues(alpha: 0.12),
          ),
        ),
      ],
    );
  }
}
