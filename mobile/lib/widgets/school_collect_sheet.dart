import 'dart:math';

import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import 'package:student/utils/format.dart';
import '../services/student_finance_api_service.dart';

/// Okul tahsilat penceresi — masaüstündeki `SchoolCollectModal`'ın mobil karşılığı.
///
/// Önceden mobilde tahsilat, tek satırlık "tutar gir" kutusuyla alınıyordu:
/// taksit seçilemiyor, yöntem sorulmuyor, makbuzun izi görünmüyordu.
///
/// Güvenlik kuralları (masaüstüyle aynı):
///  • `clientRequestId` pencere açılışında BİR kez üretilir; kullanıcı iki kez
///    dokunsa ya da istek yeniden gönderilse bile sunucu ikinci kaydı
///    oluşturmaz (bkz. StudentFinanceService.RecordPaymentAsync).
///  • Kalanı aşan tutar engellenmez ama "avans olarak düşer" diye uyarılır.
///  • Kaydederken pencere kapatılamaz, buton kilitlenir.
class SchoolCollectSheet extends StatefulWidget {
  final String studentName;
  final String? studentUserId;
  final String? className;

  const SchoolCollectSheet({
    super.key,
    required this.studentName,
    this.studentUserId,
    this.className,
  });

  /// Tahsilat alındıysa true döner (çağıran ekran listesini yeniler).
  static Future<bool> show(
    BuildContext context, {
    required String studentName,
    String? studentUserId,
    String? className,
  }) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => SchoolCollectSheet(
        studentName: studentName,
        studentUserId: studentUserId,
        className: className,
      ),
    );
    return result ?? false;
  }

  @override
  State<SchoolCollectSheet> createState() => _SchoolCollectSheetState();
}

const _methods = ['Nakit', 'Kart', 'Havale', 'EFT/IBAN'];

class _SchoolCollectSheetState extends State<SchoolCollectSheet> {
  final _amountController = TextEditingController();
  final _noteController = TextEditingController();

  Map<String, dynamic>? _account;
  bool _loading = true;
  String? _loadError;
  bool _saving = false;
  bool _collectingDownPayment = false;
  String _method = 'Nakit';
  String? _installmentId;

  /// Idempotency anahtarı: pencere başına tek.
  late final String _clientRequestId = _uuidV4();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _amountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  static String _uuidV4() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    String hex(int start, int end) => bytes
        .sublist(start, end)
        .map((b) => b.toRadixString(16).padLeft(2, '0'))
        .join();
    return '${hex(0, 4)}-${hex(4, 6)}-${hex(6, 8)}-${hex(8, 10)}-${hex(10, 16)}';
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final data = await StudentFinanceApiService.instance.getAccount(
        studentName: widget.studentName,
        studentUserId: widget.studentUserId,
      );
      if (!mounted) return;
      setState(() {
        _account = data;
        // Öntanımlı tutar: gecikmiş varsa onu kapat, yoksa kalan borç.
        final preset = _overdueTotal > 0 ? _overdueTotal : _remaining;
        _amountController.text = preset > 0 ? _plainAmount(preset) : '';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = '$e';
        _account = null;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  static String _plainAmount(num value) =>
      value == value.roundToDouble() ? value.round().toString() : '$value';

  double _num(dynamic value) =>
      value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

  List<Map<String, dynamic>> get _installments =>
      (_account?['installments'] as List<dynamic>? ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

  List<Map<String, dynamic>> get _payments =>
      (_account?['payments'] as List<dynamic>? ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

  double get _remaining =>
      _num(_account?['totalPayable'] ?? _account?['balance']);

  double get _overdueTotal => _installments
      .where(
        (item) =>
            _num(item['remaining']) > 0 &&
            (DateTime.tryParse('${item['dueDateUtc']}') ??
                    DateTime.now().add(const Duration(days: 3650)))
                .isBefore(DateTime.now()),
      )
      .fold<double>(0, (sum, item) => sum + _num(item['remaining']));

  double get _pendingDownPayment {
    if (_account?['hasPendingDownPayment'] != true) return 0;
    return max(
      0,
      _num(_account?['downPaymentTotal']) -
          _num(_account?['downPaymentPaidTotal']),
    );
  }

  double get _amount =>
      double.tryParse(_amountController.text.trim().replaceAll(',', '.')) ?? 0;

  bool get _validAmount => _amount > 0;
  bool get _overpaying =>
      _validAmount && _remaining > 0 && _amount > _remaining + 0.005;

  void _pickInstallment(Map<String, dynamic> item) {
    final id = '${item['id']}';
    setState(() {
      if (_installmentId == id) {
        _installmentId = null; // aynına tekrar dokun → otomatik
        final preset = _overdueTotal > 0 ? _overdueTotal : _remaining;
        _amountController.text = preset > 0 ? _plainAmount(preset) : '';
      } else {
        _installmentId = id;
        _amountController.text = _plainAmount(_num(item['remaining']));
      }
    });
  }

  Future<void> _collectDownPayment() async {
    final contracts = (_account?['contracts'] as List<dynamic>? ?? const [])
        .map((e) => Map<String, dynamic>.from(e as Map));
    final contract = contracts.where(
      (item) =>
          _num(item['downPayment']) > 0 && item['downPaymentPaid'] != true,
    );
    if (contract.isEmpty) return;

    setState(() => _collectingDownPayment = true);
    try {
      final payment = await StudentFinanceApiService.instance
          .collectDownPayment(
            contractId: '${contract.first['id']}',
            method: _method,
          );
      if (!mounted) return;
      _snack(
        '${'Peşinat tahsil edildi'.tr}: ${formatMoney(_pendingDownPayment)} • ${payment['receiptNo'] ?? ''}',
      );
      await _load();
    } catch (e) {
      if (mounted) _snack('${'Peşinat tahsil edilemedi'.tr}: $e');
    } finally {
      if (mounted) setState(() => _collectingDownPayment = false);
    }
  }

  Future<void> _submit() async {
    if (!_validAmount) {
      _snack('Geçerli bir tutar girin'.tr);
      return;
    }
    setState(() => _saving = true);
    try {
      final contracts = _account?['contracts'] as List<dynamic>? ?? const [];
      final payment = await StudentFinanceApiService.instance.recordPayment(
        studentName: '${_account?['studentName'] ?? widget.studentName}',
        studentUserId: widget.studentUserId,
        amount: _amount,
        method: _method,
        enrollmentContractId: contracts.isEmpty
            ? null
            : '${(contracts.first as Map)['id']}',
        financeInstallmentId: _installmentId,
        note: _noteController.text.trim().isEmpty
            ? null
            : _noteController.text.trim(),
        clientRequestId: _clientRequestId,
      );
      if (!mounted) return;
      _snack(
        '${'Tahsilat kaydedildi'.tr}: ${formatMoney(_amount)} • ${payment['receiptNo'] ?? ''}',
      );
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      _snack('${'Tahsilat kaydedilemedi'.tr}: $e');
      setState(() => _saving = false); // pencere açık kalır, düzeltip dener
    }
  }

  void _snack(String message) => ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(message)));

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return PopScope(
      canPop: !_saving, // kaydederken pencere kapanmaz
      child: DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.92,
        maxChildSize: 0.96,
        minChildSize: 0.5,
        builder: (context, scrollController) => Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 8, 6),
              child: Row(
                children: [
                  const Icon(Icons.payments_outlined),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '${'Tahsilat Gir'.tr} — ${widget.studentName}',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: _saving
                        ? null
                        : () => Navigator.pop(context, false),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _loadError != null
                  ? _errorView(theme)
                  : ListView(
                      controller: scrollController,
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                      children: _body(theme),
                    ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _saving
                          ? null
                          : () => Navigator.pop(context, false),
                      child: Text('Vazgeç'.tr),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      onPressed:
                          _saving ||
                              _loading ||
                              _loadError != null ||
                              !_validAmount
                          ? null
                          : _submit,
                      icon: _saving
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.payments_rounded, size: 18),
                      label: Text(
                        _saving
                            ? 'Kaydediliyor…'.tr
                            : _validAmount
                            ? '${formatMoney(_amount)} ${'Tahsil Et'.tr}'
                            : 'Tahsilatı Kaydet'.tr,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _errorView(ThemeData theme) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline_rounded, size: 36),
          const SizedBox(height: 10),
          Text(
            '${'Cari hesap bilgisi alınamadı.'.tr}\n$_loadError',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: _load, child: Text('Tekrar dene'.tr)),
        ],
      ),
    ),
  );

  List<Widget> _body(ThemeData theme) {
    final scholarshipPercent = _num(_account?['scholarshipPercent']);
    return [
      // Özet
      GridView.count(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: 2,
        childAspectRatio: 2.6,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        children: [
          _tile(theme, 'Net Ücret', formatMoney(_num(_account?['netTotal']))),
          _tile(
            theme,
            'Tahsil Edilen',
            formatMoney(_num(_account?['paidTotal'])),
            color: const Color(0xFF059669),
          ),
          _tile(
            theme,
            'Kalan',
            formatMoney(_remaining),
            color: _remaining > 0
                ? const Color(0xFFB42318)
                : const Color(0xFF059669),
          ),
          _tile(
            theme,
            'Gecikmiş',
            formatMoney(_overdueTotal),
            color: _overdueTotal > 0 ? const Color(0xFFB42318) : null,
          ),
        ],
      ),

      // Burs rozeti: yalnız burslu öğrencide.
      if (scholarshipPercent > 0) ...[
        const SizedBox(height: 10),
        Container(
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
                child: Text(
                  '%${_plainAmount(scholarshipPercent)} ${'burslu'.tr} • '
                  '${formatMoney(_num(_account?['scholarshipAmount']))} ${'indirim uygulandı'.tr}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],

      // Bekleyen peşinat
      if (_pendingDownPayment > 0) ...[
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFB45309).withValues(alpha: 0.08),
            border: Border.all(
              color: const Color(0xFFB45309).withValues(alpha: 0.4),
            ),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  '${'Peşinat bekliyor'.tr}: ${formatMoney(_pendingDownPayment)}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              TextButton(
                onPressed: _collectingDownPayment || _saving
                    ? null
                    : _collectDownPayment,
                child: Text(_collectingDownPayment ? '…' : 'Tahsil Et'.tr),
              ),
            ],
          ),
        ),
      ],

      const SizedBox(height: 16),
      Text(
        'Taksit planı — ödenecek taksidi seçin'.tr,
        style: theme.textTheme.labelMedium?.copyWith(
          fontWeight: FontWeight.w800,
        ),
      ),
      const SizedBox(height: 8),
      if (_installments.isEmpty)
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border.all(color: theme.dividerColor),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Text(
            'Taksit planı yok — tutarı elle girin, tahsilat açık makbuz olarak kaydedilir.'
                .tr,
            style: theme.textTheme.bodySmall,
          ),
        )
      else
        ..._installments.map((item) => _installmentRow(theme, item)),
      if (_installmentId == null &&
          _installments.any((item) => _num(item['remaining']) > 0))
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(
            'Seçim yapılmazsa tahsilat en eski vadeden başlayarak mahsup edilir.'
                .tr,
            style: theme.textTheme.labelSmall,
          ),
        ),

      const SizedBox(height: 16),
      TextField(
        controller: _amountController,
        enabled: !_saving,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        onChanged: (_) => setState(() {}),
        decoration: InputDecoration(
          labelText: 'Tahsil edilecek tutar (TL)'.tr,
          border: const OutlineInputBorder(),
        ),
        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
      ),
      if (_overpaying)
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(
            '${'Kalan borç'.tr} ${formatMoney(_remaining)}. '
            '${'Aşan tutar makbuza avans olarak düşer.'.tr}',
            style: theme.textTheme.labelSmall?.copyWith(
              color: const Color(0xFFB45309),
              fontWeight: FontWeight.w800,
            ),
          ),
        ),

      const SizedBox(height: 12),
      Text(
        'Ödeme yöntemi'.tr,
        style: theme.textTheme.labelMedium?.copyWith(
          fontWeight: FontWeight.w800,
        ),
      ),
      const SizedBox(height: 6),
      Wrap(
        spacing: 8,
        children: _methods
            .map(
              (item) => ChoiceChip(
                label: Text(item),
                selected: _method == item,
                onSelected: _saving
                    ? null
                    : (_) => setState(() => _method = item),
              ),
            )
            .toList(),
      ),

      const SizedBox(height: 12),
      TextField(
        controller: _noteController,
        enabled: !_saving,
        maxLength: 500,
        decoration: InputDecoration(
          labelText: 'Not (opsiyonel)'.tr,
          hintText: 'Makbuza düşülecek açıklama'.tr,
          border: const OutlineInputBorder(),
        ),
      ),

      if (_payments.isNotEmpty) ...[
        const SizedBox(height: 8),
        Text(
          'Son tahsilatlar'.tr,
          style: theme.textTheme.labelMedium?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 6),
        ..._payments.take(5).map((item) {
          final isRefund =
              item['entryType'] == 'Refund' || _num(item['amount']) < 0;
          final collector = '${item['collectedByName'] ?? ''}';
          final branch = '${item['branchName'] ?? ''}';
          return ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            title: Text(
              '${formatMoney(_num(item['amount']))} · ${isRefund ? 'İade'.tr : item['method']}'
              '${item['receiptNo'] != null ? ' · #${item['receiptNo']}' : ''}',
              style: theme.textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w800,
                color: isRefund ? const Color(0xFFB42318) : null,
              ),
            ),
            subtitle: Text(
              [
                formatDateTime(item['paidAtUtc']),
                if (collector.isNotEmpty) '${'Alan'.tr}: $collector',
                if (branch.isNotEmpty) '${'Şube'.tr}: $branch',
              ].join(' • '),
              style: theme.textTheme.labelSmall,
            ),
          );
        }),
      ],
    ];
  }

  Widget _tile(ThemeData theme, String label, String value, {Color? color}) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          border: Border.all(color: theme.dividerColor),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label.tr, style: theme.textTheme.labelSmall),
            const SizedBox(height: 2),
            Text(
              value,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w900,
                color: color,
              ),
            ),
          ],
        ),
      );

  Widget _installmentRow(ThemeData theme, Map<String, dynamic> item) {
    final remaining = _num(item['remaining']);
    final selectable = remaining > 0;
    final selected = _installmentId == '${item['id']}';
    final due = DateTime.tryParse('${item['dueDateUtc']}');
    final overdue = selectable && due != null && due.isBefore(DateTime.now());
    final statusColor = overdue
        ? const Color(0xFFB42318)
        : selectable
        ? theme.hintColor
        : const Color(0xFF059669);

    return Opacity(
      opacity: selectable ? 1 : 0.55,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Material(
          color: selected
              ? theme.colorScheme.primary.withValues(alpha: 0.08)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: selectable && !_saving ? () => _pickInstallment(item) : null,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: selected
                      ? theme.colorScheme.primary
                      : theme.dividerColor,
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${item['label'] ?? '${item['seqNo']}. Taksit'}'
                          '${overdue
                              ? ' · ${'Gecikmiş'.tr}'
                              : selectable
                              ? ''
                              : ' · ${'Ödendi'.tr}'}',
                          style: theme.textTheme.bodySmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: statusColor,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${'Vade'.tr}: ${formatDate(item['dueDateUtc'])} • '
                          '${'Tutar'.tr}: ${formatMoney(_num(item['amount']))}',
                          style: theme.textTheme.labelSmall,
                        ),
                      ],
                    ),
                  ),
                  Text(
                    selectable ? formatMoney(remaining) : '✓',
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w900,
                      color: statusColor,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
