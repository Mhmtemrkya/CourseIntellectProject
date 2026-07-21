import 'package:flutter/material.dart';

import '../i18n/app_locale.dart';
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
    final overdue = (row['overdueAmount'] as num?)?.toDouble() ?? 0;
    final remaining = (row['remaining'] as num?)?.toDouble() ?? 0;
    final amountCtrl = TextEditingController(
      text: overdue > 0 ? overdue.toStringAsFixed(0) : (remaining > 0 ? remaining.toStringAsFixed(0) : ''),
    );
    final noteCtrl = TextEditingController();
    var method = 'Nakit';
    String? branchId;
    String? installmentId;
    List<Map<String, dynamic>> installments;
    try {
      installments = await _service.installments('${row['profileId']}');
    } catch (_) {
      installments = <Map<String, dynamic>>[];
    }
    if (!mounted) return;

    final done = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setD) => AlertDialog(
          title: Text('${'Ödeme Al'.tr} — ${row['fullName']}'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    '${'Kalan'.tr}: ${_money(row['remaining'])}${overdue > 0 ? ' • ${'Gecikmiş'.tr}: ${_money(overdue)}' : ''}',
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                ),
                DropdownButtonFormField<String?>(
                  initialValue: installmentId,
                  isExpanded: true,
                  decoration: InputDecoration(labelText: 'Taksit'.tr),
                  items: [
                    DropdownMenuItem(value: null, child: Text('Otomatik (en eski vade)'.tr)),
                    ...installments.map((i) => DropdownMenuItem(
                          value: '${i['id']}',
                          child: Text(
                            '${i['label'] ?? '${i['seqNo']}. taksit'} • ${_dateOnly(i['dueDateUtc'])} • ${_money(i['remaining'])}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        )),
                  ],
                  onChanged: (v) => setD(() {
                    installmentId = v;
                    final chosen = installments.where((i) => '${i['id']}' == v).toList();
                    if (chosen.isNotEmpty) {
                      amountCtrl.text = '${(chosen.first['remaining'] as num?)?.toInt() ?? amountCtrl.text}';
                    }
                  }),
                ),
                TextField(
                  controller: amountCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(labelText: '${'Tutar'.tr} (₺)'),
                ),
                DropdownButtonFormField<String>(
                  initialValue: method,
                  decoration: InputDecoration(labelText: 'Yöntem'.tr),
                  items: const ['Nakit', 'Kart', 'Havale']
                      .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                      .toList(),
                  onChanged: (v) => setD(() => method = v ?? 'Nakit'),
                ),
                DropdownButtonFormField<String?>(
                  initialValue: branchId,
                  decoration: InputDecoration(labelText: 'Tahsilat şubesi'.tr),
                  items: [
                    DropdownMenuItem(value: null, child: Text(_branches.isEmpty ? 'Varsayılan'.tr : 'Varsayılan (kendi şubem)'.tr)),
                    ..._branches.map((b) => DropdownMenuItem(value: '${b['id']}', child: Text('${b['name']}'))),
                  ],
                  onChanged: (v) => setD(() => branchId = v),
                ),
                TextField(
                  controller: noteCtrl,
                  decoration: InputDecoration(labelText: 'Not'.tr),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: Text('Vazgeç'.tr)),
            FilledButton(
              onPressed: () async {
                final amount = num.tryParse(amountCtrl.text.trim()) ?? 0;
                if (amount <= 0) return;
                final messenger = ScaffoldMessenger.of(context);
                try {
                  final p = await _service.recordPayment(
                    '${row['profileId']}',
                    amount: amount,
                    method: method,
                    branchId: branchId,
                    financeInstallmentId: installmentId,
                    note: noteCtrl.text.trim(),
                  );
                  if (dialogContext.mounted) Navigator.pop(dialogContext, true);
                  messenger.showSnackBar(
                    SnackBar(content: Text('${'Tahsilat alındı'.tr} • ${p['receiptNo'] ?? ''}')),
                  );
                } catch (e) {
                  messenger.showSnackBar(SnackBar(content: Text('$e')));
                }
              },
              child: Text('Kaydet'.tr),
            ),
          ],
        ),
      ),
    );
    amountCtrl.dispose();
    noteCtrl.dispose();
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
    final hasContract = r['hasContract'] == true;
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
            if (_canCollect && hasContract)
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
