import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/student_finance_api_service.dart';

class VeliFinancePage extends StatefulWidget {
  const VeliFinancePage({super.key});

  @override
  State<VeliFinancePage> createState() => _VeliFinancePageState();
}

class _VeliFinancePageState extends State<VeliFinancePage> {
  List<Map<String, dynamic>> _accounts = [];
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      _accounts = await StudentFinanceApiService.instance.getParentChildrenFinance();
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _tl(dynamic v) {
    final n = (v is num) ? v : double.tryParse('$v') ?? 0;
    return '${n.toStringAsFixed(2)} ₺';
  }

  String _statusLabel(String s) => switch (s) {
        'Paid' => 'Ödendi',
        'Overdue' => 'Gecikti',
        'Partial' => 'Kısmi',
        _ => 'Bekliyor',
      };

  Color _statusColor(String s) => switch (s) {
        'Paid' => Colors.green,
        'Overdue' => Colors.red,
        'Partial' => Colors.orange,
        _ => Colors.grey,
      };

  Future<void> _pay(Map<String, dynamic> account) async {
    final controller = TextEditingController(
      text: (account['balance'] is num && account['balance'] > 0) ? '${account['balance']}' : '',
    );
    final amount = await showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Online Ödeme • ${account['studentName']}'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('Kalan borç: ${_tl(account['balance'])}'),
          const SizedBox(height: 8),
          TextField(controller: controller, keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: 'Tutar'), autofocus: true),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text('Vazgeç'.tr)),
          ElevatedButton(
            onPressed: () {
              final v = double.tryParse(controller.text.trim());
              Navigator.pop(ctx, (v != null && v > 0) ? v : null);
            },
            child: Text('Öde'.tr),
          ),
        ],
      ),
    );
    if (amount == null) return;
    setState(() => _busy = true);
    try {
      final res = await StudentFinanceApiService.instance.parentPay(studentName: '${account['studentName']}', amount: amount);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Ödeme alındı • Makbuz: ${res['receiptNo'] ?? '-'}')));
      await _load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Ödeme yapılamadı: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final visible = _accounts.where((a) => (a['netTotal'] as num? ?? 0) > 0).toList();
    return Scaffold(
      appBar: AppBar(title: Text('Ödemeler'.tr)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!)))
              : visible.isEmpty
                  ? Center(child: Text('Tanımlı kayıt ücreti / taksit planı yok.'.tr))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: visible.map(_accountCard).toList(),
                      ),
                    ),
    );
  }

  Widget _accountCard(Map<String, dynamic> account) {
    final installments = (account['installments'] as List<dynamic>? ?? const []);
    final hasBalance = (account['balance'] as num? ?? 0) > 0;
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(child: Text('${account['studentName']}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
                FilledButton.icon(
                  onPressed: (_busy || !hasBalance) ? null : () => _pay(account),
                  icon: const Icon(Icons.credit_card, size: 16),
                  label: Text(hasBalance ? 'Online Öde' : 'Borç Yok'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(spacing: 16, runSpacing: 4, children: [
              _kv('Net', _tl(account['netTotal'])),
              _kv('Ödenen', _tl(account['paidTotal'])),
              _kv('Kalan', _tl(account['balance'])),
              _kv('Geciken', '${account['overdueCount'] ?? 0}'),
            ]),
            const Divider(height: 20),
            const Text('Taksitler', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            if (installments.isEmpty)
              Text('Taksit yok.'.tr, style: TextStyle(color: Colors.grey, fontSize: 12))
            else
              ...installments.map((raw) {
                final it = Map<String, dynamic>.from(raw as Map);
                final st = '${it['status']}';
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    Text('${it['label'] ?? '${it['seqNo']}. Taksit'} • ${'${it['dueDateUtc']}'.split('T').first}', style: const TextStyle(fontSize: 13)),
                    Row(children: [
                      Text(_tl(it['amount']), style: const TextStyle(fontSize: 13)),
                      const SizedBox(width: 8),
                      Text(_statusLabel(st), style: TextStyle(fontSize: 12, color: _statusColor(st), fontWeight: FontWeight.w700)),
                    ]),
                  ]),
                );
              }),
          ],
        ),
      ),
    );
  }

  Widget _kv(String k, String v) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(k, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          Text(v, style: const TextStyle(fontWeight: FontWeight.w800)),
        ],
      );
}
