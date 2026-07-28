import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';

import '../services/driving_school_api_service.dart';
import '../services/driving_permissions_store.dart';
import '../widgets/consent_completion_gate.dart';
import '../widgets/driving_ui.dart';

/// "Bugün" sekmesi: seçili günün direksiyon randevuları. Randevu saati geçince
/// backend otomatik "Tamamlandı" yapıp süreyi işler; burada geldi/gelmedi ile
/// teyit edilir. "Gelmedi" süreyi pakete iade eder (düşmez). Kendi verisini
/// yükler, desktop DrivingTodayAppointments ile paritelidir.
class DrivingTodayAttendanceTab extends StatefulWidget {
  const DrivingTodayAttendanceTab({super.key});

  @override
  State<DrivingTodayAttendanceTab> createState() =>
      _DrivingTodayAttendanceTabState();
}

class _DrivingTodayAttendanceTabState extends State<DrivingTodayAttendanceTab> {
  bool _loading = true, _saving = false;
  String? _error;
  Map<String, dynamic> _data = const {};
  DateTime _day = DateTime.now();
  DrivingPermissionSnapshot _permissions = DrivingPermissionSnapshot.empty;

  bool get _canMark =>
      _permissions.can(DrivingPermissions.lessonMarkNoShow);

  String get _dateParam =>
      '${_day.year.toString().padLeft(4, '0')}-${_day.month.toString().padLeft(2, '0')}-${_day.day.toString().padLeft(2, '0')}';

  List<Map<String, dynamic>> get _items =>
      ((_data['items'] as List?) ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
  Map<String, dynamic> get _summary =>
      Map<String, dynamic>.from((_data['summary'] as Map?) ?? const {});

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
      final result = await DrivingSchoolApiService.instance.todayAppointments(
        date: _dateParam,
      );
      final permissions = await DrivingPermissionsStore.instance.load();
      if (mounted) {
        setState(() {
          _data = result;
          _permissions = permissions;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _message(String value, {bool error = false}) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(value),
          backgroundColor: error ? Colors.red : null,
        ),
      );
    }
  }

  Future<void> _mark(Map<String, dynamic> item, bool attended) async {
    setState(() => _saving = true);
    try {
      final res = await DrivingSchoolApiService.instance.markAttendance(
        '${item['id']}',
        attended,
      );
      _message(
        attended
            ? 'Geldi işaretlendi; süre işlendi.'.tr
            : 'Gelmedi işaretlendi; ${res['refundedMinutes'] ?? 0} dk pakete iade edildi.',
      );
      await _load();
    } catch (e) {
      _message('$e', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickDay() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _day,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      setState(() => _day = picked);
      await _load();
    }
  }

  String _timeRange(dynamic a, dynamic b) {
    final s = DateTime.tryParse('$a')?.toLocal();
    final e = DateTime.tryParse('$b')?.toLocal();
    String f(DateTime? d) => d == null
        ? '--'
        : '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    return '${f(s)} – ${f(e)}';
  }

  DrivingTone _toneOf(String status) {
    switch (status) {
      case 'Completed':
        return DrivingTone.success;
      case 'NoShow':
        return DrivingTone.danger;
      case 'CheckedIn':
      case 'InProgress':
        return DrivingTone.warning;
      default:
        return DrivingTone.info;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _data.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return DrivingErrorState(error: _error!, onRetry: _load);
    }
    final items = _items;
    final awaiting = items.where((x) => x['canMarkAttendance'] == true).toList();
    final others = items.where((x) => x['canMarkAttendance'] != true).toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _pickDay,
                  icon: const Icon(Icons.calendar_today_rounded, size: 18),
                  label: Text(
                    '${_day.day}.${_day.month}.${_day.year}',
                  ),
                ),
              ),
              const SizedBox(width: 10),
              IconButton(
                onPressed: _load,
                icon: const Icon(Icons.refresh_rounded),
                tooltip: 'Yenile'.tr,
              ),
            ],
          ),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 1.7,
            children: [
              DrivingKpiCard(
                label: 'Randevu'.tr,
                value: '${_summary['total'] ?? 0}',
                icon: Icons.event_rounded,
                color: const Color(0xFF3B82F6),
              ),
              DrivingKpiCard(
                label: 'Yoklama bekleyen'.tr,
                value: '${_summary['awaitingAttendance'] ?? 0}',
                icon: Icons.pending_actions_rounded,
                color: const Color(0xFFF59E0B),
              ),
              DrivingKpiCard(
                label: 'Tamamlanan'.tr,
                value: '${_summary['completed'] ?? 0}',
                icon: Icons.check_circle_rounded,
                color: const Color(0xFF10B981),
              ),
              DrivingKpiCard(
                label: 'Gelmedi'.tr,
                value: '${_summary['noShow'] ?? 0}',
                icon: Icons.person_off_rounded,
                color: const Color(0xFFEF4444),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            'Randevu saati geçen dersler otomatik tamamlanır ve süre işlenir. Öğrenci gelmediyse "Gelmedi" ile süre pakete iade edilir.'
                .tr,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 14),
          if (items.isEmpty)
            DrivingEmptyState(
              icon: Icons.event_available_rounded,
              title: 'Bu gün için randevu yok'.tr,
            )
          else ...[
            if (awaiting.isNotEmpty) ...[
              DrivingSectionTitle(title: 'Yoklama Bekleyenler'.tr),
              ...awaiting.map(_row),
              const SizedBox(height: 8),
            ],
            if (others.isNotEmpty) ...[
              DrivingSectionTitle(title: 'Diğer Randevular'.tr),
              ...others.map(_row),
            ],
          ],
        ],
      ),
    );
  }

  Widget _row(Map<String, dynamic> item) {
    final status = '${item['status']}';
    final canMark = item['canMarkAttendance'] == true && _canMark;
    final confirmed = item['attendanceConfirmed'] == true;
    return DrivingPanel(
      margin: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${item['studentName'] ?? '-'}',
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
              ),
              DrivingStatusPill(
                label: '${item['statusLabel'] ?? status}',
                tone: _toneOf(status),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${_timeRange(item['startsAtUtc'], item['endsAtUtc'])} • '
            '${item['instructorName'] ?? 'Eğitmen atanmadı'.tr}'
            '${(item['plate'] ?? '').toString().isNotEmpty ? ' • ${item['plate']}' : ''}'
            ' • ${item['scheduledMinutes'] ?? 0} dk',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (canMark) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    // "Geldi" = ders fiilen verildi. Onam kapısı burada devreye
                    // girer; yumuşaktır, imzasız devam edilebilir.
                    onPressed: _saving
                        ? null
                        : () => ConsentGate.run(
                            context,
                            appointmentId: '${item['id']}',
                            proceed: () => _mark(item, true),
                          ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF10B981),
                    ),
                    icon: const Icon(Icons.how_to_reg_rounded, size: 18),
                    label: Text('Geldi'.tr),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _saving ? null : () => _mark(item, false),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFEF4444),
                    ),
                    icon: const Icon(Icons.person_off_rounded, size: 18),
                    label: Text('Gelmedi'.tr),
                  ),
                ),
              ],
            ),
          ] else if (confirmed) ...[
            const SizedBox(height: 8),
            Text(
              'Yoklama teyit edildi'.tr,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
