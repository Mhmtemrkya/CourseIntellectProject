import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
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
      appBar: AppHeader(title: 'Faturalar ve Makbuzlar'.tr),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openCreateInvoice,
        backgroundColor: const Color(0xFF0F172A),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_card_rounded),
        label: Text('Fatura Oluştur'.tr),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: 'Belge merkezi',
            title: 'Öğrenci, gider ve maaş faturalarını tek akışta yönetin.'.tr,
            description:
                'Kategori bazlı belge arşivi ve makbuz kayıtları detay sayfalarına açılır.',
            colors: const [Color(0xFF0F172A), Color(0xFF4F46E5)],
            metrics: [
              AccountingHeroMetric(
                label: 'Toplam Kayıt'.tr,
                value: '${_store.invoices.length}',
              ),
              AccountingHeroMetric(
                label: 'Bekleyen',
                value:
                    '${_store.invoices.where((item) => item.status != 'Ödendi').length} belge',
              ),
            ],
          ),
          SizedBox(height: 16),
          _InvoiceCategoryCard(
            title: 'Öğrenci Faturaları'.tr,
            subtitle: 'Kurs, etüt ve ek hizmet faturalandırmaları'.tr,
            count: '${_store.countForCategory('Öğrenci Faturaları')} kayıt',
            color: Color(0xFF2563EB),
          ),
          SizedBox(height: 12),
          _InvoiceCategoryCard(
            title: 'Dershane Mekân Giderleri',
            subtitle: 'Kira, elektrik, internet ve işletme giderleri'.tr,
            count:
                '${_store.countForCategory('Dershane Mekan Giderleri')} kayıt',
            color: Color(0xFFB45309),
          ),
          SizedBox(height: 12),
          _InvoiceCategoryCard(
            title: 'Diğer Gider Faturaları'.tr,
            subtitle: 'Kırtasiye, reklam, teknik servis ve araç giderleri'.tr,
            count: '${_store.countForCategory('Diğer Gider Faturaları')} kayıt',
            color: Color(0xFF7C3AED),
          ),
          SizedBox(height: 12),
          _InvoiceCategoryCard(
            title: 'Maaş Faturaları'.tr,
            subtitle: 'Öğretmen, idari kadro ve prim dökümleri'.tr,
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
        invoiceNumber: result['invoiceNumber'] ?? '',
        counterparty: result['counterparty']!,
        title: result['title']!,
        category: result['category']!,
        amount: result['amount']!,
        date: result['date']!,
        dueDate: result['dueDate']!,
        reason: result['reason']!,
        isPaid: result['isPaid'] == 'true',
        paymentMethod: result['paymentMethod']!,
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            result['isPaid'] == 'true'
                ? 'Fatura ödendi olarak kaydedildi.'
                : 'Fatura ödenmedi olarak kaydedildi.',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          behavior: SnackBarBehavior.floating,
        ),
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
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(height: 1.4),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  count,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
                ),
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

class _InvoiceListPage extends StatefulWidget {
  final String title;
  final Color color;

  const _InvoiceListPage({required this.title, required this.color});

  @override
  State<_InvoiceListPage> createState() => _InvoiceListPageState();
}

class _InvoiceListPageState extends State<_InvoiceListPage> {
  String _monthFilter = 'all';

  static const Map<String, String> _monthOptions = {
    'all': 'Tüm Aylar',
    '01': 'Ocak',
    '02': 'Şubat',
    '03': 'Mart',
    '04': 'Nisan',
    '05': 'Mayıs',
    '06': 'Haziran',
    '07': 'Temmuz',
    '08': 'Ağustos',
    '09': 'Eylül',
    '10': 'Ekim',
    '11': 'Kasım',
    '12': 'Aralık',
  };

  // Fatura subtitle'ı iki biçimde gelebilir: "22.07.2026" (görüntüleme) ve
  // "2026-07-22 • PDF" (yeni oluşturulan fatura, ISO + ek metin). Yalnız TR
  // biçimi aranırsa yeni fatura filtreden düşer ve "faturada gözükmüyor" olur.
  bool _matchesMonth(String subtitle) {
    if (_monthFilter == 'all') return true;
    final iso = RegExp(r'\d{4}-(\d{2})-\d{1,2}').firstMatch(subtitle);
    if (iso != null) return iso.group(1) == _monthFilter;
    final tr = RegExp(r'\d{1,2}\.(\d{2})\.\d{4}').firstMatch(subtitle);
    return tr != null && tr.group(1) == _monthFilter;
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.title;
    final color = widget.color;
    final items = AccountingFinanceStore.instance
        .invoicesFor(title)
        .where((item) => _matchesMonth(item.subtitle))
        .toList();

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppHeader(title: title),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DropdownButtonFormField<String>(
            initialValue: _monthFilter,
            decoration: InputDecoration(
              labelText: 'Dönem (ay) filtresi'.tr,
              border: OutlineInputBorder(),
            ),
            items: _monthOptions.entries
                .map(
                  (e) => DropdownMenuItem(value: e.key, child: Text(e.value)),
                )
                .toList(),
            onChanged: (value) => setState(() => _monthFilter = value ?? 'all'),
          ),
          const SizedBox(height: 12),
          ...items.map(
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
                          Text(
                            item.title,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${item.subtitle} • ${item.status}',
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
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: color,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                        const SizedBox(height: 4),
                        if (item.status != 'Ödendi')
                          TextButton.icon(
                            onPressed: () => _markPaid(item),
                            icon: const Icon(
                              Icons.check_circle_outline_rounded,
                              size: 17,
                            ),
                            label: const Text('Ödendi'),
                          )
                        else
                          Icon(
                            Icons.check_circle_rounded,
                            color: Colors.green.shade700,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _markPaid(InvoiceRecord invoice) async {
    var method = 'Nakit';
    var date = DateTime.now().toIso8601String().split('T').first;
    final noteController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Faturayı ödendi olarak işaretle'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${invoice.invoiceNumber.isEmpty ? invoice.id : invoice.invoiceNumber} • ${invoice.amount}',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                initialValue: method,
                decoration: const InputDecoration(labelText: 'Ödeme yöntemi'),
                items: const [
                  DropdownMenuItem(value: 'Nakit', child: Text('Nakit')),
                  DropdownMenuItem(
                    value: 'Kredi Kartı',
                    child: Text('Kredi Kartı'),
                  ),
                  DropdownMenuItem(
                    value: 'Havale/EFT',
                    child: Text('Havale / EFT'),
                  ),
                  DropdownMenuItem(value: 'Çek', child: Text('Çek')),
                ],
                onChanged: (value) =>
                    setDialogState(() => method = value ?? method),
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Ödeme tarihi'),
                subtitle: Text(date),
                trailing: const Icon(Icons.calendar_month_rounded),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: DateTime.parse(date),
                    firstDate: DateTime(2020),
                    lastDate: DateTime(2100),
                  );
                  if (picked != null) {
                    setDialogState(
                      () => date = picked.toIso8601String().split('T').first,
                    );
                  }
                },
              ), 
              TextField(
                controller: noteController,
                decoration: const InputDecoration(
                  labelText: 'Ödeme notu (isteğe bağlı)',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Vazgeç'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Ödendi olarak işaretle'),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true) {
      noteController.dispose();
      return;
    }

    try {
      await AccountingFinanceStore.instance.markInvoicePaid(
        id: invoice.id,
        paymentMethod: method,
        paidDate: date,
        note: noteController.text,
      );
      if (!mounted) return;
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Fatura ödendi olarak işaretlendi.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      noteController.dispose();
    }
  }
}
