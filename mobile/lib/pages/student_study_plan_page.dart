import 'dart:async';
import 'package:student/i18n/app_locale.dart';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

import '../services/auth_session_store.dart';
import '../services/badge_progress_store.dart';
import '../services/homework_api_service.dart';
import '../services/planned_exam_api_service.dart';
import '../services/school_feed_api_service.dart';
import '../services/study_plan_api_service.dart';
import '../services/study_plan_realtime_service.dart';
import '../services/exam_results_store.dart';
import '../widgets/responsive_layout.dart';

/// Çalışma Planım — öğrencinin günlük çalışma merkezi.
/// Tüm veriler /api/studyplans (görev + hedef JSON'u), /api/homework ve
/// /api/plannedexams uçlarından gelir; mock veri kullanılmaz.
const int _taskXp = 20;
const int _goalXp = 50;

const List<String> _subjects = [
  'Matematik',
  'Türkçe',
  'Fizik',
  'Kimya',
  'Biyoloji',
  'İngilizce',
  'Tarih',
  'Coğrafya',
  'Genel',
];

const Map<String, Color> _subjectColors = {
  'Matematik': Color(0xFFF97316),
  'Türkçe': Color(0xFF8B5CF6),
  'Fizik': Color(0xFF3B82F6),
  'Kimya': Color(0xFF22C55E),
  'Biyoloji': Color(0xFF10B981),
  'İngilizce': Color(0xFF6366F1),
  'Tarih': Color(0xFFF43F5E),
  'Coğrafya': Color(0xFF06B6D4),
  'Genel': Color(0xFFEF4444),
};

String _isoDate(DateTime date) =>
    '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

String _formatMinutes(int minutes) {
  if (minutes < 60) return '$minutes dk';
  final hours = minutes ~/ 60;
  final rest = minutes % 60;
  return rest == 0 ? '$hours sa' : '$hours sa $rest dk';
}

class _PlanTask {
  final String id;
  String title;
  String subject;
  String topic;
  String date;
  String startTime;
  int durationMinutes;
  String status; // pending | active | done
  final String source;
  final String createdAt;

  _PlanTask({
    required this.id,
    required this.title,
    required this.subject,
    required this.topic,
    required this.date,
    required this.startTime,
    required this.durationMinutes,
    required this.status,
    required this.source,
    required this.createdAt,
  });

  static _PlanTask? tryParse(Map<String, dynamic> map) {
    final type = map['type']?.toString();
    if (type == 'goal' || (type == null && map['target'] != null)) return null;
    final duration =
        (map['durationMinutes'] as num?)?.toInt() ??
        int.tryParse(
          RegExp(
                r'\d+',
              ).firstMatch(map['duration']?.toString() ?? '')?.group(0) ??
              '',
        ) ??
        45;
    final rawStatus = map['status']?.toString();
    final status = rawStatus == 'done' || map['done'] == true
        ? 'done'
        : rawStatus == 'active'
        ? 'active'
        : 'pending';
    final createdAt =
        map['createdAt']?.toString() ?? DateTime.now().toIso8601String();
    return _PlanTask(
      id: map['id']?.toString() ?? '',
      title: map['title']?.toString() ?? 'Görev',
      subject: map['subject']?.toString() ?? 'Genel',
      topic: map['topic']?.toString() ?? map['reason']?.toString() ?? '',
      date:
          map['date']?.toString() ??
          (createdAt.length >= 10
              ? createdAt.substring(0, 10)
              : _isoDate(DateTime.now())),
      startTime: map['startTime']?.toString() ?? '',
      durationMinutes: duration,
      status: status,
      source: map['source']?.toString() ?? 'manual',
      createdAt: createdAt,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': 'task',
    'title': title,
    'subject': subject,
    'topic': topic,
    'date': date,
    'startTime': startTime,
    'durationMinutes': durationMinutes,
    'status': status,
    'done': status == 'done',
    'source': source,
    'createdAt': createdAt,
  };
}

class _PlanGoal {
  final String id;
  String title;
  int target;
  int current;
  String unit;
  final String createdAt;

  _PlanGoal({
    required this.id,
    required this.title,
    required this.target,
    required this.current,
    required this.unit,
    required this.createdAt,
  });

  static _PlanGoal? tryParse(Map<String, dynamic> map) {
    final type = map['type']?.toString();
    if (type != 'goal' && map['target'] == null) return null;
    return _PlanGoal(
      id: map['id']?.toString() ?? '',
      title: map['title']?.toString() ?? 'Hedef',
      target: math.max(1, (map['target'] as num?)?.toInt() ?? 1),
      current: math.max(0, (map['current'] as num?)?.toInt() ?? 0),
      unit: map['unit']?.toString() ?? '',
      createdAt:
          map['createdAt']?.toString() ?? DateTime.now().toIso8601String(),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': 'goal',
    'title': title,
    'target': target,
    'current': current,
    'unit': unit,
    'createdAt': createdAt,
  };
}

class StudentStudyPlanPage extends StatefulWidget {
  const StudentStudyPlanPage({super.key});

  @override
  State<StudentStudyPlanPage> createState() => _StudentStudyPlanPageState();
}

class _StudentStudyPlanPageState extends State<StudentStudyPlanPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  bool _loading = true;
  String? _error;
  String _studentName = '';
  String _firstName = 'Öğrenci';
  int _xp = 0;
  int _streak = 0;
  DateTime? _lastCompletedAt;
  List<_PlanTask> _tasks = [];
  List<_PlanGoal> _goals = [];
  String _selectedDate = _isoDate(DateTime.now());
  DateTime _calendarMonth = DateTime(DateTime.now().year, DateTime.now().month);
  List<Map<String, dynamic>> _homework = const [];
  List<PlannedExamRecord> _plannedExams = const [];
  List<ExamScoreRecord> _examResults = const [];
  bool _generating = false;
  StreamSubscription<StudyPlanStateRecord>? _realtimeSubscription;
  final FlutterLocalNotificationsPlugin _notifications =
      FlutterLocalNotificationsPlugin();
  bool _notificationsReady = false;
  final Set<String> _scheduledReminderIds = <String>{};

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _load();
    _connectRealtime();
  }

  @override
  void dispose() {
    _realtimeSubscription?.cancel();
    _tabController.dispose();
    super.dispose();
  }

  /// SignalR: desktop'ta (veya başka cihazda) yapılan plan değişiklikleri
  /// anında bu ekrana yansır.
  Future<void> _connectRealtime() async {
    await StudyPlanRealtimeService.instance.ensureConnected();
    _realtimeSubscription = StudyPlanRealtimeService.instance.planUpdatedStream
        .listen((state) {
          if (!mounted) return;
          setState(() => _applyState(state));
        });
  }

  Future<void> _ensureNotifications() async {
    if (_notificationsReady) return;
    tz.initializeTimeZones();
    const settings = InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS: DarwinInitializationSettings(),
    );
    await _notifications.initialize(settings);
    await _notifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.requestNotificationsPermission();
    await _notifications
        .resolvePlatformSpecificImplementation<
          IOSFlutterLocalNotificationsPlugin
        >()
        ?.requestPermissions(alert: true, badge: true, sound: true);
    _notificationsReady = true;
  }

  DateTime? _taskStartDateTime(_PlanTask task) {
    final date = DateTime.tryParse(task.date);
    if (date == null || task.startTime.isEmpty) return null;
    final parts = task.startTime.split(':');
    final hour = int.tryParse(parts.first);
    final minute = parts.length > 1 ? int.tryParse(parts[1]) : 0;
    if (hour == null) return null;
    return DateTime(date.year, date.month, date.day, hour, minute ?? 0);
  }

  /// Görev başlangıcından 10 dakika önce yerel hatırlatma bildirimi kurar.
  Future<void> _toggleReminder(_PlanTask task) async {
    final start = _taskStartDateTime(task);
    if (start == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Hatırlatma için görevin tarih ve saati olmalı.'.tr),
        ),
      );
      return;
    }
    final notificationId = task.id.hashCode & 0x7fffffff;
    try {
      await _ensureNotifications();
      if (_scheduledReminderIds.contains(task.id)) {
        await _notifications.cancel(notificationId);
        if (!mounted) return;
        setState(() => _scheduledReminderIds.remove(task.id));
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Hatırlatma kaldırıldı.'.tr)));
        return;
      }

      var reminderAt = start.subtract(const Duration(minutes: 10));
      if (reminderAt.isBefore(DateTime.now())) {
        reminderAt = start;
      }
      if (reminderAt.isBefore(DateTime.now())) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Bu görevin saati geçmiş; hatırlatma kurulamaz.'.tr),
          ),
        );
        return;
      }

      await _notifications.zonedSchedule(
        notificationId,
        'Çalışma zamanı: ${task.title}',
        '${task.subject} • ${task.durationMinutes} dk • ${task.startTime}',
        tz.TZDateTime.from(reminderAt, tz.local),
        const NotificationDetails(
          android: AndroidNotificationDetails(
            'study_plan_reminders',
            'Çalışma Planı Hatırlatmaları',
            channelDescription:
                'Planlanan görevler başlamadan önce hatırlatma gönderir.',
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: DarwinNotificationDetails(),
        ),
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      );
      if (!mounted) return;
      setState(() => _scheduledReminderIds.add(task.id));
      final timeLabel =
          '${reminderAt.hour.toString().padLeft(2, '0')}:${reminderAt.minute.toString().padLeft(2, '0')}';
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Hatırlatma kuruldu: $timeLabel')));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = await AuthSessionStore.instance.load();
      final state = await StudyPlanApiService.instance.fetch();
      final homework = await HomeworkApiService.instance
          .fetchAssignments()
          .catchError((_) => <Map<String, dynamic>>[]);
      final exams = await PlannedExamApiService.instance
          .fetchPlannedExams()
          .catchError((_) => <PlannedExamRecord>[]);
      final examResults = await SchoolFeedApiService.instance
          .fetchExamResults(studentName: session?.fullName)
          .catchError((_) => <ExamScoreRecord>[]);
      if (!mounted) return;
      setState(() {
        _studentName = session?.fullName ?? '';
        _firstName = (session?.fullName ?? 'Öğrenci').split(' ').first;
        _applyState(state);
        _homework = homework;
        _plannedExams = exams;
        _examResults = examResults;
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

  void _applyState(StudyPlanStateRecord state) {
    _xp = state.xpPoints;
    _streak = state.streakCount;
    _lastCompletedAt = state.lastCompletedAt;
    _tasks = state.planItems
        .map(_PlanTask.tryParse)
        .whereType<_PlanTask>()
        .toList();
    _goals = state.planItems
        .map(_PlanGoal.tryParse)
        .whereType<_PlanGoal>()
        .toList();
  }

  Future<void> _persist({DateTime? completedAt, int? streak}) async {
    await StudyPlanApiService.instance.save(
      studentName: _studentName,
      planItems: [
        ..._tasks.map((task) => task.toJson()),
        ..._goals.map((goal) => goal.toJson()),
      ],
      streakCount: streak ?? _streak,
      xpPoints: _xp,
      lastCompletedAt: completedAt ?? _lastCompletedAt,
    );
    if (streak != null) _streak = streak;
    if (completedAt != null) _lastCompletedAt = completedAt;
  }

  int _nextStreak() {
    final last = _lastCompletedAt;
    if (last == null) return 1;
    final today = _isoDate(DateTime.now());
    final lastDay = _isoDate(last);
    if (lastDay == today) return math.max(1, _streak);
    final yesterday = _isoDate(
      DateTime.now().subtract(const Duration(days: 1)),
    );
    return lastDay == yesterday ? _streak + 1 : 1;
  }

  List<_PlanTask> get _dayTasks {
    final list = _tasks.where((task) => task.date == _selectedDate).toList()
      ..sort(
        (a, b) => (a.startTime.isEmpty ? 'zz' : a.startTime).compareTo(
          b.startTime.isEmpty ? 'zz' : b.startTime,
        ),
      );
    return list;
  }

  double get _todayProgress {
    final list = _dayTasks;
    if (list.isEmpty) return 0;
    return list.where((task) => task.status == 'done').length / list.length;
  }

  Future<void> _setTaskStatus(_PlanTask task, String status) async {
    final previous = task.status;
    setState(() => task.status = status);
    try {
      if (status == 'done' && previous != 'done') {
        await _persist(completedAt: DateTime.now(), streak: _nextStreak());
        final after = await StudyPlanApiService.instance.addXp(_taskXp);
        if (!mounted) return;
        setState(() => _xp = after.xpPoints);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Görev tamamlandı! +$_taskXp XP 🎉')),
        );
        await BadgeUnlockService.checkAndCelebrate(context, xp: after.xpPoints);
      } else {
        await _persist();
      }
    } catch (error) {
      if (!mounted) return;
      setState(() => task.status = previous);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _deleteTask(_PlanTask task) async {
    try {
      final state = await StudyPlanApiService.instance.deleteItem(task.id);
      if (!mounted) return;
      setState(() => _applyState(state));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _addTask({
    required String title,
    required String subject,
    required String topic,
    required String startTime,
    required int durationMinutes,
    String source = 'manual',
    String? date,
  }) async {
    final state = await StudyPlanApiService.instance.addItem({
      'type': 'task',
      'title': title,
      'subject': subject,
      'topic': topic,
      'date': date ?? _selectedDate,
      'startTime': startTime,
      'durationMinutes': durationMinutes,
      'status': 'pending',
      'source': source,
      'createdAt': DateTime.now().toIso8601String(),
    });
    if (!mounted) return;
    setState(() => _applyState(state));
  }

  Future<void> _addGoal({
    required String title,
    required int target,
    required int current,
    required String unit,
  }) async {
    final state = await StudyPlanApiService.instance.addItem({
      'type': 'goal',
      'title': title,
      'target': target,
      'current': current,
      'unit': unit,
      'createdAt': DateTime.now().toIso8601String(),
    });
    if (!mounted) return;
    setState(() => _applyState(state));
  }

  Future<void> _bumpGoal(_PlanGoal goal, int delta) async {
    final next = (goal.current + delta).clamp(0, goal.target);
    if (next == goal.current) return;
    final previous = goal.current;
    setState(() => goal.current = next);
    try {
      await _persist();
      if (next >= goal.target && previous < goal.target) {
        final after = await StudyPlanApiService.instance.addXp(_goalXp);
        if (!mounted) return;
        setState(() => _xp = after.xpPoints);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Hedef tamamlandı! +$_goalXp XP 🏆')),
        );
        await BadgeUnlockService.checkAndCelebrate(context, xp: after.xpPoints);
      }
    } catch (error) {
      if (!mounted) return;
      setState(() => goal.current = previous);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _deleteGoal(_PlanGoal goal) async {
    try {
      final state = await StudyPlanApiService.instance.deleteItem(goal.id);
      if (!mounted) return;
      setState(() => _applyState(state));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  /// Ödev, deneme ve son 14 gündür çalışılmayan derslerden öneri üretir.
  List<Map<String, dynamic>> get _suggestions {
    final list = <Map<String, dynamic>>[];
    final myName = _studentName.toLowerCase();
    for (final homework in _homework.take(6)) {
      final submissions =
          (homework['submissions'] as List<dynamic>? ?? const []).map(
            (item) =>
                (item as Map)['studentName']?.toString().toLowerCase() ?? '',
          );
      if (submissions.contains(myName)) continue;
      list.add({
        'icon': Icons.assignment_outlined,
        'color': const Color(0xFF3B82F6),
        'title': 'Ödev: ${homework['title'] ?? ''}',
        'detail':
            '${homework['subject'] ?? 'Ders'} • Teslim: ${homework['deadline'] ?? 'yakında'}',
        'task': {
          'title': 'Ödev: ${homework['title'] ?? ''}',
          'subject': homework['subject']?.toString() ?? 'Genel',
          'topic': 'Ödev tamamlama',
          'duration': 45,
          'source': 'assignment',
        },
      });
      if (list.length >= 3) break;
    }
    for (final exam in _plannedExams.take(2)) {
      list.add({
        'icon': Icons.flag_outlined,
        'color': const Color(0xFF8B5CF6),
        'title': 'Denemeye hazırlık: ${exam.title}',
        'detail': '${exam.subject} • ${exam.date}',
        'task': {
          'title': 'Deneme hazırlığı: ${exam.title}',
          'subject': exam.subject.isEmpty ? 'Genel' : exam.subject,
          'topic': 'Deneme tekrarı ve eksik analizi',
          'duration': 60,
          'source': 'exam',
        },
      });
    }
    // Kazanım analizi: son sınav sonuçlarında ortalaması düşük dersler.
    final scoresBySubject = <String, List<int>>{};
    for (final result in _examResults.take(12)) {
      final subject = result.subject.trim();
      if (subject.isEmpty) continue;
      scoresBySubject.putIfAbsent(subject, () => []).add(result.score);
    }
    final weakSubjects =
        scoresBySubject.entries
            .map(
              (entry) => (
                subject: entry.key,
                average:
                    entry.value.reduce((a, b) => a + b) ~/ entry.value.length,
                count: entry.value.length,
              ),
            )
            .where((item) => item.average < 60)
            .toList()
          ..sort((a, b) => a.average.compareTo(b.average));
    for (final weak in weakSubjects.take(2)) {
      list.add({
        'icon': Icons.trending_down_rounded,
        'color': const Color(0xFFEF4444),
        'title':
            'Son ${weak.count} sınavda ${weak.subject} başarın düşük (ort. %${weak.average})',
        'detail': 'Bu hafta bu derse ek süre ayırman önerilir.',
        'task': {
          'title': '${weak.subject} Eksik Kazanım Çalışması',
          'subject': weak.subject,
          'topic': 'Düşük başarılı konuların tekrarı',
          'duration': 90,
          'source': 'auto',
        },
      });
    }
    final now = DateTime.now();
    final studied = _tasks
        .where((task) {
          final date = DateTime.tryParse(task.date);
          if (date == null) return false;
          final diff = now.difference(date).inDays;
          return diff >= 0 && diff <= 14;
        })
        .map((task) => task.subject)
        .toSet();
    for (final subject in _subjects) {
      if (subject == 'Genel' || studied.contains(subject)) continue;
      list.add({
        'icon': Icons.lightbulb_outline_rounded,
        'color': const Color(0xFFF97316),
        'title': '$subject son 14 günde çalışılmadı',
        'detail': 'Planına ekleyerek dengeyi koru.',
        'task': {
          'title': '$subject Genel Tekrar',
          'subject': subject,
          'topic': 'Eksik kapatma',
          'duration': 45,
          'source': 'auto',
        },
      });
      if (list.length >= 5) break;
    }
    return list.take(5).toList();
  }

  Future<void> _generatePlan() async {
    final suggestions = _suggestions;
    if (suggestions.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Öneri bulunamadı: ödev, deneme veya eksik ders verisi yok.'.tr,
          ),
        ),
      );
      return;
    }
    setState(() => _generating = true);
    try {
      var start = 9 * 60;
      for (final suggestion in suggestions.take(4)) {
        final task = suggestion['task'] as Map<String, dynamic>;
        final duration = task['duration'] as int;
        final startTime =
            '${(start ~/ 60).toString().padLeft(2, '0')}:${(start % 60).toString().padLeft(2, '0')}';
        await _addTask(
          title: task['title'] as String,
          subject: task['subject'] as String,
          topic: task['topic'] as String,
          startTime: startTime,
          durationMinutes: duration,
          source: task['source'] as String,
          date: _isoDate(DateTime.now()),
        );
        start += duration + 15;
      }
      if (!mounted) return;
      setState(() => _selectedDate = _isoDate(DateTime.now()));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Bugünün planı ödev ve denemelerinden otomatik oluşturuldu.'.tr,
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text('Çalışma Planım'.tr),
        actions: [
          IconButton(
            tooltip: 'Yenile',
            onPressed: _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Bugün'),
            Tab(text: 'Hedefler'),
            Tab(text: 'Takvim'),
            Tab(text: 'Analiz'),
          ],
        ),
      ),
      floatingActionButton: _loading
          ? null
          : FloatingActionButton.extended(
              onPressed: _showAddTaskSheet,
              icon: const Icon(Icons.add_rounded),
              label: Text('Görev Ekle'.tr),
            ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? _errorView(theme)
          : TabBarView(
              controller: _tabController,
              children: [
                _todayTab(theme),
                _goalsTab(theme),
                _calendarTab(theme),
                _analyticsTab(theme),
              ],
            ),
    );
  }

  Widget _errorView(ThemeData theme) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 48),
            const SizedBox(height: 12),
            Text(
              _error ?? 'Plan yüklenemedi.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 14),
            FilledButton(onPressed: _load, child: const Text('Tekrar Dene')),
          ],
        ),
      ),
    );
  }

  // ============ BUGÜN ============

  Widget _todayTab(ThemeData theme) {
    final dayTasks = _dayTasks;
    final doneCount = dayTasks.where((task) => task.status == 'done').length;
    final doneMinutes = dayTasks
        .where((task) => task.status == 'done')
        .fold<int>(0, (sum, task) => sum + task.durationMinutes);
    final isToday = _selectedDate == _isoDate(DateTime.now());

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
        children: [
          ResponsiveContent(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Merhaba $_firstName 👋',
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  isToday
                      ? 'Bugünkü hedeflerin seni bekliyor.'
                      : 'Seçili günün planına bakıyorsun.',
                  style: theme.textTheme.bodyMedium,
                ),
                const SizedBox(height: 16),
                Center(
                  child: _ProgressRing(
                    progress: _todayProgress,
                    label: 'Bugünkü İlerleme'.tr,
                    size: 168,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    _statCard(
                      theme,
                      icon: Icons.bolt_rounded,
                      color: const Color(0xFF3B82F6),
                      value: '$_xp',
                      label: 'Toplam XP',
                    ),
                    const SizedBox(width: 10),
                    _statCard(
                      theme,
                      icon: Icons.check_circle_rounded,
                      color: const Color(0xFF22C55E),
                      value: '$doneCount / ${dayTasks.length}',
                      label: 'Tamamlanan Görev'.tr,
                    ),
                    const SizedBox(width: 10),
                    _statCard(
                      theme,
                      icon: Icons.timer_rounded,
                      color: const Color(0xFFF97316),
                      value: _formatMinutes(doneMinutes),
                      label: 'Çalışılan Süre'.tr,
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    IconButton.filledTonal(
                      onPressed: () => _shiftDay(-1),
                      icon: const Icon(Icons.chevron_left_rounded),
                    ),
                    Expanded(
                      child: Center(
                        child: Text(
                          _formatDateLabel(_selectedDate),
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                    IconButton.filledTonal(
                      onPressed: () => _shiftDay(1),
                      icon: const Icon(Icons.chevron_right_rounded),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (dayTasks.isEmpty)
                  _emptyDayCard(theme)
                else
                  ...dayTasks.map((task) => _timelineTile(theme, task)),
                const SizedBox(height: 18),
                _suggestionsCard(theme),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _generating ? null : _generatePlan,
                    icon: _generating
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.auto_awesome_rounded),
                    label: Text(
                      _generating
                          ? 'Plan oluşturuluyor...'
                          : 'Otomatik Plan Oluştur',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _shiftDay(int delta) {
    final current = DateTime.parse(_selectedDate);
    setState(
      () => _selectedDate = _isoDate(current.add(Duration(days: delta))),
    );
  }

  String _formatDateLabel(String iso) {
    final date = DateTime.parse(iso);
    const months = [
      'Ocak',
      'Şubat',
      'Mart',
      'Nisan',
      'Mayıs',
      'Haziran',
      'Temmuz',
      'Ağustos',
      'Eylül',
      'Ekim',
      'Kasım',
      'Aralık',
    ];
    const days = [
      'Pazartesi',
      'Salı',
      'Çarşamba',
      'Perşembe',
      'Cuma',
      'Cumartesi',
      'Pazar',
    ];
    return '${date.day} ${months[date.month - 1]}, ${days[date.weekday - 1]}';
  }

  Widget _statCard(
    ThemeData theme, {
    required IconData icon,
    required Color color,
    required String value,
    required String label,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
        decoration: BoxDecoration(
          color: theme.cardColor,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: theme.dividerColor),
        ),
        child: Column(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(fontSize: 10.5),
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyDayCard(ThemeData theme) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Column(
        children: [
          const Icon(Icons.task_alt_rounded, size: 40),
          const SizedBox(height: 10),
          Text(
            'Bu gün için görev yok'.tr,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '"Otomatik Plan Oluştur" ile ödev ve denemelerinden plan üret ya da görev ekle.'.tr,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodySmall,
          ),
        ],
      ),
    );
  }

  Widget _timelineTile(ThemeData theme, _PlanTask task) {
    final color = _subjectColors[task.subject] ?? const Color(0xFF64748B);
    final isDone = task.status == 'done';
    final isActive = task.status == 'active';

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 52,
            child: Column(
              children: [
                Text(
                  task.startTime.isEmpty ? '—' : task.startTime,
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    color: theme.dividerColor,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isDone
                    ? const Color(0xFF22C55E).withValues(alpha: 0.10)
                    : theme.cardColor,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: isDone
                      ? const Color(0xFF22C55E).withValues(alpha: 0.55)
                      : isActive
                      ? color
                      : theme.dividerColor,
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 4,
                    height: 44,
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          task.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            decoration: isDone
                                ? TextDecoration.lineThrough
                                : null,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${task.subject}${task.topic.isEmpty ? '' : ' • ${task.topic}'} • ${task.durationMinutes} dk',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  if (!isDone)
                    IconButton(
                      tooltip: _scheduledReminderIds.contains(task.id)
                          ? 'Hatırlatmayı kaldır'
                          : 'Hatırlatma kur',
                      onPressed: () => _toggleReminder(task),
                      icon: Icon(
                        _scheduledReminderIds.contains(task.id)
                            ? Icons.notifications_active_rounded
                            : Icons.notifications_none_rounded,
                        size: 22,
                        color: _scheduledReminderIds.contains(task.id)
                            ? const Color(0xFFF97316)
                            : null,
                      ),
                    ),
                  if (!isDone)
                    IconButton(
                      tooltip: isActive ? 'Tamamla' : 'Başla',
                      onPressed: () =>
                          _setTaskStatus(task, isActive ? 'done' : 'active'),
                      icon: Icon(
                        isActive
                            ? Icons.check_circle_rounded
                            : Icons.play_circle_fill_rounded,
                        color: isActive ? const Color(0xFF22C55E) : color,
                        size: 30,
                      ),
                    )
                  else
                    IconButton(
                      tooltip: 'Geri al',
                      onPressed: () => _setTaskStatus(task, 'pending'),
                      icon: const Icon(
                        Icons.check_circle_rounded,
                        color: Color(0xFF22C55E),
                        size: 30,
                      ),
                    ),
                  IconButton(
                    tooltip: 'Sil',
                    onPressed: () => _deleteTask(task),
                    icon: const Icon(Icons.delete_outline_rounded, size: 20),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _suggestionsCard(ThemeData theme) {
    final suggestions = _suggestions;
    if (suggestions.isEmpty) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF97316).withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: const Color(0xFFF97316).withValues(alpha: 0.30),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.lightbulb_rounded, color: Color(0xFFF97316), size: 18),
              SizedBox(width: 6),
              Text(
                'Akıllı Öneriler'.tr,
                style: TextStyle(fontWeight: FontWeight.w900),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...suggestions.map((suggestion) {
            final task = suggestion['task'] as Map<String, dynamic>;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: (suggestion['color'] as Color).withValues(
                        alpha: 0.14,
                      ),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      suggestion['icon'] as IconData,
                      size: 18,
                      color: suggestion['color'] as Color,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          suggestion['title'] as String,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          suggestion['detail'] as String,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () =>
                        _addTask(
                          title: task['title'] as String,
                          subject: task['subject'] as String,
                          topic: task['topic'] as String,
                          startTime: '',
                          durationMinutes: task['duration'] as int,
                          source: task['source'] as String,
                        ).then((_) {
                          if (!mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Plana eklendi.')),
                          );
                        }),
                    child: const Text('Ekle'),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  // ============ HEDEFLER ============

  Widget _goalsTab(ThemeData theme) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
        children: [
          ResponsiveContent(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Hedeflerim',
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    FilledButton.tonalIcon(
                      onPressed: _showAddGoalSheet,
                      icon: const Icon(Icons.add_rounded, size: 18),
                      label: const Text('Hedef Ekle'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (_goals.isEmpty)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: theme.cardColor,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: theme.dividerColor),
                    ),
                    child: Column(
                      children: [
                        const Icon(Icons.flag_rounded, size: 40),
                        const SizedBox(height: 10),
                        Text(
                          'Henüz hedefin yok'.tr,
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Deneme, soru veya net hedefi koy; ilerlemeni buradan takip et.',
                          textAlign: TextAlign.center,
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  )
                else
                  ..._goals.map((goal) => _goalCard(theme, goal)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _goalCard(ThemeData theme, _PlanGoal goal) {
    final percent = (goal.current / goal.target).clamp(0.0, 1.0);
    final completed = percent >= 1;
    final color = completed ? const Color(0xFF22C55E) : const Color(0xFF6366F1);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: theme.dividerColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  goal.title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Text(
                '${goal.current} / ${goal.target} ${goal.unit}'.trim(),
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: percent),
              duration: const Duration(milliseconds: 600),
              curve: Curves.easeOutCubic,
              builder: (context, value, _) => LinearProgressIndicator(
                value: value,
                minHeight: 10,
                backgroundColor: theme.dividerColor.withValues(alpha: 0.4),
                valueColor: AlwaysStoppedAnimation<Color>(color),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Text(
                completed ? 'Tamamlandı 🎉' : '%${(percent * 100).round()}',
                style: theme.textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: color,
                ),
              ),
              const Spacer(),
              IconButton.filledTonal(
                onPressed: () => _bumpGoal(goal, -1),
                icon: const Icon(Icons.remove_rounded, size: 18),
                visualDensity: VisualDensity.compact,
              ),
              const SizedBox(width: 4),
              IconButton.filledTonal(
                onPressed: () => _bumpGoal(goal, 1),
                icon: const Icon(Icons.add_rounded, size: 18),
                visualDensity: VisualDensity.compact,
              ),
              const SizedBox(width: 4),
              IconButton(
                onPressed: () => _deleteGoal(goal),
                icon: const Icon(Icons.delete_outline_rounded, size: 20),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ============ TAKVİM ============

  Widget _calendarTab(ThemeData theme) {
    final year = _calendarMonth.year;
    final month = _calendarMonth.month;
    const months = [
      'Ocak',
      'Şubat',
      'Mart',
      'Nisan',
      'Mayıs',
      'Haziran',
      'Temmuz',
      'Ağustos',
      'Eylül',
      'Ekim',
      'Kasım',
      'Aralık',
    ];
    final firstWeekday = DateTime(year, month, 1).weekday; // 1=Pzt
    final daysInMonth = DateTime(year, month + 1, 0).day;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
        children: [
          ResponsiveContent(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${months[month - 1]} $year',
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    IconButton.filledTonal(
                      onPressed: () => setState(
                        () => _calendarMonth = DateTime(year, month - 1),
                      ),
                      icon: const Icon(Icons.chevron_left_rounded),
                    ),
                    const SizedBox(width: 6),
                    IconButton.filledTonal(
                      onPressed: () => setState(
                        () => _calendarMonth = DateTime(year, month + 1),
                      ),
                      icon: const Icon(Icons.chevron_right_rounded),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: theme.cardColor,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: theme.dividerColor),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children:
                            ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
                                .map(
                                  (name) => Expanded(
                                    child: Center(
                                      child: Text(
                                        name,
                                        style: theme.textTheme.bodySmall
                                            ?.copyWith(
                                              fontWeight: FontWeight.w800,
                                            ),
                                      ),
                                    ),
                                  ),
                                )
                                .toList(),
                      ),
                      const SizedBox(height: 8),
                      GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: firstWeekday - 1 + daysInMonth,
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 7,
                              mainAxisSpacing: 6,
                              crossAxisSpacing: 6,
                            ),
                        itemBuilder: (context, index) {
                          if (index < firstWeekday - 1) {
                            return const SizedBox.shrink();
                          }
                          final day = index - (firstWeekday - 1) + 1;
                          final iso =
                              '$year-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
                          final dayTasks = _tasks
                              .where((task) => task.date == iso)
                              .toList();
                          final isSelected = iso == _selectedDate;
                          Color background;
                          Color foreground;
                          if (dayTasks.isEmpty) {
                            background = Colors.transparent;
                            foreground =
                                theme.textTheme.bodySmall?.color ?? Colors.grey;
                          } else if (dayTasks.every(
                            (task) => task.status == 'done',
                          )) {
                            background = const Color(
                              0xFF22C55E,
                            ).withValues(alpha: 0.18);
                            foreground = const Color(0xFF16A34A);
                          } else {
                            background = const Color(
                              0xFFF97316,
                            ).withValues(alpha: 0.18);
                            foreground = const Color(0xFFEA580C);
                          }
                          return GestureDetector(
                            onTap: () {
                              setState(() => _selectedDate = iso);
                              _tabController.animateTo(0);
                            },
                            child: Container(
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: background,
                                shape: BoxShape.circle,
                                border: isSelected
                                    ? Border.all(
                                        color: theme.colorScheme.primary,
                                        width: 2,
                                      )
                                    : null,
                              ),
                              child: Text(
                                '$day',
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 13,
                                  color: foreground,
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 14,
                  runSpacing: 6,
                  children: [
                    _legendDot(
                      theme,
                      const Color(0xFF22C55E),
                      'Tüm görevler tamam',
                    ),
                    _legendDot(
                      theme,
                      const Color(0xFFF97316),
                      'Eksik görev var',
                    ),
                    _legendDot(theme, theme.dividerColor, 'Plan yok'),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _legendDot(ThemeData theme, Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label, style: theme.textTheme.bodySmall),
      ],
    );
  }

  // ============ ANALİZ ============

  Widget _analyticsTab(ThemeData theme) {
    final now = DateTime.now();
    final last7 = List.generate(
      7,
      (index) => _isoDate(now.subtract(Duration(days: 6 - index))),
    );
    final perDay = last7
        .map(
          (iso) => _tasks
              .where((task) => task.date == iso && task.status == 'done')
              .fold<int>(0, (sum, task) => sum + task.durationMinutes),
        )
        .toList();
    final maxDay = perDay.fold<int>(60, math.max);
    final doneTasks = _tasks.where((task) => task.status == 'done').toList();
    final bySubject = <String, int>{};
    for (final task in doneTasks) {
      bySubject[task.subject] =
          (bySubject[task.subject] ?? 0) + task.durationMinutes;
    }
    final subjectRows = bySubject.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final maxSubject = subjectRows.fold<int>(
      1,
      (acc, entry) => math.max(acc, entry.value),
    );
    const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
        children: [
          ResponsiveContent(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _statCard(
                      theme,
                      icon: Icons.local_fire_department_rounded,
                      color: const Color(0xFFF97316),
                      value: '$_streak gün',
                      label: 'Çalışma Serisi'.tr,
                    ),
                    const SizedBox(width: 10),
                    _statCard(
                      theme,
                      icon: Icons.task_alt_rounded,
                      color: const Color(0xFF22C55E),
                      value: '${doneTasks.length}',
                      label: 'Tamamlanan Görev'.tr,
                    ),
                    const SizedBox(width: 10),
                    _statCard(
                      theme,
                      icon: Icons.timer_rounded,
                      color: const Color(0xFF6366F1),
                      value: _formatMinutes(
                        doneTasks.fold<int>(
                          0,
                          (sum, task) => sum + task.durationMinutes,
                        ),
                      ),
                      label: 'Toplam Süre'.tr,
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: theme.cardColor,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: theme.dividerColor),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Haftalık Çalışma Süresi'.tr,
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        height: 140,
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: List.generate(7, (index) {
                            final value = perDay[index];
                            return Expanded(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  if (value > 0)
                                    Text(
                                      _formatMinutes(value),
                                      style: theme.textTheme.bodySmall
                                          ?.copyWith(fontSize: 9),
                                    ),
                                  const SizedBox(height: 4),
                                  TweenAnimationBuilder<double>(
                                    tween: Tween(
                                      begin: 0,
                                      end: math.max(4, value / maxDay * 96),
                                    ),
                                    duration: const Duration(milliseconds: 600),
                                    curve: Curves.easeOutCubic,
                                    builder: (context, height, _) => Container(
                                      height: height,
                                      margin: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                      ),
                                      decoration: BoxDecoration(
                                        gradient: const LinearGradient(
                                          colors: [
                                            Color(0xFF6366F1),
                                            Color(0xFF3B82F6),
                                          ],
                                          begin: Alignment.bottomCenter,
                                          end: Alignment.topCenter,
                                        ),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    dayNames[(DateTime.parse(
                                              last7[index],
                                            ).weekday -
                                            1) %
                                        7],
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      fontSize: 10,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: theme.cardColor,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: theme.dividerColor),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Ders Bazlı Dağılım'.tr,
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 12),
                      if (subjectRows.isEmpty)
                        Text(
                          'Tamamlanan görev olunca dağılım burada görünür.'.tr,
                          style: theme.textTheme.bodySmall,
                        ),
                      ...subjectRows.map((entry) {
                        final color =
                            _subjectColors[entry.key] ??
                            const Color(0xFF64748B);
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      entry.key,
                                      style: theme.textTheme.bodyMedium
                                          ?.copyWith(
                                            fontWeight: FontWeight.w700,
                                          ),
                                    ),
                                  ),
                                  Text(
                                    _formatMinutes(entry.value),
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(999),
                                child: LinearProgressIndicator(
                                  value: entry.value / maxSubject,
                                  minHeight: 8,
                                  backgroundColor: theme.dividerColor
                                      .withValues(alpha: 0.4),
                                  valueColor: AlwaysStoppedAnimation<Color>(
                                    color,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ============ FORMLAR ============

  void _showAddTaskSheet() {
    final titleController = TextEditingController();
    final topicController = TextEditingController();
    var subject = 'Matematik';
    var duration = 45;
    var startTime = TimeOfDay.now();

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (sheetContext, setSheetState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                4,
                20,
                MediaQuery.of(sheetContext).viewInsets.bottom + 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Görev Ekle'.tr,
                    style: Theme.of(sheetContext).textTheme.titleLarge
                        ?.copyWith(fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: titleController,
                    decoration: InputDecoration(
                      labelText: 'Görev adı'.tr,
                      hintText: 'Örn: Üslü Sayılar Soru Çözümü'.tr,
                    ),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: subject,
                    decoration: const InputDecoration(labelText: 'Ders'),
                    items: _subjects
                        .map(
                          (item) =>
                              DropdownMenuItem(value: item, child: Text(item)),
                        )
                        .toList(),
                    onChanged: (value) =>
                        setSheetState(() => subject = value ?? subject),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: topicController,
                    decoration: InputDecoration(
                      labelText: 'Konu (opsiyonel)',
                      hintText: 'Örn: Konu Tekrarı'.tr,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () async {
                            final picked = await showTimePicker(
                              context: sheetContext,
                              initialTime: startTime,
                            );
                            if (picked != null) {
                              setSheetState(() => startTime = picked);
                            }
                          },
                          icon: const Icon(Icons.schedule_rounded, size: 18),
                          label: Text(
                            '${startTime.hour.toString().padLeft(2, '0')}:${startTime.minute.toString().padLeft(2, '0')}',
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: DropdownButtonFormField<int>(
                          initialValue: duration,
                          decoration: InputDecoration(labelText: 'Süre'.tr),
                          items: const [20, 30, 45, 60, 90, 120]
                              .map(
                                (item) => DropdownMenuItem(
                                  value: item,
                                  child: Text('$item dk'),
                                ),
                              )
                              .toList(),
                          onChanged: (value) =>
                              setSheetState(() => duration = value ?? duration),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: FilledButton(
                      onPressed: () async {
                        final title = titleController.text.trim();
                        if (title.isEmpty) return;
                        Navigator.pop(sheetContext);
                        try {
                          await _addTask(
                            title: title,
                            subject: subject,
                            topic: topicController.text.trim(),
                            startTime:
                                '${startTime.hour.toString().padLeft(2, '0')}:${startTime.minute.toString().padLeft(2, '0')}',
                            durationMinutes: duration,
                          );
                        } catch (error) {
                          if (!mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(error.toString())),
                          );
                        }
                      },
                      child: Text('Göreve Ekle'.tr),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showAddGoalSheet() {
    final titleController = TextEditingController();
    final targetController = TextEditingController(text: '10');
    final currentController = TextEditingController(text: '0');
    final unitController = TextEditingController();

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) {
        return Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            4,
            20,
            MediaQuery.of(sheetContext).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Yeni Hedef',
                style: Theme.of(
                  sheetContext,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: titleController,
                decoration: InputDecoration(
                  labelText: 'Hedef adı'.tr,
                  hintText: 'Örn: TYT Matematik Net 40+'.tr,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: targetController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Hedef'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: currentController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Mevcut'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: unitController,
                      decoration: const InputDecoration(
                        labelText: 'Birim',
                        hintText: 'net, soru',
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: FilledButton(
                  onPressed: () async {
                    final title = titleController.text.trim();
                    if (title.isEmpty) return;
                    Navigator.pop(sheetContext);
                    try {
                      await _addGoal(
                        title: title,
                        target: math.max(
                          1,
                          int.tryParse(targetController.text) ?? 1,
                        ),
                        current: math.max(
                          0,
                          int.tryParse(currentController.text) ?? 0,
                        ),
                        unit: unitController.text.trim(),
                      );
                    } catch (error) {
                      if (!mounted) return;
                      ScaffoldMessenger.of(
                        context,
                      ).showSnackBar(SnackBar(content: Text(error.toString())));
                    }
                  },
                  child: const Text('Hedefi Kaydet'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Apple Fitness tarzı animasyonlu ilerleme halkası.
class _ProgressRing extends StatelessWidget {
  final double progress;
  final String label;
  final double size;

  const _ProgressRing({
    required this.progress,
    required this.label,
    required this.size,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: progress.clamp(0.0, 1.0)),
      duration: const Duration(milliseconds: 900),
      curve: Curves.easeOutCubic,
      builder: (context, value, _) {
        return SizedBox(
          width: size,
          height: size,
          child: Stack(
            alignment: Alignment.center,
            children: [
              CustomPaint(
                size: Size.square(size),
                painter: _RingPainter(
                  progress: value,
                  trackColor: theme.dividerColor.withValues(alpha: 0.4),
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '%${(value * 100).round()}',
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Text(label, style: theme.textTheme.bodySmall),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}

class _RingPainter extends CustomPainter {
  final double progress;
  final Color trackColor;

  _RingPainter({required this.progress, required this.trackColor});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 10;
    final track = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, radius, track);

    if (progress <= 0) return;
    final rect = Rect.fromCircle(center: center, radius: radius);
    final gradientPaint = Paint()
      ..shader = const SweepGradient(
        startAngle: -math.pi / 2,
        endAngle: 3 * math.pi / 2,
        colors: [Color(0xFF3B82F6), Color(0xFF6366F1), Color(0xFFF97316)],
      ).createShader(rect)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
      rect,
      -math.pi / 2,
      2 * math.pi * progress,
      false,
      gradientPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _RingPainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.trackColor != trackColor;
}
