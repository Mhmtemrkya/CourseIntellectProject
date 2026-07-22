import 'package:flutter/material.dart';

import '../i18n/app_locale.dart';
import '../services/auth_session_store.dart';
import '../services/driving_permissions_store.dart';
import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';

const _statusLabels = {
  'PreRegistered': 'Ön kayıt', 'DocumentsPending': 'Evrak bekliyor', 'Active': 'Aktif',
  'TheoryOngoing': 'Teorik', 'PracticeOngoing': 'Direksiyon', 'ExamPending': 'Sınav bekliyor',
  'GraduationPending': 'Mezuniyet onayı', 'Graduated': 'Mezun', 'Suspended': 'Askıda', 'Cancelled': 'İptal',
};

String _money(dynamic v) {
  final n = v is num ? v : num.tryParse('${v ?? ''}') ?? 0;
  return '₺${n.toStringAsFixed(0)}';
}

String _dateOnly(dynamic value) {
  final d = DateTime.tryParse('${value ?? ''}');
  if (d == null) return '—';
  final l = d.toLocal();
  return '${l.day.toString().padLeft(2, '0')}.${l.month.toString().padLeft(2, '0')}.${l.year}';
}

double _num(dynamic v) => v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;

/// Ödeme Al: tüm kursiyerler finans özetiyle; aktif → mezun → pasif, taksidi en
/// önde olan başta. Tahsilat istenen şubeden alınır (şube-farkındalı).
class DrivingCollectionPage extends StatefulWidget {
  const DrivingCollectionPage({super.key});

  @override
  State<DrivingCollectionPage> createState() => _DrivingCollectionPageState();
}

class _DrivingCollectionPageState extends State<DrivingCollectionPage> {
  final _service = DrivingSchoolApiService.instance;
  bool _loading = true;
  Object? _error;
  List<Map<String, dynamic>> _rows = [];
  List<Map<String, dynamic>> _branches = [];
  List<Map<String, dynamic>> _groups = [];
  String _bucket = 'active';
  String _groupId = 'all';
  String _search = '';
  bool _canCollect = false;
  // Peşinatı beklenen (tahsil edilmemiş) sözleşmeler.
  List<Map<String, dynamic>> _pending = [];

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
      final rows = await _service.collectionList(
        bucket: _bucket == 'all' ? null : _bucket,
        groupId: _groupId == 'all' || _groupId == 'ungrouped' ? null : _groupId,
        ungrouped: _groupId == 'ungrouped',
      );
      List<Map<String, dynamic>> branches;
      try {
        branches = await _service.branches();
      } catch (_) {
        branches = <Map<String, dynamic>>[];
      }
      final perms = await DrivingPermissionsStore.instance.load();
      Map<String, dynamic>? groupData;
      try {
        groupData = await _service.studentGroups();
      } catch (_) {
        groupData = null;
      }
      List<Map<String, dynamic>> pending;
      try {
        pending = await _service.pendingDownPayments();
      } catch (_) {
        pending = <Map<String, dynamic>>[];
      }
      if (!mounted) return;
      setState(() {
        _rows = rows;
        _branches = branches;
        _canCollect = perms.can(DrivingPermissions.financeCollect);
        _pending = pending;
        _groups = ((groupData?['groups'] as List?) ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filtered {
    final term = _search.trim().toLowerCase();
    if (term.isEmpty) return _rows;
    return _rows.where((r) => '${r['fullName'] ?? ''}'.toLowerCase().contains(term)).toList();
  }

  Future<void> _collect(Map<String, dynamic> row) async {
    final done = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _PaymentSheet(
        service: _service,
        profileId: '${row['profileId']}',
        fullName: '${row['fullName']}',
        studentNumber: row['studentNumber'],
        registrationBranchName: '${row['registrationBranchName'] ?? '—'}',
        branches: _branches,
      ),
    );
    if (done == true) _load();
  }

  Future<void> _collectPending(Map<String, dynamic> row) async {
    var method = 'Nakit';
    final messenger = ScaffoldMessenger.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setD) => AlertDialog(
          title: Text('${'Peşinatı Tahsil Et'.tr} — ${row['studentName']}'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  '${'Beklenen peşinat'.tr}: ${_money(row['downPayment'])}',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: method,
                isExpanded: true,
                decoration: InputDecoration(
                  labelText: 'Ödeme yöntemi'.tr,
                  border: const OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'Nakit', child: Text('Nakit')),
                  DropdownMenuItem(value: 'Kart', child: Text('Kart / POS')),
                  DropdownMenuItem(value: 'Havale', child: Text('Havale / EFT')),
                ],
                onChanged: (v) => setD(() => method = v ?? 'Nakit'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: Text('Vazgeç'.tr)),
            FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: Text('Tahsil Et'.tr)),
          ],
        ),
      ),
    );
    if (confirmed != true) return;
    try {
      await _service.collectDownPayment('${row['contractId']}', method);
      messenger.showSnackBar(
        SnackBar(content: Text('Peşinat tahsil edildi — makbuz kesildi.'.tr)),
      );
      _load();
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Widget _buildPendingDownPayments() {
    final total = _pending.fold<double>(
      0,
      (sum, r) => sum + ((r['downPayment'] as num?)?.toDouble() ?? 0),
    );
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.red.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.red.withValues(alpha: 0.30)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.cancel, color: Colors.red, size: 20),
              const SizedBox(width: 6),
              Text('Peşinat Bekleyenler'.tr, style: const TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text('${_pending.length}', style: const TextStyle(color: Colors.red, fontWeight: FontWeight.w800, fontSize: 12)),
              ),
              const Spacer(),
              Text(_money(total), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 8),
          ..._pending.map((row) => Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${row['studentName']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                          Text(
                            '${'Beklenen'.tr}: ${_money(row['downPayment'])}${(row['className'] ?? '').toString().isNotEmpty ? ' • ${row['className']}' : ''}',
                            style: const TextStyle(fontSize: 12, color: Colors.grey),
                          ),
                        ],
                      ),
                    ),
                    if (_canCollect)
                      FilledButton.tonal(
                        onPressed: () => _collectPending(row),
                        child: Text('Tahsil Et'.tr),
                      ),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DrivingScaffold(
      appBar: AppBar(title: Text('Ödeme Al'.tr)),
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? DrivingErrorState(error: _error!, onRetry: _load)
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_pending.isNotEmpty) ...[
                    _buildPendingDownPayments(),
                    const SizedBox(height: 12),
                  ],
                  TextField(
                    onChanged: (v) => setState(() => _search = v),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search_rounded),
                      hintText: 'Kursiyer ara...'.tr,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 38,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        for (final b in const [
                          ['active', 'Aktif'],
                          ['graduated', 'Mezun'],
                          ['passive', 'Pasif'],
                          ['all', 'Tümü'],
                        ])
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ChoiceChip(
                              selected: _bucket == b[0],
                              onSelected: (_) {
                                setState(() => _bucket = b[0]);
                                _load();
                              },
                              label: Text(b[1].tr),
                              showCheckmark: false,
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    initialValue: _groupId,
                    isExpanded: true,
                    decoration: InputDecoration(
                      isDense: true,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    items: [
                      DropdownMenuItem(value: 'all', child: Text('Tüm gruplar'.tr)),
                      DropdownMenuItem(value: 'ungrouped', child: Text('Beklemede'.tr)),
                      ..._groups.map((g) => DropdownMenuItem(value: '${g['id']}', child: Text('${g['name']}'))),
                    ],
                    onChanged: (v) {
                      setState(() => _groupId = v ?? 'all');
                      _load();
                    },
                  ),
                  const SizedBox(height: 12),
                  if (_filtered.isEmpty)
                    DrivingEmptyState(icon: Icons.check_circle_rounded, title: 'Kayıt yok.'.tr)
                  else
                    ..._filtered.map(_row),
                ],
              ),
            ),
    );
  }

  Widget _row(Map<String, dynamic> r) {
    final overdue = (r['overdueAmount'] as num?)?.toDouble() ?? 0;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (r['studentNumber'] != null) ...[
                        Text('#${r['studentNumber']}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11, color: Colors.grey)),
                        const SizedBox(width: 4),
                      ],
                      Flexible(child: Text('${r['fullName']}', style: const TextStyle(fontWeight: FontWeight.w800))),
                      const SizedBox(width: 6),
                      DrivingStatusPill(label: _statusLabels['${r['status']}'] ?? '${r['status']}', tone: DrivingTone.accent),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${r['nextDueDateUtc'] != null ? '${'Vade'.tr}: ${_dateOnly(r['nextDueDateUtc'])}' : 'Vade yok'.tr} • ${'Kayıt'.tr}: ${r['registrationBranchName'] ?? '—'}',
                    style: const TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(_money(r['remaining']), style: const TextStyle(fontWeight: FontWeight.w900)),
                      if (overdue > 0) ...[
                        const SizedBox(width: 8),
                        Text('${_money(overdue)} ${'gecikmiş'.tr}', style: const TextStyle(fontSize: 12, color: Colors.red, fontWeight: FontWeight.w700)),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            if (_canCollect)
              FilledButton.icon(
                onPressed: () => _collect(r),
                icon: const Icon(Icons.payments_rounded, size: 16),
                label: Text('Ödeme Al'.tr),
              ),
          ],
        ),
      ),
    );
  }
}

/// Profesyonel "Ödeme Al" sayfası (bottom sheet): sözleşme özeti, peşinat durumu,
/// tıklanabilir taksit planı ve tahsilat formu. Sözleşmesiz kursiyerde açık makbuz.
class _PaymentSheet extends StatefulWidget {
  const _PaymentSheet({
    required this.service,
    required this.profileId,
    required this.fullName,
    required this.studentNumber,
    required this.registrationBranchName,
    required this.branches,
  });

  final DrivingSchoolApiService service;
  final String profileId;
  final String fullName;
  final dynamic studentNumber;
  final String registrationBranchName;
  final List<Map<String, dynamic>> branches;

  @override
  State<_PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends State<_PaymentSheet> {
  final _amountCtrl = TextEditingController();
  final _noteCtrl = TextEditingController();
  Map<String, dynamic>? _ctx;
  bool _loading = true;
  String _method = 'Nakit';
  String? _branchId;
  String? _installmentId;
  bool _saving = false;
  bool _collectingDp = false;
  String _collectorName = '';

  @override
  void initState() {
    super.initState();
    _load();
    _loadCollector();
  }

  Future<void> _loadCollector() async {
    try {
      final session = await AuthSessionStore.instance.load();
      if (!mounted || session == null) return;
      setState(() => _collectorName = session.fullName);
    } catch (_) {
      // Oturum adı çözülemezse tahsilat yine çalışır; ad boş kalır.
    }
  }

  List<Map<String, dynamic>> get _recentPayments =>
      ((_ctx?['recentPayments'] as List?) ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

  @override
  void dispose() {
    _amountCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final ctx = await widget.service.paymentContext(widget.profileId);
      if (!mounted) return;
      final overdue = _num(ctx['overdueTotal']);
      final remaining = _num(ctx['remaining']);
      _amountCtrl.text = overdue > 0
          ? overdue.toStringAsFixed(0)
          : (remaining > 0 ? remaining.toStringAsFixed(0) : '');
      setState(() {
        _ctx = ctx;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _ctx = {'hasContract': false, 'installments': const []};
        _loading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _installments =>
      ((_ctx?['installments'] as List?) ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();

  Future<void> _collectDownPayment() async {
    setState(() => _collectingDp = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final p = await widget.service
          .collectStudentDownPayment(widget.profileId, _method);
      messenger.showSnackBar(SnackBar(
          content: Text('${'Peşinat tahsil edildi'.tr} • ${p['receiptNo'] ?? ''}')));
      await _load();
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _collectingDp = false);
    }
  }

  Future<void> _save() async {
    final amount = num.tryParse(_amountCtrl.text.trim()) ?? 0;
    if (amount <= 0) return;
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    try {
      final p = await widget.service.recordPayment(
        widget.profileId,
        amount: amount,
        method: _method,
        branchId: _branchId,
        financeInstallmentId: _installmentId,
        note: _noteCtrl.text.trim(),
      );
      messenger.showSnackBar(SnackBar(
          content: Text('${'Tahsilat alındı'.tr} • ${p['receiptNo'] ?? ''}')));
      navigator.pop(true);
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('$e')));
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ctx = _ctx;
    final hasContract = ctx?['hasContract'] == true;
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 4,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: _loading
          ? const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(child: CircularProgressIndicator()),
            )
          : SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.payments_rounded, color: Colors.indigo),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '${'Ödeme Al'.tr} — ${widget.fullName}',
                          style: const TextStyle(
                              fontWeight: FontWeight.w900, fontSize: 16),
                        ),
                      ),
                      if (widget.studentNumber != null)
                        Text('#${widget.studentNumber}',
                            style: const TextStyle(
                                fontWeight: FontWeight.w900,
                                color: Colors.grey)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (hasContract) ...[
                    Row(
                      children: [
                        _tile('Net'.tr, _money(ctx?['netAmount'])),
                        _tile('Ödenen'.tr, _money(ctx?['paidTotal']),
                            color: Colors.green),
                        _tile('Kalan'.tr, _money(ctx?['remaining']),
                            color: _num(ctx?['remaining']) > 0
                                ? Colors.red
                                : Colors.green),
                        _tile('Gecikmiş'.tr, _money(ctx?['overdueTotal']),
                            color: _num(ctx?['overdueTotal']) > 0
                                ? Colors.red
                                : null),
                      ],
                    ),
                    if (_num(ctx?['downPayment']) > 0) ...[
                      const SizedBox(height: 10),
                      if (ctx?['downPaymentPending'] == true)
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.amber.withValues(alpha: 0.10),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                                color: Colors.amber.withValues(alpha: 0.5)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.cancel,
                                  color: Colors.orange, size: 18),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  '${'Peşinat bekliyor'.tr}: ${_money(ctx?['downPayment'])}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700),
                                ),
                              ),
                              FilledButton.tonal(
                                onPressed:
                                    _collectingDp ? null : _collectDownPayment,
                                child: _collectingDp
                                    ? const SizedBox(
                                        width: 14,
                                        height: 14,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2))
                                    : Text('Peşinatı Al'.tr),
                              ),
                            ],
                          ),
                        )
                      else
                        Row(
                          children: [
                            const Icon(Icons.check_circle,
                                color: Colors.green, size: 18),
                            const SizedBox(width: 6),
                            Text(
                              '${'Peşinat ödendi'.tr} (${_money(ctx?['downPayment'])})',
                              style: TextStyle(color: Colors.green.shade700),
                            ),
                          ],
                        ),
                    ],
                    const SizedBox(height: 12),
                    if (_installments.isNotEmpty) ...[
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text('Taksit planı — ödenecek taksidi seçin'.tr,
                            style: const TextStyle(
                                fontSize: 12, fontWeight: FontWeight.w700)),
                      ),
                      const SizedBox(height: 6),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxHeight: 220),
                        child: ListView(
                          shrinkWrap: true,
                          children: _installments.map(_installmentTile).toList(),
                        ),
                      ),
                      const SizedBox(height: 8),
                    ],
                  ] else
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.blue.withValues(alpha: 0.06),
                        borderRadius: BorderRadius.circular(12),
                        border:
                            Border.all(color: Colors.blue.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        'Bu kursiyerin sözleşmesi yok — açık tahsilat (makbuz) alınıyor.'
                            .tr,
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _amountCtrl,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w800),
                    decoration: InputDecoration(
                      labelText: '${'Tahsil edilecek tutar'.tr} (₺)',
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: _method,
                    decoration: InputDecoration(
                        labelText: 'Ödeme yöntemi'.tr,
                        border: const OutlineInputBorder()),
                    items: const ['Nakit', 'Kart', 'Havale']
                        .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                        .toList(),
                    onChanged: (v) => setState(() => _method = v ?? 'Nakit'),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String?>(
                    initialValue: _branchId,
                    decoration: InputDecoration(
                        labelText: 'Tahsilat şubesi'.tr,
                        border: const OutlineInputBorder()),
                    items: [
                      DropdownMenuItem(
                          value: null,
                          child: Text(widget.branches.isEmpty
                              ? 'Varsayılan'.tr
                              : 'Varsayılan (kendi şubem)'.tr)),
                      ...widget.branches.map((b) => DropdownMenuItem(
                          value: '${b['id']}', child: Text('${b['name']}'))),
                    ],
                    onChanged: (v) => setState(() => _branchId = v),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _noteCtrl,
                    decoration: InputDecoration(
                        labelText: 'Not (opsiyonel)'.tr,
                        border: const OutlineInputBorder()),
                  ),
                  const SizedBox(height: 6),
                  // Tahsilatı yapan personel otomatik: makbuz bu kişinin adına düşer.
                  Row(
                    children: [
                      const Icon(Icons.account_balance_wallet_outlined,
                          size: 14, color: Colors.grey),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          '${'Tahsilatı alan'.tr}: ${_collectorName.isEmpty ? 'Ben'.tr : _collectorName}',
                          style: const TextStyle(
                              fontSize: 11, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text('${'Kayıt şubesi'.tr}: ${widget.registrationBranchName}',
                      style: const TextStyle(fontSize: 11, color: Colors.grey)),
                  if (_recentPayments.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text('Tahsilat geçmişi'.tr,
                        style: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    ..._recentPayments.map(_recentPaymentTile),
                  ],
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: _saving
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child:
                                  CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.check_rounded),
                      label: Text('Tahsilatı Kaydet'.tr),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _recentPaymentTile(Map<String, dynamic> p) {
    final amount = _num(p['amount']);
    final method = '${p['method'] ?? ''}';
    final collectedBy = '${p['collectedByName'] ?? ''}';
    final branch = '${p['branchName'] ?? ''}';
    final parts = <String>[
      if (collectedBy.isNotEmpty) '${'Alan'.tr}: $collectedBy',
      if (branch.isNotEmpty) '${'Şube'.tr}: $branch',
    ];
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('₺${amount.toStringAsFixed(0)}',
                  style: const TextStyle(fontWeight: FontWeight.w900)),
              const SizedBox(width: 6),
              if (method.isNotEmpty)
                Text(method,
                    style:
                        const TextStyle(fontSize: 11, color: Colors.grey)),
            ],
          ),
          if (parts.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(parts.join(' • '),
                style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ],
      ),
    );
  }

  Widget _tile(String label, String value, {Color? color}) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 2),
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.grey.withValues(alpha: 0.25)),
        ),
        child: Column(
          children: [
            Text(label,
                style: const TextStyle(fontSize: 10, color: Colors.grey)),
            const SizedBox(height: 2),
            Text(value,
                style: TextStyle(
                    fontSize: 12, fontWeight: FontWeight.w900, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _installmentTile(Map<String, dynamic> i) {
    final remaining = _num(i['remaining']);
    final overdue = i['overdue'] == true;
    final selectable = remaining > 0;
    final selected = _installmentId == '${i['id']}';
    final status = '${i['status']}';
    final statusLabel = overdue
        ? 'Gecikmiş'.tr
        : status == 'Paid'
            ? 'Ödendi'.tr
            : status == 'Partial'
                ? 'Kısmi'.tr
                : 'Bekliyor'.tr;
    final statusColor = overdue || status == 'Pending'
        ? (overdue ? Colors.red : Colors.grey)
        : status == 'Paid'
            ? Colors.green
            : Colors.orange;
    return Opacity(
      opacity: selectable ? 1 : 0.55,
      child: InkWell(
        onTap: selectable
            ? () => setState(() {
                  if (selected) {
                    _installmentId = null;
                    final rem = _num(_ctx?['remaining']);
                    _amountCtrl.text = rem > 0 ? rem.toStringAsFixed(0) : '';
                  } else {
                    _installmentId = '${i['id']}';
                    _amountCtrl.text = remaining.toStringAsFixed(0);
                  }
                })
            : null,
        child: Container(
          margin: const EdgeInsets.only(bottom: 6),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? Colors.indigo : Colors.grey.withValues(alpha: 0.25),
              width: selected ? 1.5 : 1,
            ),
            color: selected ? Colors.indigo.withValues(alpha: 0.06) : null,
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text('${i['label'] ?? '${i['seqNo']}. Taksit'}',
                            style:
                                const TextStyle(fontWeight: FontWeight.w800)),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: statusColor.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(statusLabel,
                              style: TextStyle(
                                  fontSize: 10,
                                  color: statusColor,
                                  fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ),
                    Text(
                      '${'Vade'.tr}: ${_dateOnly(i['dueDateUtc'])} • ${_money(i['amount'])}',
                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                    ),
                  ],
                ),
              ),
              Text(
                remaining > 0 ? _money(remaining) : '✓',
                style: TextStyle(
                    fontWeight: FontWeight.w900,
                    color: remaining > 0 ? Colors.red : Colors.green),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
