import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/student_finance_api_service.dart';

class StudentFinanceAccountPage extends StatefulWidget {
  final String studentName;

  const StudentFinanceAccountPage({super.key, required this.studentName});

  @override
  State<StudentFinanceAccountPage> createState() =>
      _StudentFinanceAccountPageState();
}

class _StudentFinanceAccountPageState extends State<StudentFinanceAccountPage> {
  Map<String, dynamic>? _account;
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await StudentFinanceApiService.instance
          .getAccount(studentName: widget.studentName);
      if (!mounted) return;
      setState(() => _account = data);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _tl(dynamic value) {
    final number = (value is num) ? value : double.tryParse('$value') ?? 0;
    return '${number.toStringAsFixed(2)} ₺';
  }

  Future<void> _recordPayment() async {
    final amount = await _amountDialog('Ödeme Al', 'Tahsil edilecek tutar');
    if (amount == null) return;
    setState(() => _busy = true);
    try {
      await StudentFinanceApiService.instance
          .recordPayment(studentName: widget.studentName, amount: amount);
      await _load();
      _snack('Ödeme kaydedildi: ${_tl(amount)}');
    } catch (e) {
      _snack('Ödeme kaydedilemedi: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _refund() async {
    final amount = await _amountDialog('İade', 'İade tutarı');
    if (amount == null) return;
    setState(() => _busy = true);
    try {
      await StudentFinanceApiService.instance.refund(
        studentName: widget.studentName,
        amount: amount,
        reason: 'Panel üzerinden iade',
      );
      await _load();
      _snack('İade işlendi: ${_tl(amount)}');
    } catch (e) {
      _snack('İade yapılamadı: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<double?> _amountDialog(String title, String hint) async {
    final controller = TextEditingController();
    return showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(hintText: hint),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text('Vazgeç'.tr)),
          ElevatedButton(
            onPressed: () {
              final value = double.tryParse(controller.text.trim());
              Navigator.pop(ctx, (value != null && value > 0) ? value : null);
            },
            child: const Text('Onayla'),
          ),
        ],
      ),
    );
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'Paid':
        return Colors.green;
      case 'Overdue':
        return Colors.red;
      case 'Partial':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'Paid':
        return 'Ödendi';
      case 'Overdue':
        return 'Gecikti';
      case 'Partial':
        return 'Kısmi';
      default:
        return 'Bekliyor';
    }
  }

  @override
  Widget build(BuildContext context) {
    final account = _account;
    final hasData = account != null && (account['netTotal'] as num? ?? 0) > 0;
    return Scaffold(
      appBar: AppBar(title: Text('${widget.studentName} • Cari')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!)))
              : !hasData
                  ? Center(child: Text('Bu öğrenci için finans kaydı bulunamadı.'.tr))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          _summaryCard(account),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton.icon(
                                  onPressed: _busy ? null : _recordPayment,
                                  icon: const Icon(Icons.payments_rounded),
                                  label: Text('Ödeme Al'.tr),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: _busy ? null : _refund,
                                  icon: const Icon(Icons.undo_rounded),
                                  label: Text('İade'.tr),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          const Text('Taksitler', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                          const SizedBox(height: 8),
                          ...((account['installments'] as List<dynamic>? ?? []).map(_installmentTile)),
                          const SizedBox(height: 16),
                          Text('Ödemeler / Makbuzlar'.tr, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                          const SizedBox(height: 8),
                          ...((account['payments'] as List<dynamic>? ?? []).map(_paymentTile)),
                        ],
                      ),
                    ),
    );
  }

  Widget _summaryCard(Map<String, dynamic> account) {
    Widget cell(String label, dynamic value) => Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
              const SizedBox(height: 2),
              Text(_tl(value), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ],
          ),
        );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(children: [cell('Net', account['netTotal']), cell('Ödenen', account['paidTotal'])]),
            const SizedBox(height: 12),
            Row(children: [
              cell('Kalan', account['balance']),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Geciken Taksit', style: TextStyle(fontSize: 12, color: Colors.grey)),
                    const SizedBox(height: 2),
                    Text('${account['overdueCount'] ?? 0}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                  ],
                ),
              ),
            ]),
          ],
        ),
      ),
    );
  }

  Widget _installmentTile(dynamic raw) {
    final item = Map<String, dynamic>.from(raw as Map);
    final status = item['status'] as String? ?? 'Pending';
    return ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      title: Text(item['label'] as String? ?? '${item['seqNo']}. Taksit'),
      subtitle: Text('${item['dueDateUtc']}'.split('T').first),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(_tl(item['amount'])),
          Text(_statusLabel(status), style: TextStyle(color: _statusColor(status), fontSize: 12, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _paymentTile(dynamic raw) {
    final item = Map<String, dynamic>.from(raw as Map);
    final amount = (item['amount'] is num) ? item['amount'] as num : 0;
    return ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      title: Text(item['receiptNo'] as String? ?? 'Makbuz'),
      subtitle: Text('${item['method']} · ${'${item['paidAtUtc']}'.split('T').first}'),
      trailing: Text(
        _tl(amount),
        style: TextStyle(color: amount < 0 ? Colors.red : Colors.green, fontWeight: FontWeight.w700),
      ),
    );
  }
}
