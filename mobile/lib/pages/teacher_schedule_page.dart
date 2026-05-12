import 'package:flutter/material.dart';
import 'package:student/pages/teacher_attendance_page.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/school_feed_api_service.dart';
import 'package:student/services/student_registry_store.dart';
import 'package:student/widgets/adaptive_scaffold.dart';
import 'package:student/widgets/responsive_overlays.dart';

class TeacherSchedulePage extends StatefulWidget {
  const TeacherSchedulePage({super.key});

  @override
  State<TeacherSchedulePage> createState() => _TeacherSchedulePageState();
}

class _TeacherSchedulePageState extends State<TeacherSchedulePage> {
  String selectedDay = "Bugün";
  String _teacherName = '';
  Map<String, Map<String, dynamic>> weeklySchedule = {};

  @override
  void initState() {
    super.initState();
    _loadSchedule();
  }

  Future<void> _loadSchedule() async {
    final session = await AuthSessionStore.instance.load();
    final teacherName = session?.fullName ?? _teacherName;
    final lessons = await SchoolFeedApiService.instance.fetchLiveLessons();
    await StudentRegistryStore.instance.ensureLoaded();
    final classCounts = <String, int>{};
    for (final student in StudentRegistryStore.instance.students) {
      final className = student.className.trim();
      if (className.isEmpty) continue;
      classCounts[className] = (classCounts[className] ?? 0) + 1;
    }
    final generated = _buildSchedule(
      lessons.where((lesson) {
        return _normalizeText(lesson.teacher) == _normalizeText(teacherName);
      }).toList(),
      classCounts,
    );
    if (!mounted) return;
    setState(() {
      _teacherName = teacherName;
      weeklySchedule = generated;
      selectedDay = generated.keys.first;
    });
  }

  Map<String, Map<String, dynamic>> _buildSchedule(
    List<LiveLessonRecord> lessons,
    Map<String, int> classCounts,
  ) {
    if (lessons.isEmpty) {
      return {
        'Bugün': {
          'label': 'Bugün',
          'date': 'Planlı ders yok',
          'lessons': <Map<String, dynamic>>[],
        },
      };
    }

    const dayNames = [
      'Pazartesi',
      'Sali',
      'Carsamba',
      'Persembe',
      'Cuma',
      'Cumartesi',
      'Pazar',
    ];

    final schedule = <String, Map<String, dynamic>>{};
    for (final lesson in lessons) {
      final date = lesson.startsAt?.toLocal() ?? DateTime.now();
      final dayKey = dayNames[date.weekday - 1];
      final label = _labelForDate(date);
      final day = schedule.putIfAbsent(
        dayKey,
        () => {
          'label': label,
          'date': '${date.day}.${date.month}.${date.year} $dayKey',
          'lessons': <Map<String, dynamic>>[],
        },
      );
      (day['lessons'] as List<Map<String, dynamic>>).add({
        'id': lesson.id,
        'time': lesson.timeLabel,
        'title': lesson.title,
        'platform': lesson.platform,
        'className': lesson.className,
        'studentCount': classCounts[lesson.className] ?? 0,
        'dateText': '${date.day}.${date.month}.${date.year}',
        'dayText': dayKey,
        'color': lesson.platform == 'Zoom'
            ? const Color(0xFF2563EB)
            : const Color(0xFF7C3AED),
      });
    }

    for (final item in schedule.values) {
      (item['lessons'] as List<Map<String, dynamic>>).sort(
        (a, b) => (a['time'] as String).compareTo(b['time'] as String),
      );
    }

    return schedule;
  }

  String _labelForDate(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final current = DateTime(date.year, date.month, date.day);
    if (current == today) return 'Bugün';
    if (current == today.add(const Duration(days: 1))) return 'Yarın';
    return '${date.day}.${date.month}';
  }

  String _normalizeText(String value) {
    return value
        .trim()
        .toLowerCase()
        .replaceAll('ç', 'c')
        .replaceAll('ğ', 'g')
        .replaceAll('ı', 'i')
        .replaceAll('ö', 'o')
        .replaceAll('ş', 's')
        .replaceAll('ü', 'u');
  }

  Map<String, dynamic> get currentDayData =>
      weeklySchedule[selectedDay] ?? weeklySchedule.values.first;

  List<Map<String, dynamic>> get currentLessons =>
      (currentDayData["lessons"] as List).cast<Map<String, dynamic>>();

  int get onlineCount => currentLessons
      .where(
        (item) =>
            (item["platform"] as String?)?.toLowerCase().contains('zoom') ==
            true,
      )
      .length;

  int get totalStudents => currentLessons.fold<int>(
    0,
    (sum, item) => sum + ((item["studentCount"] as int?) ?? 0),
  );

  int get weeklyStudents => weeklySchedule.values.fold<int>(
    0,
    (sum, day) =>
        sum +
        (day["lessons"] as List<dynamic>? ?? const [])
            .cast<Map<String, dynamic>>()
            .fold<int>(
              0,
              (lessonSum, lesson) =>
                  lessonSum + ((lesson["studentCount"] as int?) ?? 0),
            ),
  );

  void _showLessonMenu(Map<String, dynamic> lesson) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: ResponsiveSheetContainer(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(
                      backgroundColor: (lesson["color"] as Color).withValues(
                        alpha: 0.14,
                      ),
                      foregroundColor: lesson["color"] as Color,
                      child: const Icon(Icons.info_outline_rounded),
                    ),
                    title: Text(
                      lesson["title"] as String,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      "${lesson["time"]} • ${lesson["platform"]} • ${lesson["className"]}",
                    ),
                  ),
                  const SizedBox(height: 8),
                  _sheetAction(
                    icon: Icons.edit_calendar_rounded,
                    title: "Dersi Düzenle",
                    onTap: () {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(this.context).showSnackBar(
                        const SnackBar(
                          content: Text("Ders düzenleme paneli açıldı."),
                        ),
                      );
                    },
                  ),
                  _sheetAction(
                    icon: Icons.groups_rounded,
                    title: "Yoklama / Katılım",
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(
                        this.context,
                        MaterialPageRoute(
                          builder: (_) => TeacherAttendancePage(
                            initialLessonTitle: lesson["title"] as String,
                          ),
                        ),
                      );
                    },
                  ),
                  _sheetAction(
                    icon: Icons.message_rounded,
                    title: "Sınıfa Mesaj Gönder",
                    onTap: () {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(this.context).showSnackBar(
                        const SnackBar(
                          content: Text("Sınıf mesaj paneli açıldı."),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final hasSidebar = SidebarState.of(context);

    return Scaffold(
      backgroundColor: isDark
          ? const Color(0xFF121212)
          : const Color(0xFFF2F2F2),
      appBar: hasSidebar
          ? null
          : AppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              title: Text(
                "Ders Programım",
                style: TextStyle(
                  color: isDark ? Colors.white : Colors.black,
                  fontWeight: FontWeight.bold,
                ),
              ),
              actions: [
                Padding(
                  padding: const EdgeInsets.only(right: 16),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 120),
                    child: Center(
                      child: Text(
                        _teacherName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isDark ? Colors.white70 : Colors.black54,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
              ],
            ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _headerCard(isDark),
            _dayTabs(isDark),
            const SizedBox(height: 8),
            _scheduleList(theme, isDark),
            _legendRow(isDark),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _headerCard(bool isDark) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isDark
              ? const [Color(0xFF111827), Color(0xFF1F2937)]
              : const [Color(0xFF111827), Color(0xFFFF7A00)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "Haftalık Görünüm",
            style: TextStyle(
              color: Colors.white70,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            currentDayData["date"] as String,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            "${currentLessons.length} ders • $totalStudents öğrenci",
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Colors.white70, height: 1.35),
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              StatMini("${currentLessons.length}", "Toplam\nDers"),
              StatMini("$onlineCount", "Online"),
              StatMini("$totalStudents", "Öğrenci"),
              StatMini("$weeklyStudents", "Haftalık\nYoğunluk"),
            ],
          ),
        ],
      ),
    );
  }

  Widget _dayTabs(bool isDark) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        children: weeklySchedule.keys.map((dayKey) {
          return _tabItem(
            weeklySchedule[dayKey]!["label"] as String,
            selectedDay == dayKey,
            isDark,
            lessonCount:
                ((weeklySchedule[dayKey]!["lessons"] as List<dynamic>?) ??
                        const [])
                    .length,
            onTap: () {
              setState(() {
                selectedDay = dayKey;
              });
            },
          );
        }).toList(),
      ),
    );
  }

  Widget _tabItem(
    String title,
    bool active,
    bool isDark, {
    required int lessonCount,
    required VoidCallback onTap,
  }) {
    return SizedBox(
      width: 104,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: active
                ? const Color(0xFFFF7A00)
                : isDark
                ? const Color(0xFF1E1E1E)
                : Colors.white,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: active
                  ? const Color(0xFFFF7A00)
                  : Colors.grey.withValues(alpha: 0.16),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: active
                      ? Colors.white
                      : (isDark ? Colors.white70 : Colors.black),
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                "$lessonCount ders",
                style: TextStyle(
                  color: active
                      ? Colors.white70
                      : (isDark ? Colors.white54 : Colors.black54),
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _scheduleList(ThemeData theme, bool isDark) {
    return Column(
      children: currentLessons
          .map((lesson) => _scheduleTile(theme, lesson, isDark))
          .toList(),
    );
  }

  Widget _scheduleTile(
    ThemeData theme,
    Map<String, dynamic> lesson,
    bool isDark,
  ) {
    final color = lesson["color"] as Color;
    final className = lesson["className"] as String? ?? '-';
    final platform = lesson["platform"] as String? ?? '-';
    final studentCount = lesson["studentCount"] as int? ?? 0;
    final metaTextColor = isDark ? Colors.white70 : const Color(0xFF64748B);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: color.withValues(alpha: 0.16)),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.18)
                : color.withValues(alpha: 0.10),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 76,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "SAAT",
                  style: TextStyle(
                    color: color.withValues(alpha: 0.82),
                    fontSize: 11,
                    letterSpacing: 1.1,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  lesson["time"] as String,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: color,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        lesson["title"] as String,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isDark
                              ? Colors.white
                              : const Color(0xFF0F172A),
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      constraints: const BoxConstraints(minHeight: 28),
                      decoration: BoxDecoration(
                        color: isDark
                            ? Colors.white.withValues(alpha: 0.08)
                            : const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: isDark
                              ? Colors.white.withValues(alpha: 0.10)
                              : const Color(0xFFE2E8F0),
                        ),
                      ),
                      child: Text(
                        className,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isDark
                              ? Colors.white70
                              : const Color(0xFF334155),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    _metaChip(
                      icon: Icons.videocam_rounded,
                      text: platform,
                      textColor: metaTextColor,
                      isDark: isDark,
                    ),
                    _metaChip(
                      icon: Icons.groups_rounded,
                      text: "$studentCount öğrenci",
                      textColor: metaTextColor,
                      isDark: isDark,
                    ),
                    _metaChip(
                      icon: Icons.calendar_today_rounded,
                      text: lesson["dateText"] as String? ?? '',
                      textColor: metaTextColor,
                      isDark: isDark,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  "${lesson["dayText"]} • ${lesson["time"]}",
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: metaTextColor,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 2),
          IconButton(
            onPressed: () => _showLessonMenu(lesson),
            visualDensity: VisualDensity.compact,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            icon: Icon(
              Icons.more_horiz_rounded,
              size: 20,
              color: isDark ? Colors.white : Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  Widget _metaChip({
    required IconData icon,
    required String text,
    required Color textColor,
    required bool isDark,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.06)
            : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : const Color(0xFFE2E8F0),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: textColor),
          const SizedBox(width: 5),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 96),
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: textColor,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _legendRow(bool isDark) {
    final textColor = isDark ? Colors.white70 : Colors.black87;

    return Padding(
      padding: const EdgeInsets.all(12),
      child: Wrap(
        spacing: 16,
        runSpacing: 10,
        alignment: WrapAlignment.center,
        children: [
          _legendItem(const Color(0xFF2563EB), "Ders", textColor),
          _legendItem(const Color(0xFF7C3AED), "Online", textColor),
          _legendItem(const Color(0xFF16A34A), "Etut/Çalışma", textColor),
          _legendItem(const Color(0xFFFF7A00), "Sınav", textColor),
        ],
      ),
    );
  }

  static Widget _legendItem(Color color, String text, Color textColor) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
        const SizedBox(width: 6),
        Text(text, style: TextStyle(color: textColor)),
      ],
    );
  }

  Widget _sheetAction({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
  }) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        backgroundColor: const Color(0xFFFF7A00).withValues(alpha: 0.14),
        foregroundColor: const Color(0xFFFF7A00),
        child: Icon(icon),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
      onTap: onTap,
    );
  }
}

class StatMini extends StatelessWidget {
  final String value;
  final String label;

  const StatMini(this.value, this.label, {super.key});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 72,
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 18,
            ),
          ),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
