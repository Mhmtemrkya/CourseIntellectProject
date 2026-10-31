import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../services/student_finance_api_service.dart';
import '../utils/format.dart';
import '../widgets/accounting_ui.dart';

/// "1.250,50" / "1250.5" → sayı.
double _parseAmount(String raw) {
  var text = raw.replaceAll(RegExp(r'\s|TL|₺', caseSensitive: false), '');
  if (text.contains(',')) text = text.replaceAll('.', '').replaceAll(',', '.');
  return double.tryParse(text) ?? 0;
}

/// "28.10.2026" ya da "2026-10-28" → ISO (öğle saati; gün kaymasın).
String? _parseDate(String raw) {
  final text = raw.trim();
  if (text.isEmpty) return null;
  final tr = RegExp(r'^(\d{1,2})[./](\d{1,2})[./](\d{4})$').firstMatch(text);
  final date = tr != null
      ? DateTime(int.parse(tr.group(3)!), int.parse(tr.group(2)!), int.parse(tr.group(1)!), 12)
      : DateTime.tryParse(text);
  return date == null ? null : DateTime(date.year, date.month, date.day, 12).toUtc().toIso8601String();
}

const _statusLabels = {
  'Ready': 'Hazır',
  'Recorded': 'Kaydedildi',
  'Duplicate': 'Daha önce işlendi',
  'Error': 'Hata',
};

/// Toplu tahsilat (banka dökümü vb.): önce önizleme, sonra kayıt. Her satır ayrı
/// makbuzdur; aynı satırlar tekrar gönderilirse sunucu ikinci kez tahsil etmez.
class AccountingBulkCollectionPage extends StatefulWidget {
  const AccountingBulkCollectionPage({super.key});

  @override
  State<AccountingBulkCollectionPage> createState() => _AccountingBulkCollectionPageState();
}

class _AccountingBulkCollectionPageState extends State<AccountingBulkCollectionPage> {
  final _controller = TextEditingController();
  Map<String, dynamic>? _result;
  bool _previewed = false;
  bool _busy = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> _rows() {
    final lines = _controller.text.split('\n').map((line) => line.trim()).where((line) => line.isNotEmpty).toList();
    return [
      for (var index = 0; index < lines.length; index++)
        () {
          final cells = lines[index].split(RegExp(r'[;\t]')).map((cell) => cell.trim()).toList();
          String cell(int i) => i < cells.length ? cells[i] : '';
          return {
            'line': index + 1,
            'studentName': cell(0),
            'amount': _parseAmount(cell(1)),
            'paidAt': _parseDate(cell(2)),
            'method': cell(3).isEmpty ? null : cell(3),
            'reference': cell(4).isEmpty ? null : cell(4),
          };
        }(),
    ];
  }

  Future<void> _run(bool dryRun) async {
    final rows = _rows();
    if (rows.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Biçim: öğrenci; tutar; tarih; yöntem; referans')),
      );
      return;
    }
    setState(() => _busy = true);
    try {
      final result = await StudentFinanceApiService.instance.bulkCollect(rows: rows, dryRun: dryRun);
      if (!mounted) return;
      setState(() {
        _result = result;
        _previewed = dryRun;
      });
      if (!dryRun) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('${result['recorded']} tahsilat kaydedildi • ${formatMoney(result['recordedAmount'])}'),
        ));
        await AccountingFinanceStore.instance.loadDashboard();
      }
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$error')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = ((_result?['rows'] as List?) ?? const []).map((row) => Map<String, dynamic>.from(row as Map)).toList();
    final canRecord = _previewed && rows.any((row) => row['status'] == 'Ready');
    return AccountingScaffold(
      appBar: AppBar(title: const Text('Toplu Tahsilat Aktarımı', style: TextStyle(fontWeight: FontWeight.bold))),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingPanel(
            margin: const EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Her satır: öğrenci; tutar; tarih; yöntem; referans. Önce önizleyin; hatalı satırlar '
                  '(bulunamayan ya da aynı adlı öğrenci, kapanmış gün) kaydedilmez.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _controller,
                  minLines: 5,
                  maxLines: 14,
                  onChanged: (_) => setState(() {
                    _result = null;
                    _previewed = false;
                  }),
                  decoration: const InputDecoration(
                    hintText: 'Ali Can; 2500; 28.10.2026; Havale; DEK-001',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(onPressed: _busy ? null : () => _run(true), child: const Text('Önizle')),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilledButton(
                        onPressed: _busy || !canRecord ? null : () => _run(false),
                        child: const Text('Hazırları Kaydet'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          ...rows.map((row) {
            final status = '${row['status']}';
            final color = switch (status) {
              'Recorded' => const Color(0xFF0F766E),
              'Ready' => const Color(0xFF2563EB),
              'Duplicate' => Colors.grey,
              _ => const Color(0xFFB42318),
            };
            return AccountingPanel(
              margin: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${row['line']}. ${row['studentName']} • ${formatMoney(row['amount'])}',
                            style: const TextStyle(fontWeight: FontWeight.w700)),
                        Text('${row['receiptNo'] ?? row['message'] ?? ''}', style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  ),
                  AccountingAccentBadge(label: _statusLabels[status] ?? status, color: color),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
