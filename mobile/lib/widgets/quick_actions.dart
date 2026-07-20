import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import 'package:student/pages/announcements_page.dart';
import 'package:student/pages/exam_analysis_page.dart';
import 'package:student/pages/exams_page.dart';
import 'package:student/pages/homework_page.dart';
import 'package:student/pages/live_lessons_page.dart';
import 'package:student/pages/messages_page.dart';
import 'package:student/pages/question_bank_page.dart';
import 'package:student/pages/schedule_page.dart';
import 'package:student/pages/student_attendance_history_page.dart';
import 'package:student/pages/student_exam_history_page.dart';
import 'package:student/pages/student_wrong_answers_page.dart';
import 'package:student/pages/student_attendance_scan_page.dart';
import 'package:student/pages/student_study_plan_page.dart';
import 'package:student/pages/student_question_page.dart';
import 'package:student/services/tenant_feature_service.dart';
import 'package:student/features/assistant/presentation/assistant_page.dart';
import 'responsive_layout.dart';

class QuickActions extends StatelessWidget {
  const QuickActions({super.key});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Set<String>>(
      future: TenantFeatureService.instance.disabledFeatures(),
      builder: (context, snapshot) {
        final disabled = snapshot.data ?? const <String>{};
        return _buildContent(context, disabled);
      },
    );
  }

  Widget _buildContent(BuildContext context, Set<String> disabled) {
    final allActions = [
      (
        Icons.auto_awesome_rounded,
        "AI Asistan",
        const Color(0xFFF59E0B),
        const AssistantPage(),
        '',
      ),
      (
        Icons.message_rounded,
        "Mesajlar",
        Colors.blue,
        const MessagesPage(),
        'messaging',
      ),
      (
        Icons.help_center_rounded,
        "Soru Sor",
        const Color(0xFF2563EB),
        const StudentQuestionPage(),
        'questionBox',
      ),
      (
        Icons.qr_code_scanner_rounded,
        "QR Yoklama",
        const Color(0xFF0EA5A4),
        const StudentAttendanceScanPage(),
        'attendance',
      ),
      (
        Icons.event_note_rounded,
        "Çalışma Planım",
        const Color(0xFF10B981),
        const StudentStudyPlanPage(),
        'studyPlan',
      ),
      (
        Icons.assignment_rounded,
        "Ödevler",
        const Color(0xFFF97316),
        const HomeworkPage(),
        'homework',
      ),
      (
        Icons.fact_check_rounded,
        "Sınavlarım",
        const Color(0xFF7C3AED),
        const ExamsPage(),
        'exams',
      ),
      (
        Icons.workspace_premium_rounded,
        "Deneme Sınavları",
        const Color(0xFFF97316),
        const ExamsPage(mockOnly: true),
        'exams',
      ),
      (
        Icons.insights_rounded,
        "Sınav Sonuçları",
        const Color(0xFF2563EB),
        StudentExamHistoryPage(
          studentName: '',
          title: 'Sınav Sonuçlarım'.tr,
        ),
        'exams',
      ),
      (
        Icons.error_outline_rounded,
        "Yanlışlarım",
        const Color(0xFFDC2626),
        const StudentWrongAnswersPage(),
        'questionBank',
      ),
      (
        Icons.event_busy_rounded,
        "Devamsızlık",
        const Color(0xFFB45309),
        const StudentAttendanceHistoryPage(),
        'attendance',
      ),
      (
        Icons.analytics_rounded,
        "Detaylı Analiz",
        const Color(0xFF0891B2),
        const ExamAnalysisPage(),
        'reports',
      ),
      (
        Icons.quiz_rounded,
        "Soru Bankası",
        Colors.green,
        const QuestionBankPage(),
        'questionBank',
      ),
      (
        Icons.campaign_rounded,
        "Duyurular",
        Colors.orange,
        const AnnouncementsPage(),
        'announcements',
      ),
      (
        Icons.calendar_today_rounded,
        "Ders Programı",
        Colors.purple,
        const SchedulePage(),
        '',
      ),
      (
        Icons.videocam_rounded,
        "Canlı Derslerim",
        Colors.redAccent,
        const LiveLessonsPage(),
        'liveLessons',
      ),
    ];
    // Platform yöneticisinin kuruma kapattığı modüller kısayollardan gizlenir.
    final actions = allActions
        .where((item) => item.$5.isEmpty || !disabled.contains(item.$5))
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "Hızlı İşlemler".tr,
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),
        ResponsiveLayout.isTablet(context)
            ? Wrap(
                spacing: 12,
                runSpacing: 12,
                children: actions
                    .map(
                      (item) => _actionCard(
                        context,
                        icon: item.$1,
                        title: item.$2,
                        color: item.$3,
                        page: item.$4,
                        width: ResponsiveLayout.itemWidth(
                          context,
                          spacing: 12,
                          phone: 2,
                          tablet: 3,
                          largeTablet: 4,
                        ),
                      ),
                    )
                    .toList(),
              )
            : SizedBox(
                height: 110,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: actions
                      .map(
                        (item) => _actionCard(
                          context,
                          icon: item.$1,
                          title: item.$2,
                          color: item.$3,
                          page: item.$4,
                        ),
                      )
                      .toList(),
                ),
              ),
      ],
    );
  }

  Widget _actionCard(
    BuildContext context, {
    required IconData icon,
    required String title,
    required Color color,
    required Widget page,
    double width = 110,
  }) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        Navigator.push(context, MaterialPageRoute(builder: (_) => page));
      },
      child: Container(
        width: width,
        margin: const EdgeInsets.only(right: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: LinearGradient(
            colors: [color.withValues(alpha: 0.75), color],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: Colors.white, size: 30),
            const SizedBox(height: 10),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
