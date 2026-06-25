import 'package:flutter/material.dart';

import '../services/duty_api_service.dart';

const List<String> _trMonths = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

String _formatDate(DateTime? date) {
  if (date == null) return '—';
  return '${date.day} ${_trMonths[date.month - 1]} ${date.year}';
}

const Map<String, Color> _typeColors = {
  'Sabah Nöbeti': Color(0xFFF97316),
  'Öğle Arası': Color(0xFF3B82F6),
  'İdari Nöbet': Color(0xFFA855F7),
};

Color _typeColor(String type) => _typeColors[type] ?? const Color(0xFF94A3B8);

class _Badge {
  final String label;
  final Color color;
  const _Badge(this.label, this.color);
}

_Badge _statusBadge(DutyRecord duty) {
  final status = duty.status.toLowerCase();
  if (status.contains('iptal')) return const _Badge('İptal Edildi', Color(0xFFEF4444));
  final date = duty.dutyDate;
  final today = DateTime.now();
  final todayMidnight = DateTime(today.year, today.month, today.day);
  if (date != null && date.isBefore(todayMidnight)) {
    return const _Badge('Tamamlandı', Color(0xFF22C55E));
  }
  if (date != null) {
    final diff = date.difference(todayMidnight).inDays;
    if (diff <= 2) return const _Badge('Yaklaşıyor', Color(0xFFF59E0B));
  }
  return const _Badge('Planlandı', Color(0xFF3B82F6));
}

class TeacherDutiesPage extends StatefulWidget {
  const TeacherDutiesPage({super.key});

  @override
  State<TeacherDutiesPage> createState() => _TeacherDutiesPageState();
}

class _TeacherDutiesPageState extends State<TeacherDutiesPage> {
  final DutyApiService _api = DutyApiService();
  bool _loading = true;
  bool _taskBusy = false;
  String? _error;
  List<DutyRecord> _all = [];
  List<AdminTaskRecord> _tasks = [];
  DutyStats _stats = const DutyStats();
  int _tab = 0; // 0 = gelecek, 1 = geçmiş

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
      final duties = await _api.fetchMyDuties(scope: 'all');
      List<AdminTaskRecord> tasks = const [];
      try {
        tasks = await _api.fetchMyAdminTasks();
      } catch (_) {}
      DutyStats stats = const DutyStats();
      try {
        stats = await _api.fetchMyStats();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _all = duties;
        _tasks = tasks;
        _stats = stats;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final now = DateTime.now();
    final todayMidnight = DateTime(now.year, now.month, now.day);
    final upcoming = _all.where((d) => d.dutyDate != null && !d.dutyDate!.isBefore(todayMidnight)).toList()
      ..sort((a, b) => a.dutyDate!.compareTo(b.dutyDate!));
    final past = _all.where((d) => d.dutyDate != null && d.dutyDate!.isBefore(todayMidnight)).toList()
      ..sort((a, b) => b.dutyDate!.compareTo(a.dutyDate!));
    final list = _tab == 0 ? upcoming : past;

    return Scaffold(
      appBar: AppBar(title: const Text('Görevlerim')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator()))
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(_error!, style: const TextStyle(color: Color(0xFFEF4444))),
                    ),
                  _buildSummary(theme),
                  const SizedBox(height: 16),
                  _buildAdminTasks(theme),
                  const SizedBox(height: 16),
                  _buildTabs(theme),
                  const SizedBox(height: 12),
                  if (list.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      child: Center(
                        child: Text(
                          _tab == 0 ? 'Yaklaşan nöbetiniz yok.' : 'Geçmiş nöbetiniz yok.',
                          style: TextStyle(color: theme.colorScheme.onSurface.withValues(alpha: 0.6)),
                        ),
                      ),
                    )
                  else
                    ...list.map((d) => _buildDutyCard(theme, d)),
                ],
              ),
      ),
    );
  }

  Widget _buildSummary(ThemeData theme) {
    final items = [
      ('Toplam', _stats.total, const Color(0xFF3B82F6), Icons.event_note_rounded),
      ('Tamamlanan', _stats.completed, const Color(0xFF22C55E), Icons.check_circle_outline_rounded),
      ('Planlanan', _stats.planned, const Color(0xFFF59E0B), Icons.schedule_rounded),
      ('İptal', _stats.cancelled, const Color(0xFFEF4444), Icons.cancel_outlined),
    ];
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 2.6,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      children: items.map((item) {
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
          ),
          child: Row(
            children: [
              Icon(item.$4, color: item.$3, size: 24),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('${item.$2}', style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                  Text(item.$1, style: TextStyle(fontSize: 11, color: theme.colorScheme.onSurface.withValues(alpha: 0.6))),
                ],
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildAdminTasks(ThemeData theme) {
    final muted = theme.colorScheme.onSurface.withValues(alpha: 0.6);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Atanan Görevlerim', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        if (_tasks.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
            ),
            child: Text('Size atanmış idari görev bulunmuyor.', style: TextStyle(color: muted)),
          )
        else
          ..._tasks.map((task) => Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text(task.title, style: const TextStyle(fontWeight: FontWeight.w800))),
                        _statusChip(theme, task.status),
                      ],
                    ),
                    if (task.description.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(task.description, style: TextStyle(fontSize: 13, color: muted)),
                    ],
                    const SizedBox(height: 8),
                    _row(Icons.schedule_rounded, 'Başlangıç: ${_formatDateTime(task.startDate)} · Bitiş: ${_formatDateTime(task.endDate)}', muted),
                    if (task.rejectionReason.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEF4444).withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text('Mazeret: ${task.rejectionReason}', style: const TextStyle(color: Color(0xFFEF4444), fontSize: 12)),
                      ),
                    ],
                    if (task.responseStatus == 'Pending' || task.status == 'PendingAcceptance') ...[
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton(
                              onPressed: _taskBusy ? null : () => _respondTask(task, 'Accepted'),
                              child: const Text('Kabul ediyorum'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: _taskBusy ? null : () => _showRejectDialog(task),
                              child: const Text('Kabul etmiyorum'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              )),
      ],
    );
  }

  Widget _statusChip(ThemeData theme, String status) {
    final rejected = status == 'Rejected';
    final accepted = status == 'Accepted';
    final color = rejected ? const Color(0xFFEF4444) : accepted ? const Color(0xFF22C55E) : theme.colorScheme.primary;
    final label = rejected ? 'Kabul edilmedi' : accepted ? 'Kabul edildi' : 'Bekliyor';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w800)),
    );
  }

  String _formatDateTime(DateTime? date) {
    if (date == null) return '—';
    return '${_formatDate(date)} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  Future<void> _respondTask(AdminTaskRecord task, String status, {String? reason}) async {
    setState(() => _taskBusy = true);
    try {
      final updated = await _api.updateAdminTaskStatus(task.id, status, reason: reason);
      if (!mounted) return;
      setState(() {
        _tasks = _tasks.map((item) => item.id == task.id ? updated : item).toList();
        _taskBusy = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _taskBusy = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _showRejectDialog(AdminTaskRecord task) async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Görevi kabul etmeme nedeni'),
        content: TextField(
          controller: controller,
          minLines: 3,
          maxLines: 5,
          decoration: const InputDecoration(hintText: 'Mazeretinizi yazın'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Vazgeç')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: const Text('Gönder')),
        ],
      ),
    );
    controller.dispose();
    if (reason != null && reason.trim().isNotEmpty) {
      await _respondTask(task, 'Rejected', reason: reason.trim());
    }
  }

  Widget _buildTabs(ThemeData theme) {
    Widget tab(String label, int index) {
      final active = _tab == index;
      return Expanded(
        child: GestureDetector(
          onTap: () => setState(() => _tab = index),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: active ? theme.colorScheme.primary : Colors.transparent,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Center(
              child: Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  color: active ? Colors.white : theme.colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
      ),
      child: Row(children: [tab('Gelecek Nöbetlerim', 0), tab('Geçmiş Nöbetlerim', 1)]),
    );
  }

  Widget _buildDutyCard(ThemeData theme, DutyRecord duty) {
    final badge = _statusBadge(duty);
    final muted = theme.colorScheme.onSurface.withValues(alpha: 0.6);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(width: 10, height: 10, decoration: BoxDecoration(color: _typeColor(duty.dutyType), shape: BoxShape.circle)),
              const SizedBox(width: 8),
              Expanded(child: Text(duty.dutyType, style: const TextStyle(fontWeight: FontWeight.w700))),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: badge.color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(999)),
                child: Text(badge.label, style: TextStyle(color: badge.color, fontSize: 11, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _row(Icons.calendar_today_rounded, '${_formatDate(duty.dutyDate)}${duty.day.isNotEmpty ? ' · ${duty.day}' : ''}', muted),
          const SizedBox(height: 6),
          _row(Icons.place_outlined, duty.location, muted),
          const SizedBox(height: 6),
          _row(Icons.schedule_rounded, '${duty.startTime} - ${duty.endTime}', muted),
          if (duty.description.isNotEmpty) ...[
            const SizedBox(height: 6),
            _row(Icons.notes_rounded, duty.description, muted),
          ],
        ],
      ),
    );
  }

  Widget _row(IconData icon, String text, Color muted) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 15, color: muted),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: TextStyle(fontSize: 13, color: muted))),
      ],
    );
  }
}
