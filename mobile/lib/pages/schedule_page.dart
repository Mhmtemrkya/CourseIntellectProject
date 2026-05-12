import 'package:flutter/material.dart';

import '../services/auth_session_store.dart';
import '../services/linked_children_service.dart';
import '../services/schedule_api_service.dart';
import '../services/schedule_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/schedule_grid_view.dart';

class SchedulePage extends StatefulWidget {
  const SchedulePage({super.key});

  @override
  State<SchedulePage> createState() => _SchedulePageState();
}

class _SchedulePageState extends State<SchedulePage> with TickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fadeAnim;
  late final Animation<Offset> _slideAnim;

  final _store = ScheduleStore.instance;
  int _selectedDay = DateTime.now().weekday - 1;
  bool _loading = true;
  bool _gridMode = true;
  String? _error;
  String _className = '';
  List<ScheduleEntryApiRecord> _lessons = const [];

  @override
  void initState() {
    super.initState();
    if (_selectedDay < 0 || _selectedDay > 6) _selectedDay = 0;
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 650));
    _fadeAnim = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(begin: const Offset(0, 0.06), end: Offset.zero)
        .animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));
    _controller.forward();
    _loadSchedule();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _loadSchedule() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = await AuthSessionStore.instance.load();
      final className = await _resolveViewerClass(session);
      await _store.refresh();
      final filtered = _store.entries.where((entry) {
        if (className.isEmpty) return true;
        return normalizeScheduleText(entry.className) == normalizeScheduleText(className);
      }).toList();
      if (!mounted) return;
      setState(() {
        _className = className;
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

  Future<String> _resolveViewerClass(AuthSession? session) async {
    if (session?.primaryRole == 'Parent') {
      final children = await LinkedChildrenService.instance.loadLinkedChildren();
      return children.isNotEmpty ? children.first.className : '';
    }
    await StudentRegistryStore.instance.ensureLoaded();
    final username = normalizeScheduleText(session?.username ?? '');
    final fullName = normalizeScheduleText(session?.fullName ?? '');
    for (final student in StudentRegistryStore.instance.students) {
      if (normalizeScheduleText(student.username) == username || normalizeScheduleText(student.fullName) == fullName) {
        return student.className;
      }
    }
    return '';
  }

  List<ScheduleEntryApiRecord> get _selectedDayLessons {
    final day = scheduleDayOrder[_selectedDay];
    return _lessons.where((entry) => entry.day == day).toList();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final selectedLessons = _selectedDayLessons;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ders Programı'),
        actions: [
          IconButton(
            tooltip: _gridMode ? 'Liste görünümü' : 'Haftalık çizelge',
            onPressed: () => setState(() => _gridMode = !_gridMode),
            icon: Icon(_gridMode ? Icons.view_agenda_outlined : Icons.calendar_view_week_rounded),
          ),
          IconButton(onPressed: _loading ? null : _loadSchedule, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: FadeTransition(
        opacity: _fadeAnim,
        child: SlideTransition(
          position: _slideAnim,
          child: RefreshIndicator(
            onRefresh: _loadSchedule,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_loading) const LinearProgressIndicator(),
                if (_loading) const SizedBox(height: 12),
                if (_error != null) _errorCard(theme, _error!),
                Text(
                  _className.isEmpty ? 'Haftalık ders programı' : '$_className haftalık ders programı',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 12),
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
                  ScheduleGridView(entries: _lessons, showClassName: false, showTeacher: true)
                else ...[
                  _dayTabs(theme),
                  const SizedBox(height: 16),
                  Text('${scheduleDayOrder[_selectedDay]} günü programı', style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 12),
                  if (selectedLessons.isEmpty)
                    _emptyCard(theme)
                  else
                    ...selectedLessons.map((lesson) => _lessonTile(theme, lesson)),
                ],
              ],
            ),
          ),
        ),
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
              decoration: BoxDecoration(
                color: isSelected ? const Color(0xFFFF7A45) : theme.cardColor,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Center(
                child: Text(scheduleDayShort[scheduleDayOrder[index]] ?? scheduleDayOrder[index], style: TextStyle(color: isSelected ? Colors.white : theme.textTheme.bodyMedium?.color, fontWeight: FontWeight.bold)),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _lessonTile(ThemeData theme, ScheduleEntryApiRecord lesson) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: theme.cardColor, borderRadius: BorderRadius.circular(18), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 8, offset: const Offset(0, 4))]),
      child: Row(
        children: [
          Column(children: [const Icon(Icons.access_time), const SizedBox(height: 4), Text(lesson.time, style: const TextStyle(fontWeight: FontWeight.bold))]),
          const SizedBox(width: 16),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(lesson.subject, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 4),
              Text('${lesson.teacher} • ${lesson.room.isEmpty ? 'Derslik' : lesson.room}', style: theme.textTheme.bodySmall?.copyWith(color: theme.hintColor)),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _emptyCard(ThemeData theme) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(color: theme.cardColor, borderRadius: BorderRadius.circular(18)),
        child: const Text('Bu gün için planlı ders yok.', textAlign: TextAlign.center),
      );

  Widget _errorCard(ThemeData theme, String text) => Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.red.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
        child: Text(text, style: const TextStyle(color: Colors.red)),
      );
}
