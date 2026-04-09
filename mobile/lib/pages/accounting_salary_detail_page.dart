import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../widgets/accounting_ui.dart';
import '../widgets/app_header.dart';

class AccountingSalaryDetailPage extends StatelessWidget {
  final SalaryRecord salary;

  const AccountingSalaryDetailPage({
    super.key,
    required this.salary,
  });

  @override
  Widget build(BuildContext context) {
    final current = AccountingFinanceStore.instance.salaries
        .where((item) => item.id == salary.id || item.employee == salary.employee)
        .firstOrNull ?? salary;

    return AccountingScaffold(
      appBar: const AppHeader(title: 'Bordro Detayı'),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: current.role,
            title: current.employee,
            description: 'Bordro tutarı, ödeme tarihi ve onay ilerlemesi bu ekranda izlenir.',
            colors: const [Color(0xFF0F172A), Color(0xFF0F766E)],
            metrics: [
              AccountingHeroMetric(label: 'Tutar', value: current.amount),
              AccountingHeroMetric(label: 'Durum', value: current.status),
            ],
          ),
          const SizedBox(height: 16),
          AccountingPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AccountingSectionTitle(title: 'Bordro Özeti'),
                const SizedBox(height: 14),
                _row(context, 'Personel', current.employee),
                _row(context, 'Pozisyon', current.role),
                _row(context, 'Ödeme Tarihi', current.payDate),
                _row(context, 'Bordro Tutarı', current.amount),
                _row(context, 'Durum', current.status),
              ],
            ),
          ),
          const SizedBox(height: 14),
          AccountingPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AccountingSectionTitle(title: 'İşlem Adımları'),
                const SizedBox(height: 14),
                _step(context, const Color(0xFF0F766E), 'Bordro hazırlandı', 'Ödeme planı muhasebe birimi tarafından oluşturuldu.'),
                _step(context, const Color(0xFF2563EB), 'Onay takibi', current.status == 'Planlandı' || current.status == 'Ödendi'
                    ? 'Bordro onayı tamamlandı ve ödeme akışına alındı.'
                    : 'Bordro yönetici onayını bekliyor.'),
                _step(context, const Color(0xFF7C3AED), 'Banka dosyası', 'Banka aktarımı ve bordro PDF çıktısı hazır tutuluyor.'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          SizedBox(width: 110, child: Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700))),
          const SizedBox(width: 12),
          Expanded(child: Text(value, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800))),
        ],
      ),
    );
  }

  Widget _step(BuildContext context, Color color, String title, String subtitle) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(Icons.check_circle_outline_rounded, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                Text(subtitle, style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.4)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
