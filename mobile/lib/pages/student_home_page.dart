import 'package:flutter/material.dart';

import '../widgets/header_widget.dart';
import '../widgets/summary_cards.dart';
import '../widgets/achievements_widget.dart';
import '../widgets/quick_actions.dart';
import '../widgets/responsive_layout.dart';
import '../widgets/stylus_drawing_canvas.dart';

import '../pages/messages_page.dart';
import '../pages/question_bank_page.dart';
import '../pages/announcements_page.dart';
import '../pages/schedule_page.dart';
import '../pages/student_exam_history_page.dart';
import '../pages/student_attendance_scan_page.dart';
import '../pages/student_notifications_page.dart';
import '../pages/student_study_plan_page.dart';
import '../pages/student_question_page.dart';
import '../pages/student_wrong_answers_page.dart';
import '../pages/student_attendance_history_page.dart';
import '../pages/exam_analysis_page.dart';

import '../pages/lessons_page.dart';
import '../pages/exams_page.dart';
import '../pages/homework_page.dart';
import '../services/auth_session_store.dart';
import '../services/school_feed_api_service.dart';

class StudentHomePage extends StatefulWidget {
  const StudentHomePage({super.key});

  @override
  State<StudentHomePage> createState() => _StudentHomePageState();
}

class _StudentHomePageState extends State<StudentHomePage>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  int achievementRefreshKey = 0;
  String _studentName = 'Öğrenci';

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );

    _fadeAnimation = Tween<double>(begin: 0, end: 1).animate(_controller);

    _controller.forward();
    _loadStudent();
  }

  Future<void> _loadStudent() async {
    final session = await AuthSessionStore.instance.load();
    final resolved = await SchoolFeedApiService.resolveLinkedStudentName(
      session,
    );
    if (!mounted) return;
    setState(() {
      _studentName = resolved.isEmpty ? 'Öğrenci' : resolved;
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// SUMMARY CARD NAVIGATION

  void goToLessons() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const LessonsPage()),
    );
  }

  void goToExams() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const ExamsPage()),
    );
  }

  void goToHomework() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const HomeworkPage()),
    );
  }

  /// QUICK ACTION NAVIGATION

  void goToMessages() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const MessagesPage()),
    );
  }

  void goToQuestionBank() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const QuestionBankPage()),
    );
  }

  void goToAnnouncements() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const AnnouncementsPage()),
    );
  }

  void goToSchedule() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const SchedulePage()),
    );
  }

  void goToQuestionPage() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const StudentQuestionPage()),
    );
  }

  void goToAttendanceScan() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const StudentAttendanceScanPage()),
    );
  }

  void goToStudyPlan() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const StudentStudyPlanPage()),
    ).then((_) {
      if (!mounted) return;
      setState(() {
        achievementRefreshKey++;
      });
    });
  }

  void goToExamResults() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => StudentExamHistoryPage(
          studentName: _studentName,
          title: 'Sınav Sonuçlarım',
        ),
      ),
    );
  }

  void goToNotifications() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const StudentNotificationsPage()),
    );
  }

  void goToWrongAnswers() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const StudentWrongAnswersPage()),
    );
  }

  void goToAttendanceHistory() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const StudentAttendanceHistoryPage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton:
          ResponsiveLayout.supportsStylusInput &&
              ResponsiveLayout.isTablet(context)
          ? FloatingActionButton(
              onPressed: () => StylusDrawingCanvas.open(context),
              backgroundColor: const Color(0xFFD9790B),
              child: const Icon(Icons.draw_rounded, color: Colors.white),
            )
          : null,
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeAnimation,

          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: ResponsiveContent(
              child: ResponsiveLayout.isTablet(context)
                  ? Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              HeaderWidget(
                                key: ValueKey(achievementRefreshKey),
                              ),
                              const SizedBox(height: 16),
                              const QuickActions(),
                              const SizedBox(height: 20),
                              SummaryCards(
                                onLessonsTap: goToLessons,
                                onExamTap: goToExams,
                                onHomeworkTap: goToHomework,
                                onResultsTap: goToExamResults,
                              ),
                              const SizedBox(height: 20),
                              AchievementsWidget(
                                refreshKey: achievementRefreshKey,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 20),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _focusPanel(),
                              const SizedBox(height: 20),
                              _studentExtraPanel(),
                            ],
                          ),
                        ),
                      ],
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        HeaderWidget(key: ValueKey(achievementRefreshKey)),
                        const SizedBox(height: 16),
                        const QuickActions(),
                        const SizedBox(height: 20),
                        SummaryCards(
                          onLessonsTap: goToLessons,
                          onExamTap: goToExams,
                          onHomeworkTap: goToHomework,
                          onResultsTap: goToExamResults,
                        ),
                        const SizedBox(height: 20),
                        AchievementsWidget(refreshKey: achievementRefreshKey),
                        const SizedBox(height: 20),
                        _focusPanel(),
                        const SizedBox(height: 20),
                        _studentExtraPanel(),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _studentExtraPanel() {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Öğrenci Gelişim Alanları',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Yanlışlarını tekrar listesinde topla ve öğretmen, ödev, sınav hareketlerini canlı bildirim kutusundan izle.',
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _miniAction(
                  title: "Yanlış Defteri",
                  icon: Icons.menu_book_outlined,
                  color: const Color(0xFFEF4444),
                  onTap: goToWrongAnswers,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _miniAction(
                  title: "Canlı Bildirim",
                  icon: Icons.notifications_active_outlined,
                  color: const Color(0xFF7C3AED),
                  onTap: goToNotifications,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _miniAction(
                  title: "Devamsızlık",
                  icon: Icons.event_busy_outlined,
                  color: const Color(0xFFB42318),
                  onTap: goToAttendanceHistory,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _focusPanel() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.18)
                : Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Bugünkü Öğrenci Paneli",
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            "QR yoklamaya katıl, öğretmenine soru gönder ve otomatik oluşan çalışma planını takip et.",
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.textTheme.bodyMedium?.color?.withValues(alpha: 0.72),
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _miniAction(
                title: "Soru Sor",
                icon: Icons.help_center_rounded,
                color: const Color(0xFF2563EB),
                onTap: goToQuestionPage,
              ),
              _miniAction(
                title: "Mesajlar",
                icon: Icons.chat_bubble_outline_rounded,
                color: const Color(0xFF2563EB),
                onTap: goToMessages,
              ),
              _miniAction(
                title: "QR Yoklama",
                icon: Icons.qr_code_scanner_rounded,
                color: const Color(0xFF0EA5A4),
                onTap: goToAttendanceScan,
              ),
              _miniAction(
                title: "Sınav Sonuçlarım",
                icon: Icons.bar_chart_rounded,
                color: const Color(0xFFF59E0B),
                onTap: goToExamResults,
              ),
              _miniAction(
                title: "Detaylı Analiz",
                icon: Icons.insights_rounded,
                color: const Color(0xFF7C3AED),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const ExamAnalysisPage()),
                ),
              ),
              _miniAction(
                title: "Çalışma Planım",
                icon: Icons.event_note_rounded,
                color: const Color(0xFF10B981),
                onTap: goToStudyPlan,
              ),
              _miniAction(
                title: "Devamsızlık",
                icon: Icons.rule_folder_outlined,
                color: const Color(0xFFB42318),
                onTap: goToAttendanceHistory,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _miniAction({
    required String title,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        width: 150,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: color.withValues(alpha: 0.24)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
