import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';

import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';

/// Sürücü adayının ödeme planı: kalan borç, taksitler, makbuzlar ve ücret kalemleri.
/// Gecikmiş taksit varsa en üstte açıkça uyarılır.
class DrivingStudentPaymentsPage extends StatefulWidget {
  const DrivingStudentPaymentsPage({super.key});

  @override
  State<DrivingStudentPaymentsPage> createState() =>
      _DrivingStudentPaymentsPageState();
}

class _DrivingStudentPaymentsPageState
    extends State<DrivingStudentPaymentsPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() => setState(() {
    _future = DrivingSchoolApiService.instance.myPayments();
  });

  static const _chargeLabels = {
    'ExtraLesson': 'Ek direksiyon dersi',
    'ExamFee': 'Sınav ücreti',
    'FileFee': 'Dosya masrafı',
    'ExtraService': 'Ek hizmet',
    'PackageDifference': 'Paket/vites farkı',
    'Other': 'Diğer ücret',
  };

  String _money(dynamic value) =>
      '₺${(num.tryParse('$value') ?? 0).toStringAsFixed(2)}';

  String _date(dynamic raw) {
    final value = DateTime.tryParse('$raw')?.toLocal();
    if (value == null) return '-';
    String two(int v) => v.toString().padLeft(2, '0');
    return '${two(value.day)}.${two(value.month)}.${value.year}';
  }

  @override
  Widget build(BuildContext context) => DrivingScaffold(
    appBar: AppBar(title: Text('Ödemelerim'.tr)),
    child: FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(
            child: FilledButton.icon(
              onPressed: _reload,
              icon: const Icon(Icons.refresh),
              label: Text('${snapshot.error}'),
            ),
          );
        }

        final data = snapshot.data ?? const {};
        if (data['hasContract'] != true) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(32),
              child: Text(
                'Henüz bir ödeme planınız yok. Kurs kaydınız tamamlandığında '
                'taksitleriniz burada görünecek.',
                textAlign: TextAlign.center,
              ),
            ),
          );
        }

        final installments = (data['installments'] as List? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        final payments = (data['payments'] as List? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        final charges = (data['charges'] as List? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        final overdue = (data['overdueCount'] as num?)?.toInt() ?? 0;
        final next = data['nextInstallment'] as Map?;

        return RefreshIndicator(
          onRefresh: () async => _reload(),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (overdue > 0)
                Card(
                  color: Colors.red.withValues(alpha: 0.1),
                  child: ListTile(
                    leading: const Icon(
                      Icons.warning_amber_rounded,
                      color: Colors.red,
                    ),
                    title: Text(
                      '$overdue gecikmiş taksitiniz var',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    subtitle: const Text(
                      'Borcunuz belirli bir eşiği aşarsa yeni randevu alamayabilirsiniz.',
                    ),
                  ),
                ),

              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _metric('Toplam', _money(data['netAmount'])),
                          _metric(
                            'Ödenen',
                            _money(data['paidTotal']),
                            color: Colors.green,
                          ),
                          _metric(
                            'Kalan',
                            _money(data['remaining']),
                            color: Colors.orange,
                          ),
                        ],
                      ),
                      if (next != null) ...[
                        const Divider(height: 26),
                        Text(
                          'Sıradaki ödeme: ${_money(next['remaining'])} • '
                          'vade ${_date(next['dueDateUtc'])}',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),
              const Text(
                'Taksit planı',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
              const SizedBox(height: 8),
              ...installments.map((item) {
                final amount = (item['amount'] as num?)?.toDouble() ?? 0;
                final paid = (item['paidAmount'] as num?)?.toDouble() ?? 0;
                final due = DateTime.tryParse('${item['dueDateUtc']}');
                final isPaid = paid >= amount;
                final isOverdue =
                    !isPaid && due != null && due.isBefore(DateTime.now());

                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: Icon(
                      isPaid
                          ? Icons.check_circle_rounded
                          : isOverdue
                          ? Icons.error_rounded
                          : Icons.schedule_rounded,
                      color: isPaid
                          ? Colors.green
                          : isOverdue
                          ? Colors.red
                          : Colors.amber.shade800,
                    ),
                    title: Text(
                      '${item['seqNo']}. ${item['label'] ?? 'Taksit'}',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    subtitle: Text('Vade: ${_date(item['dueDateUtc'])}'),
                    trailing: Text(
                      '${_money(paid)} / ${_money(amount)}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                );
              }),

              if (charges.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text(
                  'Ek ücretler',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                ),
                const SizedBox(height: 8),
                ...charges.map(
                  (item) => Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      title: Text(
                        _chargeLabels['${item['chargeType']}'] ??
                            '${item['chargeType']}',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: Text(
                        '${item['description'] ?? ''} • ${_date(item['createdAtUtc'])}',
                      ),
                      trailing: Text(_money(item['netAmount'])),
                    ),
                  ),
                ),
              ],

              if (payments.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text(
                  'Makbuzlarım',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                ),
                const SizedBox(height: 8),
                ...payments.map(
                  (item) => Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: const Icon(
                        Icons.receipt_long_rounded,
                        color: Colors.green,
                      ),
                      title: Text(
                        'Makbuz ${item['receiptNo']}',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      subtitle: Text(
                        '${item['method'] ?? ''} • ${_date(item['paidAtUtc'])}',
                      ),
                      trailing: Text(
                        _money(item['amount']),
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          color: Colors.green,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    ),
  );

  Widget _metric(String label, String value, {Color? color}) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: const TextStyle(fontSize: 12)),
      Text(
        value,
        style: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w900,
          color: color,
        ),
      ),
    ],
  );
}
