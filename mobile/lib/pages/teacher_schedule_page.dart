import 'package:flutter/material.dart';

import '../services/auth_session_store.dart';
import '../services/schedule_api_service.dart';
import '../services/schedule_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/schedule_grid_view.dart';

class TeacherSchedulePage extends StatefulWidget {
  const TeacherSchedulePage({super.key});

  @override
  State<TeacherSchedulePage> createState() => _TeacherSchedulePageState();
}

class _TeacherSchedulePageState extends State<TeacherSchedulePage> {
  final _store = ScheduleStore.instance;
  int _selectedDay = DateTime.now().weekday - 1;
  bool _loading = true;
  bool _gridMode = true;
  String? _error;
  String _teacherName = '';
  Map<String, int> _studentCounts = const {};
  List<ScheduleEntryApiRecord> _lessons = const [];

  @override
  void initState() {
    super.initState();
    if (_selectedDay < 0 || _selectedDay > 6) _selectedDay = 0;
    _loadSchedule();
  }

  Future<void> _loadSchedule() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = await AuthSessionStore.instance.load();
      final teacherName = session?.fullName ?? '';
      await Future.wait([_store.refresh(), StudentRegistryStore.instance.ensureLoaded()]);
      final counts = <String, int>{};
      for (final student in StudentRegistryStore.instance.students) {
        final className = student.className.trim();
        if (className.isEmpty) continue;
        counts[className] = (counts[className] ?? 0) + 1;
      }
      final filtered = _store.entries.where((entry) {
        if (teacherName.trim().isEmpty) return true;
        return normalizeScheduleText(entry.teacher) == normalizeScheduleText(teacherName);
      }).toList();
      if (!mounted) return;
      setState(() {
        _teacherName = teacherName;
        _studentCounts = counts;
        _lessons = sortScheduleEntries(filtered);
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  List<ScheduleEntryApiRecord> get _selectedDayLessons {
    final day = scheduleDayOrder[_selectedDay];
    return _lessons.where((entry) => entry.day == day).toList();
  }

  int get _weeklyStudents => _lessons.fold<int>(0, (sum, item) => sum + (_studentCounts[item.className] ?? 0));

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final currentLessons = _selectedDayLessons;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ders Programım'),
        actions: [
          IconButton(
            tooltip: _gridMode ? 'Liste görünümü' : 'Haftalık çizelge',
            onPressed: () => setState(() => _gridMode = !_gridMode),
            icon: Icon(_gridMode ? Icons.view_agenda_outlined : Icons.calendar_view_week_rounded),
          ),
          IconButton(onPressed: _loading ? null : _loadSchedule, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadSchedule,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_loading) const LinearProgressIndicator(),
            if (_loading) const SizedBox(height: 12),
            if (_error != null) _errorCard(_error!),
            _heroCard(theme),
            const SizedBox(height: 16),
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: true, icon: Icon(Icons.calendar_view_week_rounded), label: Text('Çizelge')),
                ButtonSegment(value: false, icon: Icon(Icons.view_agenda_outlined), label: Text('Liste')),
              ],
              selected: {_gridMode},
              onSelectionChanged: (value) => setState(() => _gridMode = value.first),
            ),
            const SizedBox(height: 16),
            if (_gridMode)
              ScheduleGridView(entries: _lessons, showClassName: true, showTeacher: false)
            else ...[
              _dayTabs(theme),
              const SizedBox(height: 16),
              Text('${scheduleDayOrder[_selectedDay]} günü programı', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              if (currentLessons.isEmpty)
                _emptyCard(theme)
              else
                ...currentLessons.map((lesson) => _lessonTile(theme, lesson)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _heroCard(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFF0F172A), Color(0xFFF59E0B)]),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(_teacherName.isEmpty ? 'Haftalık program' : _teacherName, style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        const Text('Ders Programım', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900)),
        const SizedBox(height: 14),
        Row(children: [
          _metric('Haftalık ders', '${_lessons.length}'),
          const SizedBox(width: 12),
          _metric('Öğrenci erişimi', '$_weeklyStudents'),
        ]),
      ]),
    );
  }

  Widget _metric(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(14)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18)),
        ]),
      ),
    );
  }

  Widget _dayTabs(ThemeData theme) {
    return SizedBox(
      height: 46,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: scheduleDayOrder.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final isSelected = _selectedDay == index;
          return InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: () => setState(() => _selectedDay = index),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              decoration: BoxDecoration(color: isSelected ? const Color(0xFFF59E0B) : theme.cardColor, borderRadius: BorderRadius.circular(20)),
              child: Center(child: Text(scheduleDayShort[scheduleDayOrder[index]] ?? scheduleDayOrder[index], style: TextStyle(color: isSelected ? Colors.white : theme.textTheme.bodyMedium?.color, fontWeight: FontWeight.bold))),
            ),
          );
        },
      ),
    );
  }

  Widget _lessonTile(ThemeData theme, ScheduleEntryApiRecord lesson) {
    final studentCount = _studentCounts[lesson.className] ?? 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: theme.cardColor, borderRadius: BorderRadius.circular(18), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 8, offset: const Offset(0, 4))]),
      child: Row(children: [
        Column(children: [const Icon(Icons.access_time), const SizedBox(height: 4), Text(lesson.time, style: const TextStyle(fontWeight: FontWeight.bold))]),
        const SizedBox(width: 16),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(lesson.subject, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 4),
          Text('${lesson.className} • ${lesson.room.isEmpty ? 'Derslik' : lesson.room}', style: theme.textTheme.bodySmall?.copyWith(color: theme.hintColor)),
          if (studentCount > 0) Text('$studentCount öğrenci', style: theme.textTheme.bodySmall),
        ])),
      ]),
    );
  }

  Widget _emptyCard(ThemeData theme) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(color: theme.cardColor, borderRadius: BorderRadius.circular(18)),
        child: const Text('Bu gün için planlı ders yok.', textAlign: TextAlign.center),
      );

  Widget _errorCard(String text) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.red.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
        child: Text(text, style: const TextStyle(color: Colors.red)),
      );
}
