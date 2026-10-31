import 'package:flutter/material.dart';

import '../services/student_finance_api_service.dart';
import '../utils/format.dart';
import '../widgets/accounting_ui.dart';

const _matchTypeLabels = {
  'Payment': 'Tahsilat',
  'Expense': 'Gider',
  'Salary': 'Maaş',
  'Invoice': 'Fatura',
};

String _statusLabel(String status) => switch (status) {
  'Matched' => 'Eşleşti',
  'Ignored' => 'Yok sayıldı',
  _ => 'Eşleşmedi',
};

Color _statusColor(String status) => switch (status) {
  'Matched' => const Color(0xFF0F766E),
  'Ignored' => Colors.grey,
  _ => const Color(0xFFB42318),
};

/// Türkçe tutar ("1.250,50", "-1250.5") → sayı.
double _parseAmount(String raw) {
  var text = raw.replaceAll(RegExp(r'\s|TL|₺', caseSensitive: false), '');
  if (text.contains(',')) text = text.replaceAll('.', '').replaceAll(',', '.');
  return double.tryParse(text) ?? 0;
}

String _date(Object? raw) {
  final value = DateTime.tryParse('$raw')?.toLocal();
  if (value == null) return '—';
  return '${value.day.toString().padLeft(2, '0')}.${value.month.toString().padLeft(2, '0')}.${value.year}';
}

/// Banka mutabakatı: ekstre satırları sistem kayıtlarıyla eşleştirilir ve sonuç
/// kaydedilir. Giren para nakit dışı tahsilatlarla, çıkan para (eksi) onaylı
/// giderler, ödenmiş maaş ve faturalarla eşleşir.
class AccountingReconciliationPage extends StatefulWidget {
  const AccountingReconciliationPage({super.key});

  @override
  State<AccountingReconciliationPage> createState() => _AccountingReconciliationPageState();
}

class _AccountingReconciliationPageState extends State<AccountingReconciliationPage> {
  final _linesController = TextEditingController();
  int _tolerance = 3;
  String _filter = 'Unmatched';
  bool _busy = false;
  Map<String, dynamic>? _result;
  List<Map<String, dynamic>> _entries = [];

  @override
  void initState() {
    super.initState();
    _loadEntries();
  }

  @override
  void dispose() {
    _linesController.dispose();
    super.dispose();
  }

  void _message(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _loadEntries() async {
    try {
      final entries = await StudentFinanceApiService.instance.getReconciliationEntries(status: _filter);
      if (mounted) setState(() => _entries = entries);
    } catch (error) {
      _message('Kayıtlı hareketler alınamadı: $error');
    }
  }

  Future<void> _run() async {
    final rows = _linesController.text
        .split('\n')
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty)
        .map((line) {
          final cells = line.split(RegExp(r'[;\t]')).map((cell) => cell.trim()).toList();
          return {
            'reference': cells.isNotEmpty ? cells[0] : '',
            'amount': cells.length > 1 ? _parseAmount(cells[1]) : 0,
            'date': cells.length > 2 && cells[2].isNotEmpty ? cells[2] : DateTime.now().toIso8601String(),
            'description': cells.length > 3 ? cells.sublist(3).join(' ') : '',
          };
        })
        .where((row) => row['amount'] != 0)
        .toList();
    if (rows.isEmpty) {
      _message('Biçim: referans; tutar; tarih(YYYY-AA-GG); açıklama');
      return;
    }
    setState(() => _busy = true);
    try {
      final result = await StudentFinanceApiService.instance.reconcile(rows: rows, dateToleranceDays: _tolerance);
      if (!mounted) return;
      setState(() => _result = result);
      await _loadEntries();
    } catch (error) {
      _message('$error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _act(Map<String, dynamic> entry, String action) async {
    try {
      await StudentFinanceApiService.instance.updateReconciliationEntry('${entry['id']}', action);
      await _loadEntries();
    } catch (error) {
      _message('$error');
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = ((_result?['items'] as List?) ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    return AccountingScaffold(
      appBar: AppBar(title: const Text('Mutabakat Merkezi', style: TextStyle(fontWeight: FontWeight.bold))),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingPanel(
            margin: const EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Ekstre Satırları', style: TextStyle(fontWeight: FontWeight.w900)),
                const SizedBox(height: 4),
                Text(
                  'Her satır: referans; tutar; tarih(YYYY-AA-GG); açıklama. Çıkan para eksi tutarla yazılır. '
                  'Sonuçlar kaydedilir; aynı ekstre tekrar yüklenirse satırlar çoğalmaz.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _linesController,
                  minLines: 4,
                  maxLines: 10,
                  decoration: const InputDecoration(
                    hintText: 'HVL123; 5000; 2026-06-01\nMAAS11; -18000; 2026-06-03; Maaş',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Text('Tarih toleransı (gün): '),
                    DropdownButton<int>(
                      value: _tolerance,
                      items: [0, 1, 2, 3, 5, 7].map((day) => DropdownMenuItem(value: day, child: Text('$day'))).toList(),
                      onChanged: (value) => setState(() => _tolerance = value ?? _tolerance),
                    ),
                    const Spacer(),
                    FilledButton.icon(
                      onPressed: _busy ? null : _run,
                      icon: const Icon(Icons.verified_outlined),
                      label: const Text('Eşleştir'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (_result != null)
            AccountingPanel(
              margin: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Eşleşen ${_result!['matched']} • ${formatMoney(_result!['matchedAmount'])}   '
                    'Eşleşmeyen ${_result!['unmatched']} • ${formatMoney(_result!['unmatchedAmount'])}',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  ...items.map((item) => _row(
                        reference: '${item['reference']}',
                        subtitle: '${_date(item['date'])} • ${formatMoney(item['amount'])}'
                            '${'${item['matchedLabel'] ?? ''}'.isEmpty ? '' : '\n${_matchTypeLabels[item['matchedType']] ?? 'Kayıt'}: ${item['matchedLabel']}'}',
                        status: '${item['matchStatus']}',
                      )),
                ],
              ),
            ),
          AccountingPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(child: Text('Kayıtlı Banka Hareketleri', style: TextStyle(fontWeight: FontWeight.w900))),
                    DropdownButton<String>(
                      value: _filter,
                      items: const [
                        DropdownMenuItem(value: 'Unmatched', child: Text('Eşleşmeyenler')),
                        DropdownMenuItem(value: 'Matched', child: Text('Eşleşenler')),
                        DropdownMenuItem(value: 'Ignored', child: Text('Yok sayılanlar')),
                        DropdownMenuItem(value: '', child: Text('Tümü')),
                      ],
                      onChanged: (value) {
                        setState(() => _filter = value ?? _filter);
                        _loadEntries();
                      },
                    ),
                  ],
                ),
                if (_entries.isEmpty)
                  const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('Kayıt yok.')),
                ..._entries.map((entry) {
                  final status = '${entry['status']}';
                  return _row(
                    reference: '${entry['reference']}',
                    subtitle: '${_date(entry['bankDate'])} • ${formatMoney(entry['amount'])}'
                        '${'${entry['description'] ?? ''}'.isEmpty ? '' : ' • ${entry['description']}'}'
                        '${status == 'Matched' ? '\n${_matchTypeLabels[entry['matchedType']] ?? 'Kayıt'}: ${entry['matchedLabel']}' : ''}',
                    status: status,
                    action: status == 'Unmatched'
                        ? TextButton(onPressed: () => _act(entry, 'ignore'), child: const Text('Yok say'))
                        : TextButton(
                            onPressed: () => _act(entry, 'unmatch'),
                            child: Text(status == 'Matched' ? 'Eşleşmeyi kaldır' : 'Geri al'),
                          ),
                  );
                }),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _row({required String reference, required String subtitle, required String status, Widget? action}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(reference, style: const TextStyle(fontWeight: FontWeight.w700)),
                Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              AccountingAccentBadge(label: _statusLabel(status), color: _statusColor(status)),
              ?action,
            ],
          ),
        ],
      ),
    );
  }
}
