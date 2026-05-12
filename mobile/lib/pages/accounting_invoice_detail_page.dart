import 'package:flutter/material.dart';
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
    final store = AccountingFinanceStore.instance;
    final current =
        store.invoices
            .where(
              (item) => item.id == invoice.id || item.title == invoice.title,
            )
            .firstOrNull ??
        invoice;
    final approvalStatus = current.id.isEmpty
        ? ''
        : store.approvalStatusFor('Invoice', current.id);
    final approvalLabel = approvalStatus.isEmpty ? 'Bekliyor' : approvalStatus;
    final approvalComplete = approvalLabel == 'Onaylandı';

    return AccountingScaffold(
      appBar: const AppHeader(title: 'Fatura Detayı'),
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
                label: 'Belge Tutarı',
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
                AccountingSectionTitle(title: 'Belge Özeti'),
                const SizedBox(height: 14),
                _DetailRow(label: 'Belge Adı', value: current.title),
                _DetailRow(label: 'Kategori', value: current.category),
                _DetailRow(label: 'Kayıt Bilgisi', value: current.subtitle),
                _DetailRow(label: 'Toplam Tutar', value: current.amount),
                _DetailRow(label: 'Onay Durumu', value: approvalLabel),
              ],
            ),
          ),
          const SizedBox(height: 14),
          AccountingPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AccountingSectionTitle(title: 'Finans Akışı'),
                const SizedBox(height: 14),
                _FlowTile(
                  color: accentColor,
                  icon: Icons.receipt_long_outlined,
                  title: 'Belge oluşturuldu',
                  subtitle:
                      'Muhasebe kaydı sisteme işlendi ve belge numarası üretildi.',
                ),
                _FlowTile(
                  color: accentColor,
                  icon: Icons.verified_outlined,
                  title: approvalComplete
                      ? 'Onay tamamlandı'
                      : 'Onay süreci izleniyor',
                  subtitle: approvalComplete
                      ? 'Yönetici onayı tamamlandı, belge aktif mali kayıtlara işlendi.'
                      : 'Belge şu an inceleme sürecinde; karar sonrası durum güncellenecek.',
                ),
                _FlowTile(
                  color: accentColor,
                  icon: Icons.picture_as_pdf_outlined,
                  title: 'Belge çıktısı hazır',
                  subtitle:
                      'Makbuz ve PDF paylaşımı için belge formatı hazır tutuluyor.',
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
                AccountingSectionTitle(title: 'Hızlı İşlemler'),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () => _downloadPdf(context),
                        icon: const Icon(Icons.download_rounded),
                        label: const Text('PDF İndir'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _sharePdf(context),
                        icon: const Icon(Icons.share_outlined),
                        label: const Text('Paylaş'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
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
