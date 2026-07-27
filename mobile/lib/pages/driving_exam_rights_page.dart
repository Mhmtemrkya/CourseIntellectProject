import 'package:flutter/material.dart';

import '../i18n/app_locale.dart';

import '../services/driving_permissions_store.dart';
import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';

class DrivingExamRightsPage extends StatefulWidget {
  const DrivingExamRightsPage({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<DrivingExamRightsPage> createState() => _DrivingExamRightsPageState();
}

class _DrivingExamRightsPageState extends State<DrivingExamRightsPage> {
  final _service = DrivingSchoolApiService.instance;
  bool _loading = true;
  bool _saving = false;
  Object? _error;
  DrivingPermissionSnapshot _permissions = DrivingPermissionSnapshot.empty;
  Map<String, dynamic> _data = const {};
  String _search = '';

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
      final permissions = await DrivingPermissionsStore.instance.load();
      if (!permissions.can(DrivingPermissions.examView)) {
        throw StateError('Sınav haklarını görüntüleme yetkiniz bulunmuyor.');
      }
      final data = await _service.examRights();
      if (!mounted) return;
      setState(() {
        _permissions = permissions;
        _data = data;
      });
    } catch (error) {
      if (mounted) setState(() => _error = error);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> _rows(String key) =>
      (_data[key] as List? ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();

  String _date(dynamic raw) {
    final date = DateTime.tryParse('${raw ?? ''}')?.toLocal();
    if (date == null) return '—';
    String two(int value) => '$value'.padLeft(2, '0');
    return '${two(date.day)}.${two(date.month)}.${date.year}';
  }

  String _typeLabel(dynamic type) =>
      '$type' == 'DrivingPractice' ? 'Direksiyon' : 'Teorik';

  @override
  Widget build(BuildContext context) {
    final content = _loading
        ? const Center(child: CircularProgressIndicator())
        : _error != null
        ? DrivingErrorState(error: _error!, onRetry: _load)
        : _content();

    if (widget.embedded) return content;
    return DrivingScaffold(
      appBar: AppBar(title: const Text('Sınav Hakları')),
      child: content,
    );
  }

  Widget _content() {
    final students = _rows('students');
    final attempts = _rows('attempts');
    final query = _search.trim().toLowerCase();
    final visibleStudents = students.where((student) {
      if (query.isEmpty) return true;
      return '${student['fullName']} ${student['studentNumber']} ${student['licenseClass']}'
          .toLowerCase()
          .contains(query);
    }).toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        children: [
          DrivingHero(
            eyebrow: 'SINAV TAKİBİ',
            title: 'Sınav Hakları',
            description:
                'Geçilen sınav türü otomatik kilitlenir; yeni sonuç girişi sunucu tarafından da engellenir.',
            icon: Icons.fact_check_rounded,
            metrics: [
              DrivingHeroMetric(label: 'Kursiyer', value: '${students.length}'),
              const SizedBox(width: 10),
              DrivingHeroMetric(
                label: 'Sınav Kaydı',
                value: '${attempts.length}',
              ),
              const SizedBox(width: 10),
              DrivingHeroMetric(
                label: 'Başarılı',
                value:
                    '${attempts.where((item) => item['status'] == 'Passed').length}',
              ),
            ],
          ),
          const SizedBox(height: 14),
          TextField(
            onChanged: (value) => setState(() => _search = value),
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search_rounded),
              hintText: 'Kursiyer adı, numarası veya ehliyet sınıfı ara...',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
          const SizedBox(height: 14),
          if (visibleStudents.isEmpty)
            const DrivingEmptyState(
              icon: Icons.person_search_rounded,
              title: 'Eşleşen kursiyer bulunamadı.',
            )
          else
            ...visibleStudents.map(_studentCard),
          const SizedBox(height: 18),
          const DrivingSectionTitle(title: 'Sınav Geçmişi'),
          const SizedBox(height: 8),
          if (attempts.isEmpty)
            const DrivingEmptyState(
              icon: Icons.history_rounded,
              title: 'Henüz sınav sonucu girilmedi.',
            )
          else
            ...attempts.map((attempt) => _historyRow(attempt, students)),
        ],
      ),
    );
  }

  Widget _studentCard(Map<String, dynamic> student) => Card(
    margin: const EdgeInsets.only(bottom: 12),
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const CircleAvatar(child: Icon(Icons.person_rounded)),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${student['fullName'] ?? 'Kursiyer'}',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    Text(
                      '#${student['studentNumber'] ?? '—'} • ${student['licenseClass'] ?? '—'}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (context, constraints) {
              final narrow = constraints.maxWidth < 430;
              final cards = [
                _rightCard(
                  student,
                  'TheoryEExam',
                  'Teorik',
                  Map<String, dynamic>.from(
                    student['theory'] as Map? ?? const {},
                  ),
                ),
                _rightCard(
                  student,
                  'DrivingPractice',
                  'Direksiyon',
                  Map<String, dynamic>.from(
                    student['practice'] as Map? ?? const {},
                  ),
                ),
              ];
              return narrow
                  ? Column(
                      children: [
                        cards[0],
                        const SizedBox(height: 10),
                        cards[1],
                      ],
                    )
                  : Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: cards[0]),
                        const SizedBox(width: 10),
                        Expanded(child: cards[1]),
                      ],
                    );
            },
          ),
          const SizedBox(height: 12),
          _examFeeSection(student),
        ],
      ),
    ),
  );

  Future<void> _openFeeSheet(Map<String, dynamic> student) async {
    final theoryCtrl = TextEditingController(
        text: (student['theoryExamFee'] as num?)?.toStringAsFixed(0) ?? '0');
    final drivingCtrl = TextEditingController(
        text: (student['drivingExamFee'] as num?)?.toStringAsFixed(0) ?? '0');
    var theoryPaid = student['theoryExamFeePaid'] == true;
    var drivingPaid = student['drivingExamFeePaid'] == true;
    var saving = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(
              16, 16, 16, MediaQuery.of(sheetContext).viewInsets.bottom + 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${'Sınav Ücretleri'.tr} — ${student['fullName'] ?? ''}',
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
              const SizedBox(height: 4),
              Text(
                'Bu ücretler kurs paketine ve taksitlere dâhil değildir; ayrı tahsil edilir.'.tr,
                style: Theme.of(sheetContext).textTheme.bodySmall,
              ),
              const SizedBox(height: 14),
              for (final item in [
                ['Teorik (e-sınav) ücreti'.tr, theoryCtrl, true],
                ['Direksiyon sınav ücreti'.tr, drivingCtrl, false],
              ]) ...[
                Text(item[0] as String,
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: item[1] as TextEditingController,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          isDense: true,
                          prefixText: '₺',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onChanged: (_) => setSheetState(() {}),
                      ),
                    ),
                    const SizedBox(width: 10),
                    // Ücret girilmeden "ödendi" işaretlenemez.
                    Switch(
                      value: (item[2] as bool) ? theoryPaid : drivingPaid,
                      onChanged: (double.tryParse(
                                  (item[1] as TextEditingController).text.trim()) ??
                              0) >
                          0
                          ? (value) => setSheetState(() {
                                if (item[2] as bool) {
                                  theoryPaid = value;
                                } else {
                                  drivingPaid = value;
                                }
                              })
                          : null,
                    ),
                    Text((item[2] as bool)
                        ? (theoryPaid ? 'Ödendi'.tr : 'Bekliyor'.tr)
                        : (drivingPaid ? 'Ödendi'.tr : 'Bekliyor'.tr)),
                  ],
                ),
                const SizedBox(height: 12),
              ],
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: saving
                      ? null
                      : () async {
                          setSheetState(() => saving = true);
                          final theory = double.tryParse(theoryCtrl.text.trim()) ?? 0;
                          final driving = double.tryParse(drivingCtrl.text.trim()) ?? 0;
                          try {
                            await _service.updateExamFees(
                              '${student['profileId']}',
                              theoryExamFee: theory,
                              drivingExamFee: driving,
                              theoryExamFeePaid: theory > 0 && theoryPaid,
                              drivingExamFeePaid: driving > 0 && drivingPaid,
                              drivingExamDate: student['drivingExamDate'] as String?,
                            );
                            if (sheetContext.mounted) Navigator.pop(sheetContext);
                            await _load();
                          } catch (error) {
                            setSheetState(() => saving = false);
                            if (sheetContext.mounted) {
                              ScaffoldMessenger.of(sheetContext).showSnackBar(
                                SnackBar(content: Text('$error')),
                              );
                            }
                          }
                        },
                  child: Text(saving ? 'Kaydediliyor…'.tr : 'Kaydet'.tr),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    theoryCtrl.dispose();
    drivingCtrl.dispose();
  }

  /// Sınav ücretleri paket dışıdır: kurs ücretine ve taksitlere eklenmez,
  /// ayrı tahsil edilir. Ödeme durumu buradan güncellenebilir.
  Widget _examFeeSection(Map<String, dynamic> student) {
    final canEditFees = _permissions.can(DrivingPermissions.financeCollect);
    final theoryFee = (student['theoryExamFee'] as num?)?.toDouble() ?? 0;
    final drivingFee = (student['drivingExamFee'] as num?)?.toDouble() ?? 0;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Theme.of(context).dividerColor),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.payments_rounded, size: 18),
              const SizedBox(width: 6),
              Expanded(
                child: Text('Sınav ücretleri'.tr,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
              ),
              if (canEditFees)
                TextButton.icon(
                  onPressed: () => _openFeeSheet(student),
                  icon: const Icon(Icons.edit_rounded, size: 16),
                  label: Text('Düzenle'.tr),
                ),
            ],
          ),
          const SizedBox(height: 6),
          _feeRow('Teorik'.tr, theoryFee, student['theoryExamFeePaid'] == true),
          const SizedBox(height: 4),
          _feeRow('Direksiyon'.tr, drivingFee, student['drivingExamFeePaid'] == true),
          const SizedBox(height: 6),
          Text('Kurs ücretine ve taksitlere dâhil değildir.'.tr,
              style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }

  Widget _feeRow(String label, double fee, bool paid) => Row(
    children: [
      Expanded(child: Text(label, style: Theme.of(context).textTheme.bodySmall)),
      if (fee > 0) ...[
        Text('₺${fee.toStringAsFixed(0)}',
            style: const TextStyle(fontWeight: FontWeight.w800)),
        const SizedBox(width: 8),
        DrivingStatusPill(
          label: paid ? 'Ödendi'.tr : 'Bekliyor'.tr,
          tone: paid ? DrivingTone.success : DrivingTone.warning,
        ),
      ] else
        Text('Ücret girilmedi'.tr, style: Theme.of(context).textTheme.bodySmall),
    ],
  );

  Widget _rightCard(
    Map<String, dynamic> student,
    String examType,
    String label,
    Map<String, dynamic> right,
  ) {
    final passed = right['passed'] == true;
    final used = (right['used'] as num?)?.toInt() ?? 0;
    final max = (right['max'] as num?)?.toInt() ?? 4;
    final exhausted = used >= max;
    final canEnter =
        _permissions.can(DrivingPermissions.examResultEnter) &&
        !passed &&
        !exhausted;
    final color = passed
        ? Colors.green
        : exhausted
        ? Colors.red
        : Theme.of(context).colorScheme.primary;

    return Opacity(
      opacity: passed ? .72 : 1,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: .07),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: .25)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
                Chip(
                  avatar: Icon(
                    passed ? Icons.check_circle_rounded : Icons.timer_rounded,
                    size: 16,
                    color: color,
                  ),
                  label: Text(passed ? 'Geçti' : '$used/$max hak'),
                ),
              ],
            ),
            Text('Kalan hak: ${right['remaining'] ?? max - used}'),
            Text('Son puan: ${right['lastScore'] ?? '—'}'),
            Text('Son tarih: ${_date(right['lastExamDateUtc'])}'),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: canEnter
                    ? () => _enterResult(student, examType, used + 1)
                    : null,
                icon: Icon(
                  passed ? Icons.lock_rounded : Icons.add_task_rounded,
                  size: 18,
                ),
                label: Text(
                  passed
                      ? 'Sınav Geçildi'
                      : exhausted
                      ? 'Hak Doldu'
                      : 'Sonuç Gir',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _historyRow(
    Map<String, dynamic> attempt,
    List<Map<String, dynamic>> students,
  ) {
    final student = students.cast<Map<String, dynamic>?>().firstWhere(
      (item) =>
          '${item?['profileId']}' == '${attempt['studentDrivingProfileId']}',
      orElse: () => null,
    );
    final passed = attempt['status'] == 'Passed';
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: (passed ? Colors.green : Colors.red).withValues(
            alpha: .12,
          ),
          child: Icon(
            passed ? Icons.check_rounded : Icons.close_rounded,
            color: passed ? Colors.green : Colors.red,
          ),
        ),
        title: Text(
          '${student?['fullName'] ?? 'Kursiyer'}',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        subtitle: Text(
          '${_typeLabel(attempt['examType'])} • ${attempt['attemptNo']}. giriş • ${_date(attempt['examDateUtc'])}',
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              '${attempt['score'] ?? '—'} puan',
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
            Text(
              passed ? 'Geçti' : 'Kaldı',
              style: TextStyle(
                color: passed ? Colors.green : Colors.red,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _enterResult(
    Map<String, dynamic> student,
    String examType,
    int attemptNo,
  ) async {
    final scoreController = TextEditingController(text: '70');
    var passed = true;
    var examDate = DateTime.now();
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      barrierDismissible: !_saving,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setLocal) => AlertDialog(
          title: Text('${student['fullName']} • ${_typeLabel(examType)}'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('$attemptNo. sınav hakkı'),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: passed,
                  title: Text(passed ? 'Geçti' : 'Kaldı'),
                  onChanged: (value) => setLocal(() => passed = value),
                ),
                TextField(
                  controller: scoreController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  decoration: const InputDecoration(labelText: 'Puan (0-100)'),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Sınav tarihi'),
                  subtitle: Text(_date(examDate.toIso8601String())),
                  trailing: const Icon(Icons.calendar_month_rounded),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: examDate,
                      firstDate: DateTime.now().subtract(
                        const Duration(days: 3650),
                      ),
                      lastDate: DateTime.now().add(const Duration(days: 730)),
                    );
                    if (picked != null) setLocal(() => examDate = picked);
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Vazgeç'),
            ),
            FilledButton(
              onPressed: () {
                final score = double.tryParse(
                  scoreController.text.replaceAll(',', '.'),
                );
                if (score == null || score < 0 || score > 100) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Puan 0-100 arasında olmalıdır.'),
                    ),
                  );
                  return;
                }
                Navigator.pop(dialogContext, {
                  'score': score,
                  'passed': passed,
                  'examDate': examDate,
                });
              },
              child: const Text('Güvenli Kaydet'),
            ),
          ],
        ),
      ),
    );
    if (result == null || !mounted) return;

    setState(() => _saving = true);
    try {
      final date = result['examDate'] as DateTime;
      await _service.saveExamRight({
        'candidateId': null,
        'studentProfileId': '${student['profileId']}',
        'examType': examType,
        'attemptNo': attemptNo,
        'score': result['score'],
        'passed': result['passed'],
        'examDateUtc': DateTime(
          date.year,
          date.month,
          date.day,
          12,
        ).toUtc().toIso8601String(),
      });
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Sınav sonucu kaydedildi.')));
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$error'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}
