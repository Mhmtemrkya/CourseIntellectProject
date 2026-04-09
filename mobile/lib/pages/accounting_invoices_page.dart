import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import 'accounting_invoice_detail_page.dart';
import 'accounting_invoice_form_page.dart';
import '../widgets/app_header.dart';
import '../widgets/accounting_ui.dart';

class AccountingInvoicesPage extends StatefulWidget {
  const AccountingInvoicesPage({super.key});

  @override
  State<AccountingInvoicesPage> createState() => _AccountingInvoicesPageState();
}

class _AccountingInvoicesPageState extends State<AccountingInvoicesPage> {
  final AccountingFinanceStore _store = AccountingFinanceStore.instance;

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
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    return AccountingScaffold(
      appBar: const AppHeader(title: 'Faturalar ve Makbuzlar'),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateInvoice,
        backgroundColor: const Color(0xFF0F172A),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_card_rounded),
        label: const Text('Fatura Oluştur'),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: 'Belge merkezi',
            title: 'Öğrenci, gider ve maaş faturalarını tek akışta yönetin.',
            description: 'Kategori bazlı belge arşivi ve makbuz kayıtları detay sayfalarına açılır.',
            colors: const [Color(0xFF0F172A), Color(0xFF4F46E5)],
            metrics: [
              AccountingHeroMetric(label: 'Toplam Kayıt', value: '${_store.invoices.length}'),
              AccountingHeroMetric(label: 'Bekleyen', value: '${_store.invoices.where((item) => item.status == 'Bekliyor').length} belge'),
            ],
          ),
          SizedBox(height: 16),
          _InvoiceCategoryCard(
            title: 'Öğrenci Faturaları',
            subtitle: 'Kurs, etüt ve ek hizmet faturalandırmaları',
            count: '${_store.countForCategory('Öğrenci Faturaları')} kayıt',
            color: Color(0xFF2563EB),
          ),
          SizedBox(height: 12),
          _InvoiceCategoryCard(
            title: 'Dershane Mekan Giderleri',
            subtitle: 'Kira, elektrik, internet ve işletme giderleri',
            count: '${_store.countForCategory('Dershane Mekan Giderleri')} kayıt',
            color: Color(0xFFB45309),
          ),
          SizedBox(height: 12),
          _InvoiceCategoryCard(
            title: 'Diğer Gider Faturaları',
            subtitle: 'Kırtasiye, reklam, teknik servis ve araç giderleri',
            count: '${_store.countForCategory('Diğer Gider Faturaları')} kayıt',
            color: Color(0xFF7C3AED),
          ),
          SizedBox(height: 12),
          _InvoiceCategoryCard(
            title: 'Maaş Faturaları',
            subtitle: 'Öğretmen, idari kadro ve prim dökümleri',
            count: '${_store.countForCategory('Maaş Faturaları')} kayıt',
            color: Color(0xFF0F766E),
          ),
        ],
      ),
    );
  }

  Future<void> _openCreateInvoice() async {
    final result = await Navigator.push<Map<String, String>>(
      context,
      MaterialPageRoute(builder: (_) => const AccountingInvoiceFormPage()),
    );

    if (!mounted || result == null) {
      return;
    }

    try {
      await _store.addInvoice(
        title: result['title']!,
        category: result['category']!,
        amount: result['amount']!,
        date: result['date']!,
        reason: result['reason']!,
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Yeni fatura oluşturuldu ve onaya gönderildi.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString()), behavior: SnackBarBehavior.floating),
      );
    }
  }
}

class _InvoiceCategoryCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String count;
  final Color color;

  const _InvoiceCategoryCard({
    required this.title,
    required this.subtitle,
    required this.count,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => _InvoiceListPage(title: title, color: color),
          ),
        );
      },
      child: AccountingPanel(
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(Icons.receipt_long_outlined, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text(subtitle, style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.4)),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(count, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800, color: color)),
                const SizedBox(height: 4),
                const Icon(Icons.chevron_right_rounded),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _InvoiceListPage extends StatelessWidget {
  final String title;
  final Color color;

  const _InvoiceListPage({
    required this.title,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final items = AccountingFinanceStore.instance.invoicesFor(title);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppHeader(title: title),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: items
            .map(
              (item) => InkWell(
                borderRadius: BorderRadius.circular(24),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => AccountingInvoiceDetailPage(
                        invoice: item,
                        accentColor: color,
                      ),
                    ),
                  );
                },
                child: AccountingPanel(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Icon(Icons.picture_as_pdf_outlined, color: color),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.title, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800)),
                            const SizedBox(height: 4),
                            Text('${item.subtitle} • ${item.status}', style: Theme.of(context).textTheme.bodySmall),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(item.amount, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: color, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 4),
                          Icon(Icons.chevron_right_rounded, color: color),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}
