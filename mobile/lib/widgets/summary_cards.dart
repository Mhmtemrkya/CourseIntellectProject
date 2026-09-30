import 'card_system.dart';
import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
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

  bool _isMockExam(PlannedExamRecord exam) {
    final type = exam.type.trim().toLowerCase();
    return type == 'mockexam' || type.contains('deneme');
  }

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
      final studentClassName = session == null
          ? ''
          : await SchoolFeedApiService.resolveLinkedStudentClassName(session);

      final liveLessons = await SchoolFeedApiService.instance
          .fetchLiveLessons();
      final plannedExams = await PlannedExamApiService.instance
          .fetchPlannedExams(
            studentName: studentName,
            studentUsername: session?.username,
            className: studentClassName,
          );
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
        _upcomingExamCount = plannedExams
            .where((item) => !_isMockExam(item))
            .length;
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
        title: "Bugünkü Ders".tr,
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
        title: "Sınavlarım".tr,
        value: _loading ? "..." : "$_upcomingExamCount",
        hint: _upcomingExamCount > 0
            ? "Çözmeye hazır sınavlar var"
            : "Yaklaşan sınav bulunmuyor",
        color: const Color(0xFF7C3AED),
        onTap: widget.onExamTap,
      ),
      _card(
        context,
        icon: Icons.bar_chart_rounded,
        title: "Sınav Sonuçlarım".tr,
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
        title: "Bekleyen Ödev".tr,
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

    return LayoutBuilder(
      builder: (context, constraints) {
        final width =
            (constraints.maxWidth - (crossAxisCount - 1) * 12) / crossAxisCount;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (final card in cards) SizedBox(width: width, child: card),
          ],
        );
      },
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
    return VividMetricCard(
      title: title,
      value: value,
      caption: hint.tr,
      icon: icon,
      onTap: onTap,
    );
  }
}
