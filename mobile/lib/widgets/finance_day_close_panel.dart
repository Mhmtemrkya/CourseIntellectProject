import 'package:flutter/material.dart';

import '../services/auth_session_store.dart';
import '../services/student_finance_api_service.dart';
import '../utils/format.dart';
import 'accounting_ui.dart';

String _dateLabel(DateTime value) =>
    '${value.day.toString().padLeft(2, '0')}.${value.month.toString().padLeft(2, '0')}.${value.year}';

double _num(Object? value) => value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

/// Gün sonu kasa kapanışı. Beklenen nakit = nakit tahsilat − (nakit iade + nakit
/// gider/maaş/fatura ödemesi). Kapanan güne sunucu hiçbir para hareketi
/// yazdırmaz; düzeltme için yönetici günü gerekçeyle yeniden açar.
class FinanceDayClosePanel extends StatefulWidget {
  const FinanceDayClosePanel({super.key});

  @override
  State<FinanceDayClosePanel> createState() => _FinanceDayClosePanelState();
}

class _FinanceDayClosePanelState extends State<FinanceDayClosePanel> {
  final _countedController = TextEditingController();
  final _noteController = TextEditingController();
  DateTime _day = DateTime.now();
  Map<String, dynamic>? _summary;
  bool _busy = false;
  bool _isAdmin = false;

  @override
  void initState() {
    super.initState();
    _load();
    AuthSessionStore.instance.load().then((session) {
      if (!mounted || session == null) return;
      final roles = {session.primaryRole, ...session.extraRoles}.map((role) => role.toLowerCase());
      setState(() => _isAdmin = roles.contains('admin') || roles.contains('branchmanager'));
    });
  }

  @override
  void dispose() {
    _countedController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  void _message(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _load() async {
    try {
      final summary = await StudentFinanceApiService.instance.getDaySummary(_day);
      if (!mounted) return;
      setState(() {
        _summary = summary;
        _countedController.text = _num(summary['expectedCash']).toStringAsFixed(2);
      });
    } catch (error) {
      _message('Kasa özeti alınamadı: $error');
    }
  }

  Future<void> _close() async {
    final counted = double.tryParse(_countedController.text.trim().replaceAll(',', '.'));
    if (counted == null || counted < 0) {
      _message('Sayılan nakit tutarını girin.');
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Günü Kapat'),
        content: Text('${_dateLabel(_day)} günü kapatılsın mı? Kapanan güne tahsilat, iade veya gider girilemez.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Vazgeç')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Kapat')),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _busy = true);
    try {
      await StudentFinanceApiService.instance.closeDay(
        day: _day,
        countedCash: counted,
        note: _noteController.text.trim().isEmpty ? null : _noteController.text.trim(),
      );
      _noteController.clear();
      _message('Gün kapatıldı.');
      await _load();
    } catch (error) {
      _message('$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reopen() async {
    final reason = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Günü Yeniden Aç'),
        content: TextField(controller: reason, decoration: const InputDecoration(labelText: 'Gerekçe *')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Vazgeç')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Aç')),
        ],
      ),
    );
    if (confirmed != true) return;
    if (reason.text.trim().isEmpty) {
      _message('Yeniden açma gerekçesi yazın.');
      return;
    }
    setState(() => _busy = true);
    try {
      await StudentFinanceApiService.instance.reopenDay(day: _day, reason: reason.text.trim());
      _message('Gün yeniden açıldı.');
      await _load();
    } catch (error) {
      _message('$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final summary = _summary;
    final closing = summary?['closing'] is Map ? Map<String, dynamic>.from(summary!['closing'] as Map) : null;
    final expected = _num(summary?['expectedCash']);
    final difference = (double.tryParse(_countedController.text.replaceAll(',', '.')) ?? 0) - expected;
    return AccountingPanel(
      margin: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.lock_outline_rounded, size: 18),
              const SizedBox(width: 6),
              const Expanded(child: Text('Gün Sonu Kasa Kapanışı', style: TextStyle(fontWeight: FontWeight.w900))),
              TextButton.icon(
                icon: const Icon(Icons.event_rounded, size: 18),
                label: Text(_dateLabel(_day)),
                onPressed: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _day,
                    firstDate: DateTime(2020),
                    lastDate: DateTime.now(),
                  );
                  if (picked == null) return;
                  setState(() => _day = picked);
                  await _load();
                },
              ),
            ],
          ),
          if (summary != null) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 14,
              runSpacing: 6,
              children: [
                Text('Nakit giriş: ${formatMoney(summary['cashIn'])}'),
                Text('Nakit çıkış: ${formatMoney(summary['cashOut'])}'),
                Text('Beklenen kasa: ${formatMoney(expected)}', style: const TextStyle(fontWeight: FontWeight.w800)),
                Text('Kart: ${formatMoney(summary['cardIn'])}'),
                Text('Havale/EFT: ${formatMoney(summary['transferIn'])}'),
              ],
            ),
            const SizedBox(height: 10),
            if (summary['isClosed'] == true && closing != null) ...[
              Text(
                'Kapatıldı • ${closing['closedByName'] ?? '—'}\n'
                'Sayılan ${formatMoney(closing['countedCash'])} • Fark ${formatMoney(closing['difference'])}'
                '${'${closing['note'] ?? ''}'.isEmpty ? '' : ' • ${closing['note']}'}',
                style: const TextStyle(color: Color(0xFF0F766E), fontWeight: FontWeight.w700),
              ),
              if (_isAdmin)
                TextButton.icon(
                  onPressed: _busy ? null : _reopen,
                  icon: const Icon(Icons.lock_open_rounded),
                  label: const Text('Günü Yeniden Aç'),
                ),
            ] else ...[
              TextField(
                controller: _countedController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Sayılan nakit (TL)'),
                onChanged: (_) => setState(() {}),
              ),
              TextField(
                controller: _noteController,
                decoration: const InputDecoration(labelText: 'Not (fark açıklaması)'),
              ),
              const SizedBox(height: 6),
              Text('Fark: ${formatMoney(difference)}'),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _busy ? null : _close,
                  icon: const Icon(Icons.lock_rounded),
                  label: const Text('Günü Kapat'),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
