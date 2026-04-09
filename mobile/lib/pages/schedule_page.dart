import 'package:flutter/material.dart';

import '../services/auth_session_store.dart';
import '../services/school_feed_api_service.dart';
import 'live_lessons_page.dart';

class SchedulePage extends StatefulWidget {
  const SchedulePage({super.key});

  @override
  State<SchedulePage> createState() => _SchedulePageState();
}

class _SchedulePageState extends State<SchedulePage>
    with TickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fadeAnim;
  late final Animation<Offset> _slideAnim;

  final List<String> _days = const ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"];
  late int _selectedDay;
  Map<int, List<Map<String, String>>> _weeklyLessons = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    final weekday = DateTime.now().weekday;
    _selectedDay = weekday >= 1 && weekday <= 7 ? weekday - 1 : 0;

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );
    _fadeAnim = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.06),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic));
    _controller.forward();
    _loadSchedule();
  }

  Future<void> _loadSchedule() async {
    final session = await AuthSessionStore.instance.load();
    final studentName = await SchoolFeedApiService.resolveLinkedStudentName(session);
    final lessons = await SchoolFeedApiService.instance.fetchLiveLessons();
    final studentLessons = lessons.where((lesson) {
      if (session?.primaryRole == 'Student' || session?.primaryRole == 'Parent') {
        return studentName.isEmpty || lesson.className.isNotEmpty;
      }
      return true;
    }).toList();
    final schedule = <int, List<Map<String, String>>>{};
    for (final lesson in studentLessons) {
      if (lesson.startsAt == null) continue;
      final day = lesson.startsAt!.weekday - 1;
      final type = lesson.platform.toLowerCase().contains('online') ? "Canli Ders" : "Sinif Ici";
      schedule.putIfAbsent(day, () => []);
      schedule[day]!.add({
        "time": '${lesson.startsAt!.hour.toString().padLeft(2, '0')}:${lesson.startsAt!.minute.toString().padLeft(2, '0')}',
        "title": lesson.title,
        "detail": '${lesson.className} • ${lesson.teacher}',
        "type": type,
      });
    }
    for (var day = 0; day < 7; day++) {
      schedule.putIfAbsent(day, () => []);
      schedule[day]!.sort((a, b) => (a["time"] ?? '').compareTo(b["time"] ?? ''));
    }
    if (!mounted) return;
    setState(() {
      _weeklyLessons = schedule;
      _loading = false;
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  bool _isDark(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark;

  @override
  Widget build(BuildContext context) {
    final lessons = _weeklyLessons[_selectedDay] ?? const [];
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text("Ders Programi"),
      ),
      body: FadeTransition(
        opacity: _fadeAnim,
        child: SlideTransition(
          position: _slideAnim,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _dayTabs(theme),
                const SizedBox(height: 16),
                if (_loading)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 12),
                    child: LinearProgressIndicator(),
                  ),
                Text(
                  "${_days[_selectedDay]} gunu programi",
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 12),
                if (lessons.isEmpty)
                  _emptyCard(theme)
                else
                  ...lessons.map((lesson) => _lessonTile(theme, lesson)),
                const SizedBox(height: 24),
                _liveSummary(theme),
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
        itemCount: _days.length,
        separatorBuilder: (context, index) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final isSelected = _selectedDay == index;
          return InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: () => setState(() => _selectedDay = index),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              decoration: BoxDecoration(
                color: isSelected
                    ? const Color(0xFFFF7A45)
                    : _isDark(context)
                        ? const Color(0xFF1E1E1E)
                        : Colors.grey.shade200,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Center(
                child: Text(
                  _days[index],
                  style: TextStyle(
                    color: isSelected ? Colors.white : theme.textTheme.bodyMedium?.color,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _lessonTile(ThemeData theme, Map<String, String> lesson) {
    final isLive = lesson["type"] == "Canli Ders";
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: () {
        if (isLive) {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const LiveLessonsPage()),
          );
        }
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _isDark(context) ? const Color(0xFF1E1E1E) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Column(
              children: [
                Icon(
                  isLive ? Icons.live_tv_rounded : Icons.access_time,
                  size: 18,
                  color: isLive ? const Color(0xFFFF7A45) : null,
                ),
                const SizedBox(height: 4),
                Text(
                  lesson["time"] ?? "",
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    lesson["title"] ?? "",
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    lesson["detail"] ?? "",
                    style: TextStyle(color: theme.textTheme.bodySmall?.color),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: isLive
                        ? const Color(0xFFFF7A45).withValues(alpha: 0.14)
                        : Colors.blueGrey.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    lesson["type"] ?? "",
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: isLive ? const Color(0xFFFF7A45) : Colors.blueGrey,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Icon(
                  Icons.chevron_right_rounded,
                  color: isLive ? const Color(0xFFFF7A45) : Colors.grey,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _liveSummary(ThemeData theme) {
    final liveCount = _weeklyLessons.values
        .expand((items) => items)
        .where((item) => item["type"] == "Canli Ders")
        .length;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFF9A3D), Color(0xFFFF7A00)],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.video_collection_rounded, color: Colors.white),
              SizedBox(width: 8),
              Text(
                "Canli Ders Ozet ve Tekrar",
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            "Takvimdeki canli dersleri acmak icin bu alani kullan. Liste backend duyurularindan beslenir.",
            style: TextStyle(color: Colors.white),
          ),
          const SizedBox(height: 10),
          Text(
            'Toplam canli ders kaydi: $liveCount',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _summaryButton("Canli Derse Git", Icons.live_tv_rounded, () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const LiveLessonsPage()),
                );
              }),
              _summaryButton("Tekrar Izle", Icons.replay_circle_filled_rounded, () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const LiveLessonsPage()),
                );
              }),
            ],
          ),
        ],
      ),
    );
  }

  Widget _summaryButton(String label, IconData icon, VoidCallback onTap) {
    return FilledButton.icon(
      onPressed: onTap,
      style: FilledButton.styleFrom(
        backgroundColor: Colors.white.withValues(alpha: 0.18),
        foregroundColor: Colors.white,
      ),
      icon: Icon(icon),
      label: Text(label),
    );
  }

  Widget _emptyCard(ThemeData theme) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _isDark(context) ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Text(
        "Secilen gun icin tanimli ders bulunmuyor.",
        style: theme.textTheme.bodyMedium,
      ),
    );
  }
}
