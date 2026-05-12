import 'package:flutter/material.dart';
import '../services/accounting_export_service.dart';
import '../services/accounting_finance_store.dart';
import '../widgets/accounting_ui.dart';
import '../widgets/app_header.dart';
import '../widgets/responsive_overlays.dart';

class AccountingExportsPage extends StatefulWidget {
  const AccountingExportsPage({super.key});

  @override
  State<AccountingExportsPage> createState() => _AccountingExportsPageState();
}

class _AccountingExportsPageState extends State<AccountingExportsPage> {
  final _store = AccountingFinanceStore.instance;
  bool _isCreating = false;

  @override
  void initState() {
    super.initState();
    if (!_store.isLoaded) {
      _store.loadDashboard();
    }
  }

  @override
  Widget build(BuildContext context) {
    return AccountingScaffold(
      appBar: const AppHeader(title: 'Dışa Aktar'),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_store.lastError != null) ...[
            AccountingPanel(
              child: Row(
                children: [
                  const Icon(
                    Icons.error_outline_rounded,
                    color: Color(0xFFB42318),
                  ),
                  const SizedBox(width: 10),
                  Expanded(child: Text(_store.lastError!)),
                  TextButton(
                    onPressed: _store.loadDashboard,
                    child: const Text('Yenile'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
          AccountingHeroCard(
            eyebrow: 'Rapor dışa aktarımı',
            title:
                'Muhasebe verilerini yönetim ve operasyon ekipleri için hazır paketler halinde alın.',
            description: 'Excel ve PDF çıktıları özet önizleme ile hazırlanır.',
            colors: const [Color(0xFF0F172A), Color(0xFF0F766E)],
            metrics: [
              const AccountingHeroMetric(label: 'Hazır Şablon', value: '3'),
              AccountingHeroMetric(
                label: 'Fatura Kayıt',
                value: '${_store.invoices.length}',
              ),
            ],
          ),
          const SizedBox(height: 16),
          _exportCard(
            context,
            'Excel Olarak Aktar',
            'Tahsilatlar, taksitler, cari hesaplar ve geciken ödemeler',
            Icons.table_chart_outlined,
            const Color(0xFF0F766E),
            'Excel',
          ),
          const SizedBox(height: 12),
          _exportCard(
            context,
            'PDF Olarak Aktar',
            'Yönetim özeti, bordro onayları ve finans raporları',
            Icons.picture_as_pdf_outlined,
            const Color(0xFFB45309),
            'PDF',
          ),
          const SizedBox(height: 12),
          _exportCard(
            context,
            'Makbuz Paketini Aktar',
            'Son tahsilat makbuzları ve öğrenci hareketleri',
            Icons.receipt_long_outlined,
            const Color(0xFF2563EB),
            'Makbuz',
          ),
        ],
      ),
    );
  }

  Widget _exportCard(
    BuildContext context,
    String title,
    String subtitle,
    IconData icon,
    Color color,
    String exportType,
  ) {
    return AccountingPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            subtitle,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(height: 1.4),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: FilledButton.tonalIcon(
                  onPressed: () =>
                      _showExportPreview(context, title, exportType),
                  icon: const Icon(Icons.download_rounded),
                  label: const Text('Dışa Aktar'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isCreating
                      ? null
                      : () async {
                          final messenger = ScaffoldMessenger.of(context);
                          final export = await AccountingExportService.instance
                              .buildExport(
                                exportType: exportType,
                                store: _store,
                              );
                          final saved = await AccountingExportService.instance
                              .saveExport(export: export);
                          if (!mounted) return;
                          messenger.showSnackBar(
                            SnackBar(
                              content: Text(
                                '${saved.label} kaydedildi: ${saved.file.path.split('/').last}',
                              ),
                              behavior: SnackBarBehavior.floating,
                              action: SnackBarAction(
                                label: 'Paylaş',
                                onPressed: () {
                                  AccountingExportService.instance.shareExport(
                                    saved,
                                  );
                                },
                              ),
                            ),
                          );
                        },
                  icon: const Icon(Icons.share_outlined),
                  label: const Text('Kaydet'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showExportPreview(
    BuildContext context,
    String title,
    String exportType,
  ) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return Dialog(
          backgroundColor: Colors.transparent,
          child: ResponsiveDialogContainer(
            maxWidth: 520,
            child: AccountingPanel(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(dialogContext).textTheme.titleMedium
                        ?.copyWith(fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _store.exportSummary(exportType),
                    style: Theme.of(
                      dialogContext,
                    ).textTheme.bodyMedium?.copyWith(height: 1.5),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(dialogContext),
                          child: const Text('Kapat'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton(
                          onPressed: _isCreating
                              ? null
                              : () async {
                                  Navigator.pop(dialogContext);
                                  await _createExport(
                                    context,
                                    title,
                                    exportType,
                                  );
                                },
                          child: Text(
                            _isCreating ? 'Hazırlanıyor...' : 'Oluştur',
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Future<void> _createExport(
    BuildContext context,
    String title,
    String exportType,
  ) async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() {
      _isCreating = true;
    });

    try {
      final export = await AccountingExportService.instance.buildExport(
        exportType: exportType,
        store: _store,
      );
      final saved = await AccountingExportService.instance.saveExport(
        export: export,
      );
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            '${saved.label} kaydedildi: ${saved.file.path.split('/').last}',
          ),
          behavior: SnackBarBehavior.floating,
          action: SnackBarAction(
            label: 'Aç',
            onPressed: () => AccountingExportService.instance.openExport(saved),
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isCreating = false;
        });
      }
    }
  }
}
