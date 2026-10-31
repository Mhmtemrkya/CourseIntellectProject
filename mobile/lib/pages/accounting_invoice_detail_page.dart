import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import '../services/accounting_export_service.dart';
import '../services/accounting_finance_store.dart';
import '../widgets/accounting_ui.dart';
import '../widgets/app_header.dart';

class AccountingInvoiceDetailPage extends StatelessWidget {
  final InvoiceRecord invoice;
  final Color accentColor;

  const AccountingInvoiceDetailPage({
    super.key,
    required this.invoice,
    required this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    // Düzenle/iptal/sil sonrası store yenilenince ekran da güncellensin.
    return ListenableBuilder(
      listenable: AccountingFinanceStore.instance,
      builder: (context, _) => _build(context),
    );
  }

  Widget _build(BuildContext context) {
    final store = AccountingFinanceStore.instance;
    final current =
        store.invoices
            .where(
              (item) => item.id == invoice.id || item.title == invoice.title,
            )
            .firstOrNull ??
        invoice;
    final isPaid = current.status == 'Ödendi';

    return AccountingScaffold(
      appBar: AppHeader(title: 'Fatura Detayı'.tr),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingHeroCard(
            eyebrow: current.category,
            title: current.title,
            description:
                'Belge durumu, ödeme özeti ve işlem adımları bu ekranda toplanır.',
            colors: [const Color(0xFF0F172A), accentColor],
            metrics: [
              AccountingHeroMetric(
                label: 'Belge Tutarı'.tr,
                value: current.amount,
              ),
              AccountingHeroMetric(label: 'Durum', value: current.status),
            ],
          ),
          const SizedBox(height: 16),
          AccountingPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AccountingSectionTitle(title: 'Belge Özeti'.tr),
                const SizedBox(height: 14),
                _DetailRow(label: 'Belge Adı'.tr, value: current.title),
                _DetailRow(
                  label: 'Fatura No',
                  value: current.invoiceNumber.isEmpty
                      ? current.id
                      : current.invoiceNumber,
                ),
                _DetailRow(
                  label: 'İlgili Kişi/Kurum',
                  value: current.counterparty.isEmpty
                      ? '-'
                      : current.counterparty,
                ),
                _DetailRow(label: 'Kategori', value: current.category),
                _DetailRow(label: 'Kayıt Bilgisi'.tr, value: current.subtitle),
                _DetailRow(label: 'Toplam Tutar', value: current.amount),
                _DetailRow(label: 'Ödeme Durumu', value: current.status),
                _DetailRow(
                  label: 'Ödeme Yöntemi',
                  value: current.paymentMethod.isEmpty
                      ? '-'
                      : current.paymentMethod,
                ),
                _DetailRow(
                  label: 'Açıklama',
                  value: current.note.isEmpty ? '-' : current.note,
                ),
                if (current.status == 'İptal')
                  _DetailRow(
                    label: 'İptal Gerekçesi',
                    value: current.cancelReason.isEmpty ? '-' : current.cancelReason,
                  ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          AccountingPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AccountingSectionTitle(title: 'Finans Akışı'.tr),
                const SizedBox(height: 14),
                _FlowTile(
                  color: accentColor,
                  icon: Icons.receipt_long_outlined,
                  title: 'Belge oluşturuldu'.tr,
                  subtitle:
                      'Muhasebe kaydı sisteme işlendi ve belge numarası üretildi.'
                          .tr,
                ),
                _FlowTile(
                  color: accentColor,
                  icon: Icons.verified_outlined,
                  title: isPaid ? 'Ödeme tamamlandı' : 'Ödeme bekleniyor',
                  subtitle: isPaid
                      ? '${current.paymentMethod} yöntemiyle ödeme kaydı tamamlandı.'
                      : 'Ödeme geldiğinde fatura listesindeki “Ödendi” işlemini kullanın.',
                ),
                _FlowTile(
                  color: accentColor,
                  icon: Icons.picture_as_pdf_outlined,
                  title: 'Belge çıktısı hazır'.tr,
                  subtitle:
                      'Makbuz ve PDF paylaşımı için belge formatı hazır tutuluyor.'
                          .tr,
                  isLast: true,
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          AccountingPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AccountingSectionTitle(title: 'Hızlı İşlemler'.tr),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () => _downloadPdf(context),
                        icon: const Icon(Icons.download_rounded),
                        label: Text('PDF İndir'.tr),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _sharePdf(context),
                        icon: const Icon(Icons.share_outlined),
                        label: Text('Paylaş'.tr),
                      ),
                    ),
                  ],
                ),
                if (current.status != 'İptal' && current.id.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      OutlinedButton.icon(
                        onPressed: () => _edit(context, current),
                        icon: const Icon(Icons.edit_outlined),
                        label: const Text('Düzenle'),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => _cancel(context, current),
                        icon: const Icon(Icons.block_rounded),
                        label: const Text('İptal Et'),
                      ),
                      if (!isPaid)
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFFB42318),
                          ),
                          onPressed: () => _delete(context, current),
                          icon: const Icon(Icons.delete_outline_rounded),
                          label: const Text('Sil'),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _edit(BuildContext context, InvoiceRecord current) async {
    final isPaid = current.status == 'Ödendi';
    final title = TextEditingController(text: current.title);
    final category = TextEditingController(text: current.category);
    final amount = TextEditingController(text: current.amount);
    final counterparty = TextEditingController(text: current.counterparty);
    final note = TextEditingController(text: current.note);
    var date = (current.issueDateUtc ?? DateTime.now()).toLocal();
    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('Faturayı Düzenle'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: title, decoration: const InputDecoration(labelText: 'Başlık')),
                TextField(controller: category, decoration: const InputDecoration(labelText: 'Kategori')),
                TextField(
                  controller: amount,
                  enabled: !isPaid,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    labelText: 'Tutar',
                    helperText: isPaid ? 'Ödenmiş faturanın tutarı değişmez; iptal edip yenisini girin.' : null,
                    helperMaxLines: 2,
                  ),
                ),
                TextField(controller: counterparty, decoration: const InputDecoration(labelText: 'İlgili Kişi/Kurum')),
                TextField(controller: note, decoration: const InputDecoration(labelText: 'Açıklama')),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  icon: const Icon(Icons.event_rounded),
                  label: Text('Fatura tarihi: ${date.day.toString().padLeft(2, '0')}.${date.month.toString().padLeft(2, '0')}.${date.year}'),
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate: date,
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2100),
                    );
                    if (picked != null) setLocal(() => date = picked);
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('Vazgeç'.tr)),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Kaydet')),
          ],
        ),
      ),
    );
    if (saved != true) return;
    try {
      await AccountingFinanceStore.instance.updateInvoice(
        id: current.id,
        title: title.text.trim(),
        category: category.text.trim(),
        amount: amount.text.trim(),
        date: date,
        dueDate: current.dueDateUtc?.toLocal(),
        counterparty: counterparty.text.trim(),
        note: note.text.trim(),
      );
      if (context.mounted) _showActionInfo(context, 'Fatura güncellendi.');
    } catch (error) {
      if (context.mounted) _showActionInfo(context, '$error');
    }
  }

  Future<void> _cancel(BuildContext context, InvoiceRecord current) async {
    final reason = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Faturayı İptal Et'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('İptal edilen fatura listede kalır ama gider toplamından çıkar.'),
            TextField(controller: reason, decoration: const InputDecoration(labelText: 'Gerekçe *')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('Vazgeç'.tr)),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('İptal Et')),
        ],
      ),
    );
    if (confirmed != true) return;
    if (reason.text.trim().isEmpty) {
      if (context.mounted) _showActionInfo(context, 'İptal gerekçesi yazın.');
      return;
    }
    try {
      await AccountingFinanceStore.instance.cancelInvoice(id: current.id, reason: reason.text.trim());
      if (context.mounted) _showActionInfo(context, 'Fatura iptal edildi.');
    } catch (error) {
      if (context.mounted) _showActionInfo(context, '$error');
    }
  }

  Future<void> _delete(BuildContext context, InvoiceRecord current) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Faturayı Sil'),
        content: Text('${current.invoiceNumber} numaralı fatura silinsin mi? Bu işlem geri alınamaz.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text('Vazgeç'.tr)),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFB42318)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sil'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await AccountingFinanceStore.instance.deleteInvoice(current.id);
      if (context.mounted) {
        _showActionInfo(context, 'Fatura silindi.');
        Navigator.pop(context);
      }
    } catch (error) {
      if (context.mounted) _showActionInfo(context, '$error');
    }
  }

  void _showActionInfo(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  Future<void> _downloadPdf(BuildContext context) async {
    final export = await AccountingExportService.instance.buildExport(
      exportType: 'PDF',
      store: AccountingFinanceStore.instance,
    );
    final saved = await AccountingExportService.instance.saveExport(
      export: export,
    );
    if (!context.mounted) return;
    _showActionInfo(
      context,
      'PDF kaydedildi: ${saved.file.path.split('/').last}',
    );
  }

  Future<void> _sharePdf(BuildContext context) async {
    final export = await AccountingExportService.instance.buildExport(
      exportType: 'PDF',
      store: AccountingFinanceStore.instance,
    );
    final saved = await AccountingExportService.instance.saveExport(
      export: export,
    );
    await AccountingExportService.instance.openExport(saved);
    if (!context.mounted) return;
    _showActionInfo(context, 'PDF dosyalar uygulamasında açıldı.');
  }
}

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: Theme.of(
                  context,
                ).textTheme.bodySmall?.color?.withValues(alpha: 0.7),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class _FlowTile extends StatelessWidget {
  final Color color;
  final IconData icon;
  final String title;
  final String subtitle;
  final bool isLast;

  const _FlowTile({
    required this.color,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: color),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 8),
                    color: color.withValues(alpha: 0.2),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    subtitle,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(height: 1.45),
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
