import 'package:flutter/material.dart';

import '../services/student_finance_api_service.dart';
import '../utils/format.dart';

const _statusLabels = {'Active': 'Aktif', 'Frozen': 'Donduruldu', 'Cancelled': 'İptal'};

/// Sözleşme satırı + yaşam döngüsü işlemleri (masaüstü ContractActions ile aynı):
///  • Dondur / Devam ettir: borç durur, gecikme ve hatırlatma işlemez.
///  • İptal: ödenmemiş borç silinir; tahsil edilen para iade ile ayrıca geri verilir.
///  • Yeniden yapılandır: kalan borç yeni taksit planına bölünür.
class FinanceContractActions extends StatelessWidget {
  final Map<String, dynamic> contract;
  final Future<void> Function() onChanged;

  const FinanceContractActions({super.key, required this.contract, required this.onChanged});

  double get _remaining => ((contract['installments'] as List?) ?? const [])
      .map((item) => Map<String, dynamic>.from(item as Map))
      .fold<double>(0, (sum, item) {
        final remaining = (item['remaining'] as num?)?.toDouble() ?? 0;
        return sum + (remaining > 0 ? remaining : 0);
      });

  String get _currency => '${contract['currency'] ?? 'TRY'}';

  void _snack(BuildContext context, String text) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> _changeStatus(BuildContext context, String action) async {
    final reason = TextEditingController();
    final description = switch (action) {
      'freeze' => 'Dondurulan kaydın borcu durur; gecikme ve hatırlatma işlemez.',
      'unfreeze' => 'Kayıt yeniden aktif olur; taksitler kaldığı yerden devam eder.',
      _ => 'Ödenmemiş ${formatMoney(_remaining, currency: _currency)} borç silinir. Tahsil edilmiş para iade ile ayrıca geri verilir. Geri alınamaz.',
    };
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(switch (action) {
          'freeze' => 'Kaydı Dondur',
          'unfreeze' => 'Kaydı Devam Ettir',
          _ => 'Kaydı İptal Et',
        }),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(description),
            TextField(controller: reason, decoration: const InputDecoration(labelText: 'Gerekçe *')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Vazgeç')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Onayla')),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    if (reason.text.trim().isEmpty) {
      _snack(context, 'Gerekçe yazın.');
      return;
    }
    try {
      await StudentFinanceApiService.instance.changeContractStatus(
        contractId: '${contract['id']}',
        action: action,
        reason: reason.text.trim(),
      );
      if (context.mounted) _snack(context, 'İşlem tamamlandı.');
      await onChanged();
    } catch (error) {
      if (context.mounted) _snack(context, '$error');
    }
  }

  Future<void> _restructure(BuildContext context) async {
    final count = TextEditingController(text: '6');
    final reason = TextEditingController();
    final now = DateTime.now();
    var firstDue = DateTime(now.year, now.month + 1, 1);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('Taksitleri Yeniden Yapılandır'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Kalan ${formatMoney(_remaining, currency: _currency)} borç yeni taksitlere bölünür; ödenmiş kısımlar korunur.'),
              TextField(
                controller: count,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Yeni taksit sayısı'),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                icon: const Icon(Icons.event_rounded),
                label: Text('İlk vade: ${firstDue.day.toString().padLeft(2, '0')}.${firstDue.month.toString().padLeft(2, '0')}.${firstDue.year}'),
                onPressed: () async {
                  final picked = await showDatePicker(
                    context: ctx,
                    initialDate: firstDue,
                    firstDate: DateTime(2020),
                    lastDate: DateTime(2100),
                  );
                  if (picked != null) setLocal(() => firstDue = picked);
                },
              ),
              TextField(controller: reason, decoration: const InputDecoration(labelText: 'Gerekçe (opsiyonel)')),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Vazgeç')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Yapılandır')),
          ],
        ),
      ),
    );
    if (confirmed != true || !context.mounted) return;
    final installmentCount = int.tryParse(count.text.trim()) ?? 0;
    if (installmentCount < 1 || installmentCount > 60) {
      _snack(context, 'Taksit sayısı 1 ile 60 arasında olmalı.');
      return;
    }
    try {
      await StudentFinanceApiService.instance.restructureInstallments(
        contractId: '${contract['id']}',
        installmentCount: installmentCount,
        firstDueDate: firstDue,
        reason: reason.text.trim().isEmpty ? null : reason.text.trim(),
      );
      if (context.mounted) _snack(context, 'Taksit planı yeniden yapılandırıldı.');
      await onChanged();
    } catch (error) {
      if (context.mounted) _snack(context, '$error');
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = '${contract['status'] ?? 'Active'}';
    final reason = '${contract['statusReason'] ?? ''}';
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${contract['className'] ?? 'Sözleşme'} ${contract['academicYear'] ?? ''}'.trim(),
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                Chip(label: Text(_statusLabels[status] ?? status), visualDensity: VisualDensity.compact),
              ],
            ),
            Text(
              'Net ${formatMoney(contract['netAmount'], currency: _currency)} • Kalan taksit ${formatMoney(_remaining, currency: _currency)}',
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
            if (status != 'Active' && reason.isNotEmpty)
              Text(reason, style: const TextStyle(fontSize: 12, color: Colors.grey)),
            if (status != 'Cancelled')
              Wrap(
                spacing: 4,
                children: [
                  if (status == 'Active') ...[
                    TextButton(onPressed: () => _restructure(context), child: const Text('Yeniden Yapılandır')),
                    TextButton(onPressed: () => _changeStatus(context, 'freeze'), child: const Text('Dondur')),
                  ] else
                    TextButton(onPressed: () => _changeStatus(context, 'unfreeze'), child: const Text('Devam Ettir')),
                  TextButton(
                    style: TextButton.styleFrom(foregroundColor: const Color(0xFFB42318)),
                    onPressed: () => _changeStatus(context, 'cancel'),
                    child: const Text('İptal'),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
