import 'package:flutter/material.dart';

import '../services/attendance_service.dart';
import '../services/auth_session_store.dart';
import '../services/school_feed_api_service.dart';
import '../widgets/app_header.dart';
import '../widgets/responsive_layout.dart';

class StudentAttendanceHistoryPage extends StatefulWidget {
  const StudentAttendanceHistoryPage({
    super.key,
    this.studentName = '',
  });

  final String studentName;

  @override
  State<StudentAttendanceHistoryPage> createState() => _StudentAttendanceHistoryPageState();
}

class _StudentAttendanceHistoryPageState extends State<StudentAttendanceHistoryPage> {
  bool _loading = true;
  String _studentName = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final session = await AuthSessionStore.instance.load();
    final resolvedStudentName = widget.studentName.trim().isNotEmpty
        ? widget.studentName
        : await SchoolFeedApiService.resolveLinkedStudentName(session);
    _studentName = resolvedStudentName;
    await AttendanceService.instance.refresh(studentName: resolvedStudentName);
    if (!mounted) return;
    setState(() {
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final records = AttendanceService.instance.forStudent(_studentName.isEmpty ? widget.studentName : _studentName);
    final absent = records.where((item) => item.status == 'Devamsiz').length;
    final late = records.where((item) => item.status == 'Gec').length;
    final grouped = <String, List<AttendanceRecord>>{};
    for (final record in records) {
      final key =
          '${record.date.day.toString().padLeft(2, '0')}.${record.date.month.toString().padLeft(2, '0')}.${record.date.year}';
      grouped.putIfAbsent(key, () => []).add(record);
    }

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: const AppHeader(title: 'Devamsizliklarim'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: ResponsiveContent(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0F172A), Color(0xFF2563EB)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _studentName.isEmpty ? widget.studentName : _studentName,
                      style: theme.textTheme.headlineSmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Gun, hafta ve ay bazinda tum yoklama hareketlerin tek ekranda.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.86),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(child: _metric('Toplam Kayit', '${records.length}')),
                        const SizedBox(width: 10),
                        Expanded(child: _metric('Devamsiz', '$absent')),
                        const SizedBox(width: 10),
                        Expanded(child: _metric('Gec', '$late')),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              ...grouped.entries.map((entry) => _dateCard(context, entry.key, entry.value)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _metric(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 20)),
        ],
      ),
    );
  }

  Widget _dateCard(BuildContext context, String dateLabel, List<AttendanceRecord> records) {
    final theme = Theme.of(context);
    final issueCount = records.where((item) => item.status != 'Katildi').length;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Theme(
        data: theme.copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          leading: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: issueCount == 0
                  ? const Color(0xFF0F766E).withValues(alpha: 0.12)
                  : const Color(0xFFB54708).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              issueCount == 0 ? Icons.check_circle_outline_rounded : Icons.event_busy_outlined,
              color: issueCount == 0 ? const Color(0xFF0F766E) : const Color(0xFFB54708),
            ),
          ),
          title: Text(
            dateLabel,
            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          subtitle: Text(
            issueCount == 0 ? 'Tum derslere katildi' : '$issueCount hareket dikkat gerektiriyor',
            style: theme.textTheme.bodySmall,
          ),
          children: records.map((record) => _recordLine(context, record)).toList(),
        ),
      ),
    );
  }

  Widget _recordLine(BuildContext context, AttendanceRecord record) {
    final theme = Theme.of(context);
    final color = switch (record.status) {
      'Katildi' => const Color(0xFF0F766E),
      'Gec' => const Color(0xFFB54708),
      'Izinli' => const Color(0xFF2563EB),
      _ => const Color(0xFFB42318),
    };

    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(record.lesson, style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text('${record.className} dersi yoklama kaydi', style: theme.textTheme.bodySmall),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(record.status, style: TextStyle(color: color, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}
