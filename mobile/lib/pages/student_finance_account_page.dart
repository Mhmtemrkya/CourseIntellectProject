import 'dart:io';

import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import 'package:student/i18n/app_locale.dart';
import 'package:student/utils/format.dart';
import '../services/student_finance_api_service.dart';
import '../widgets/school_collect_sheet.dart';

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
      final data = await StudentFinanceApiService.instance.getAccount(
        studentName: widget.studentName,
      );
      if (!mounted) return;
      setState(() => _account = data);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _tl(dynamic value) =>
      formatMoney(value is num ? value : double.tryParse('$value') ?? 0);

  /// Tahsilat artık tek satırlık "tutar gir" kutusuyla DEĞİL, masaüstündekiyle
  /// aynı pencereyle alınır: taksit seçimi, ödeme yöntemi, makbuz notu ve çift
  /// tahsilat koruması orada yaşar.
  Future<void> _recordPayment() async {
    final collected = await SchoolCollectSheet.show(
      context,
      studentName: widget.studentName,
    );
    if (collected && mounted) await _load();
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

  /// Kurum künyeli cari hesap ekstresini sunucudan PDF olarak alıp açar.
  /// Tarih aralığı verilmez; ilk hareketten taksit planının sonuna kadar tüm
  /// geçmiş belgeye girer (masaüstü ile aynı uç).
  Future<void> _downloadStatement() async {
    setState(() => _busy = true);
    try {
      final bytes = await StudentFinanceApiService.instance
          .downloadStatementPdf(studentName: widget.studentName);
      final slug = widget.studentName
          .replaceAll(RegExp(r'[^a-zA-Z0-9]+'), '-')
          .toLowerCase();
      final file = File(
        '${(await getTemporaryDirectory()).path}/cari-hesap-ekstresi-$slug.pdf',
      );
      await file.writeAsBytes(bytes, flush: true);
      final result = await OpenFilex.open(file.path);
      if (result.type != ResultType.done) throw StateError(result.message);
    } catch (e) {
      _snack('Ekstre açılamadı: $e');
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
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Vazgeç'.tr),
          ),
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
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
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
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(_error!),
              ),
            )
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
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: _busy ? null : _downloadStatement,
                      icon: const Icon(Icons.description_outlined),
                      label: Text('Ekstre (PDF)'.tr),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Taksitler',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                  ),
                  const SizedBox(height: 8),
                  ...((account['installments'] as List<dynamic>? ?? []).map(
                    _installmentTile,
                  )),
                  const SizedBox(height: 16),
                  Text(
                    'Ödemeler / Makbuzlar'.tr,
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                  ),
                  const SizedBox(height: 8),
                  ...((account['payments'] as List<dynamic>? ?? []).map(
                    _paymentTile,
                  )),
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
          Text(
            _tl(value),
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
          ),
        ],
      ),
    );
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              children: [
                cell('Net', account['netTotal']),
                cell('Ödenen', account['paidTotal']),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                cell('Kalan', account['balance']),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Geciken Taksit',
                        style: TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${account['overdueCount'] ?? 0}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            // Burs kartı YALNIZ burslu öğrencide çizilir; oran 0 ise hiç yoktur.
            if ((account['scholarshipPercent'] as num? ?? 0) > 0) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF059669).withValues(alpha: 0.08),
                  border: Border.all(
                    color: const Color(0xFF059669).withValues(alpha: 0.35),
                  ),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.school_outlined, color: Color(0xFF059669)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '%${account['scholarshipPercent']} ${'Burs Oranı'.tr}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 16,
                              color: Color(0xFF059669),
                            ),
                          ),
                          Text(
                            '${_tl(account['scholarshipAmount'])} ${'indirim uygulandı'.tr}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.grey,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
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
          Text(
            _statusLabel(status),
            style: TextStyle(
              color: _statusColor(status),
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
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
      subtitle: Text(
        '${item['method']} · ${'${item['paidAtUtc']}'.split('T').first}',
      ),
      trailing: Text(
        _tl(amount),
        style: TextStyle(
          color: amount < 0 ? Colors.red : Colors.green,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
