import 'package:flutter/material.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/homework_api_service.dart';
import 'package:student/services/planned_exam_api_service.dart';
import 'package:student/services/school_feed_api_service.dart';
import 'responsive_layout.dart';

class SummaryCards extends StatefulWidget {
  final VoidCallback onLessonsTap;
  final VoidCallback onExamTap;
  final VoidCallback onHomeworkTap;
  final VoidCallback onResultsTap;

  const SummaryCards({
    super.key,
    required this.onLessonsTap,
    required this.onExamTap,
    required this.onHomeworkTap,
    required this.onResultsTap,
  });

  @override
  State<SummaryCards> createState() => _SummaryCardsState();
}

class _SummaryCardsState extends State<SummaryCards> {
  bool _loading = true;
  int _liveLessonCount = 0;
  int _upcomingExamCount = 0;
  int _examResultCount = 0;
  int _pendingHomeworkCount = 0;

  @override
  void initState() {
    super.initState();
    _loadSummary();
  }

  Future<void> _loadSummary() async {
    try {
      final session = await AuthSessionStore.instance.load();
      final studentName = session == null
          ? ''
          : await SchoolFeedApiService.resolveLinkedStudentName(session);

      final liveLessons = await SchoolFeedApiService.instance
          .fetchLiveLessons();
      final plannedExams = await PlannedExamApiService.instance
          .fetchPlannedExams(studentName: studentName);
      final examResults = await SchoolFeedApiService.instance.fetchExamResults(
        studentName: studentName,
      );
      final assignments = await HomeworkApiService.instance.fetchAssignments();
      final pendingHomework = assignments.where((item) {
        final submissions = List<Map<String, dynamic>>.from(
          item["submissions"] as List<dynamic>? ?? const [],
        );
        return !submissions.any((entry) => entry["studentName"] == studentName);
      }).length;

      if (!mounted) return;
      setState(() {
        _liveLessonCount = liveLessons.length;
        _upcomingExamCount = plannedExams.length;
        _examResultCount = examResults.length;
        _pendingHomeworkCount = pendingHomework;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cards = [
      _card(
        context,
        icon: Icons.calendar_today_rounded,
        title: "Bugünkü Ders",
        value: _loading ? "..." : "$_liveLessonCount",
        hint: _liveLessonCount > 0
            ? "Canlı ders kayıtları hazır"
            : "Bugün görünen canlı ders yok",
        color: const Color(0xFFF59E0B),
        onTap: widget.onLessonsTap,
      ),
      _card(
        context,
        icon: Icons.track_changes_rounded,
        title: "Yaklaşan Sınav",
        value: _loading ? "..." : "$_upcomingExamCount",
        hint: _upcomingExamCount > 0
            ? "Planlı sınavlar hazır"
            : "Yaklaşan sınav bulunmuyor",
        color: const Color(0xFF7C3AED),
        onTap: widget.onExamTap,
      ),
      _card(
        context,
        icon: Icons.bar_chart_rounded,
        title: "Sınav Sonuçlarım",
        value: _loading ? "..." : "$_examResultCount",
        hint: _examResultCount > 0
            ? "Tüm notlar bir arada"
            : "Henüz sonuç kaydı yok",
        color: const Color(0xFF2563EB),
        onTap: widget.onResultsTap,
      ),
      _card(
        context,
        icon: Icons.book_rounded,
        title: "Bekleyen Ödev",
        value: _loading ? "..." : "$_pendingHomeworkCount",
        hint: _pendingHomeworkCount > 0
            ? "Teslim takibi gerekli"
            : "Bekleyen ödev bulunmuyor",
        color: const Color(0xFFEA580C),
        onTap: widget.onHomeworkTap,
      ),
    ];

    final crossAxisCount = ResponsiveLayout.columns(
      context,
      phone: 2,
      tablet: 2,
      largeTablet: 4,
    );

    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: crossAxisCount,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: crossAxisCount == 4 ? 1.35 : 1.05,
      children: cards,
    );
  }

  Widget _card(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String value,
    required String hint,
    required Color color,
    required VoidCallback onTap,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: isDark
                ? [color.withValues(alpha: 0.22), theme.cardColor]
                : [color.withValues(alpha: 0.14), theme.cardColor],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: color.withValues(alpha: isDark ? 0.22 : 0.16),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isDark ? 0.16 : 0.05),
              blurRadius: 18,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(icon, color: color),
                  ),
                  if (value.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: theme.scaffoldBackgroundColor.withValues(
                          alpha: 0.62,
                        ),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        value,
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                          color: color,
                        ),
                      ),
                    ),
                ],
              ),
              const Spacer(),
              Text(
                title,
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                hint,
                style: theme.textTheme.bodySmall?.copyWith(
                  height: 1.35,
                  color: theme.textTheme.bodySmall?.color?.withValues(
                    alpha: 0.72,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Text(
                    'Detayi ac',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: color,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const Spacer(),
                  Icon(Icons.chevron_right_rounded, color: color, size: 20),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
