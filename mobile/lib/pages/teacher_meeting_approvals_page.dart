import 'package:flutter/material.dart';

import '../services/auth_session_store.dart';
import '../services/meeting_request_api_service.dart';
import '../widgets/adaptive_scaffold.dart';
import '../widgets/teacher_header.dart';

class TeacherMeetingApprovalsPage extends StatefulWidget {
  const TeacherMeetingApprovalsPage({super.key});

  @override
  State<TeacherMeetingApprovalsPage> createState() => _TeacherMeetingApprovalsPageState();
}

class _TeacherMeetingApprovalsPageState extends State<TeacherMeetingApprovalsPage> {
  bool _loading = true;
  String? _error;
  List<MeetingRequestApiRecord> _requests = const [];
  List<MeetingSlotApiRecord> _availability = const [];
  String _teacherName = '';
  DateTime? _selectedDate;
  TimeOfDay? _selectedTime;
  bool _slotOnline = true;

  @override
  void initState() {
    super.initState();
    _loadRequests();
  }

  Future<void> _loadRequests() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = await AuthSessionStore.instance.load();
      final teacherName = session?.fullName ?? _teacherName;
      final requests = await MeetingRequestApiService.instance.fetchRequests(advisor: teacherName);
      final availability = await MeetingRequestApiService.instance.fetchConfiguredSlots(advisor: teacherName);
      if (!mounted) return;
      setState(() {
        _teacherName = teacherName;
        _requests = requests;
        _availability = availability;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  _SlotInfo _parseSlot(String raw) {
    final candidate = DateTime.tryParse(raw.replaceFirst(' ', 'T'));
    if (candidate != null) {
      return _SlotInfo(
        raw: raw,
        dateKey: '${candidate.year.toString().padLeft(4, '0')}-${candidate.month.toString().padLeft(2, '0')}-${candidate.day.toString().padLeft(2, '0')}',
        dayLabel: MaterialLocalizations.of(context).formatFullDate(candidate),
        timeLabel: MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(candidate), alwaysUse24HourFormat: true),
        sortable: candidate.millisecondsSinceEpoch,
      );
    }
    return _SlotInfo(raw: raw, dateKey: raw, dayLabel: raw, timeLabel: raw, sortable: 0);
  }

  Map<String, List<_AvailabilityWithInfo>> _groupAvailability() {
    final map = <String, List<_AvailabilityWithInfo>>{};
    for (final item in _availability) {
      final info = _parseSlot(item.slot);
      map.putIfAbsent(info.dateKey, () => []);
      map[info.dateKey]!.add(_AvailabilityWithInfo(record: item, info: info));
    }
    for (final entry in map.entries) {
      entry.value.sort((a, b) => a.info.sortable.compareTo(b.info.sortable));
    }
    return map;
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? now,
      firstDate: now.subtract(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 180)),
    );
    if (picked == null) return;
    setState(() => _selectedDate = picked);
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _selectedTime ?? const TimeOfDay(hour: 15, minute: 0),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child ?? const SizedBox.shrink(),
      ),
    );
    if (picked == null) return;
    setState(() => _selectedTime = picked);
  }

  Future<void> _createSlot() async {
    if (_selectedDate == null || _selectedTime == null) return;
    final value =
        '${_selectedDate!.year.toString().padLeft(4, '0')}-${_selectedDate!.month.toString().padLeft(2, '0')}-${_selectedDate!.day.toString().padLeft(2, '0')} ${_selectedTime!.hour.toString().padLeft(2, '0')}:${_selectedTime!.minute.toString().padLeft(2, '0')}';
    try {
      await MeetingRequestApiService.instance.createAvailability(
        advisor: _teacherName,
        slot: value,
        onlineMeeting: _slotOnline,
      );
      setState(() {
        _selectedTime = null;
      });
      await _loadRequests();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString()), behavior: SnackBarBehavior.floating),
      );
    }
  }

  Future<void> _deleteSlot(String id) async {
    try {
      await MeetingRequestApiService.instance.deleteAvailability(id);
      await _loadRequests();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString()), behavior: SnackBarBehavior.floating),
      );
    }
  }

  Future<void> _updateStatus(MeetingRequestApiRecord item, String status) async {
    try {
      await MeetingRequestApiService.instance.updateStatus(id: item.id, status: status);
      await _loadRequests();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${item.parentName} için talep güncellendi.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString()), behavior: SnackBarBehavior.floating),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final groupedAvailability = _groupAvailability();
    final pendingCount = _requests.where((item) => item.status == 'Bekliyor').length;

    final hasSidebar = SidebarState.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: hasSidebar ? null : TeacherHeader(
        title: 'Görüşme Onayları',
        teacherName: _teacherName.isEmpty ? 'Öğretmen' : _teacherName,
        subtitle: 'Takvim ve veli talepleri',
        showBackButton: true,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: _loadRequests, child: const Text('Tekrar Dene')),
                    ],
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  children: [
                    Container(
                      padding: const EdgeInsets.all(22),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(28),
                        gradient: const LinearGradient(
                          colors: [Color(0xFF111827), Color(0xFF7C3AED), Color(0xFFEC4899)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.14),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: const Text('Öğretmen görüşme takvimi', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            'Gün ve saat tanımla, veli tarafında sadece o listedeki saatler görünsün.',
                            style: theme.textTheme.titleLarge?.copyWith(color: Colors.white, fontWeight: FontWeight.w900, height: 1.15),
                          ),
                          const SizedBox(height: 14),
                          Row(
                            children: [
                              _heroStat('${_requests.length}', 'Toplam Talep'),
                              const SizedBox(width: 10),
                              _heroStat('$pendingCount', 'Bekleyen'),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(color: theme.cardColor, borderRadius: BorderRadius.circular(24)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Müsaitlik Takvimi', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: _pickDate,
                                  icon: const Icon(Icons.calendar_month_outlined),
                                  label: Text(_selectedDate == null ? 'Gün seç' : MaterialLocalizations.of(context).formatCompactDate(_selectedDate!)),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: _pickTime,
                                  icon: const Icon(Icons.access_time_rounded),
                                  label: Text(_selectedTime == null
                                      ? 'Saat seç'
                                      : MaterialLocalizations.of(context).formatTimeOfDay(_selectedTime!, alwaysUse24HourFormat: true)),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          SegmentedButton<bool>(
                            segments: const [
                              ButtonSegment<bool>(value: true, icon: Icon(Icons.video_call_outlined), label: Text('Online')),
                              ButtonSegment<bool>(value: false, icon: Icon(Icons.meeting_room_outlined), label: Text('Yüz yüze')),
                            ],
                            selected: {_slotOnline},
                            onSelectionChanged: (selection) => setState(() => _slotOnline = selection.first),
                          ),
                          const SizedBox(height: 12),
                          SizedBox(width: double.infinity, child: FilledButton(onPressed: _createSlot, child: const Text('Saati Takvime Ekle'))),
                          const SizedBox(height: 16),
                          if (groupedAvailability.isEmpty)
                            const Text('Henüz tanımlı görüşme saati yok.')
                          else
                            ...groupedAvailability.entries.map((entry) {
                              final dayLabel = entry.value.first.info.dayLabel;
                              return Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: theme.scaffoldBackgroundColor,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: theme.dividerColor.withValues(alpha: 0.2)),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(dayLabel, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
                                    const SizedBox(height: 10),
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 8,
                                      children: entry.value.map((item) {
                                        return Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                          decoration: BoxDecoration(
                                            color: Colors.white,
                                            borderRadius: BorderRadius.circular(999),
                                            border: Border.all(color: const Color(0xFFE2E8F0)),
                                          ),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Text(item.info.timeLabel, style: const TextStyle(fontWeight: FontWeight.w700)),
                                              const SizedBox(width: 8),
                                              Text(item.record.onlineMeeting ? 'Online' : 'Yüz yüze', style: const TextStyle(fontSize: 12)),
                                              const SizedBox(width: 8),
                                              IconButton(
                                                onPressed: item.record.id == null ? null : () => _deleteSlot(item.record.id!),
                                                icon: const Icon(Icons.delete_outline_rounded, size: 18),
                                                padding: EdgeInsets.zero,
                                                constraints: const BoxConstraints(),
                                              ),
                                            ],
                                          ),
                                        );
                                      }).toList(),
                                    ),
                                  ],
                                ),
                              );
                            }),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    ..._requests.map((item) => _requestCard(context, item)),
                  ],
                ),
    );
  }

  Widget _heroStat(String value, String label) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          children: [
            Text(value, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _requestCard(BuildContext context, MeetingRequestApiRecord item) {
    final theme = Theme.of(context);
    final info = _parseSlot(item.slot);
    final statusColor = switch (item.status) {
      'Onaylandı' => const Color(0xFF10B981),
      'Reddedildi' => const Color(0xFFEF4444),
      _ => const Color(0xFFF59E0B),
    };

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: theme.brightness == Brightness.dark ? Colors.black.withValues(alpha: 0.18) : Colors.black.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(item.parentName, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
                    const SizedBox(height: 4),
                    Text('${item.studentName} • ${item.topic}', style: theme.textTheme.bodySmall?.copyWith(color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.72))),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(16)),
                child: Text(item.status, style: TextStyle(color: statusColor, fontWeight: FontWeight.w900)),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _infoRow(context, Icons.calendar_month_outlined, info.dayLabel),
          const SizedBox(height: 8),
          _infoRow(context, Icons.access_time_rounded, info.timeLabel),
          const SizedBox(height: 8),
          _infoRow(context, item.onlineMeeting ? Icons.video_call_outlined : Icons.meeting_room_outlined, item.onlineMeeting ? 'Online görüşme' : 'Yüz yüze görüşme'),
          const SizedBox(height: 8),
          _infoRow(context, Icons.notes_rounded, item.note),
          if (item.status == 'Bekliyor') ...[
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => _updateStatus(item, 'Onaylandı'),
                    icon: const Icon(Icons.check_circle_outline_rounded),
                    label: const Text('Onayla'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _updateStatus(item, 'Reddedildi'),
                    icon: const Icon(Icons.close_rounded),
                    label: const Text('Reddet'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _infoRow(BuildContext context, IconData icon, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.35))),
      ],
    );
  }
}

class _SlotInfo {
  final String raw;
  final String dateKey;
  final String dayLabel;
  final String timeLabel;
  final int sortable;

  const _SlotInfo({
    required this.raw,
    required this.dateKey,
    required this.dayLabel,
    required this.timeLabel,
    required this.sortable,
  });
}

class _AvailabilityWithInfo {
  final MeetingSlotApiRecord record;
  final _SlotInfo info;

  const _AvailabilityWithInfo({
    required this.record,
    required this.info,
  });
}
