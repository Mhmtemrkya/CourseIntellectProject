import 'package:flutter/material.dart';
import 'package:student/pages/announcements_page.dart';
import 'package:student/pages/live_lessons_page.dart';
import 'package:student/pages/messages_page.dart';
import 'package:student/pages/question_bank_page.dart';
import 'package:student/pages/schedule_page.dart';
import 'package:student/pages/student_attendance_scan_page.dart';
import 'package:student/pages/student_study_plan_page.dart';
import 'package:student/pages/student_question_page.dart';
import 'responsive_layout.dart';

class QuickActions extends StatelessWidget {
  const QuickActions({super.key});

  @override
  Widget build(BuildContext context) {
    final actions = [
      (Icons.message_rounded, "Mesajlar", Colors.blue, const MessagesPage()),
      (
        Icons.help_center_rounded,
        "Soru Sor",
        const Color(0xFF2563EB),
        const StudentQuestionPage(),
      ),
      (
        Icons.qr_code_scanner_rounded,
        "QR Yoklama",
        const Color(0xFF0EA5A4),
        const StudentAttendanceScanPage(),
      ),
      (
        Icons.event_note_rounded,
        "Çalışma Planim",
        const Color(0xFF10B981),
        const StudentStudyPlanPage(),
      ),
      (
        Icons.quiz_rounded,
        "Soru Bankası",
        Colors.green,
        const QuestionBankPage(),
      ),
      (
        Icons.campaign_rounded,
        "Duyurular",
        Colors.orange,
        const AnnouncementsPage(),
      ),
      (
        Icons.calendar_today_rounded,
        "Ders Programı",
        Colors.purple,
        const SchedulePage(),
      ),
      (
        Icons.videocam_rounded,
        "Canlı Derslerim",
        Colors.redAccent,
        const LiveLessonsPage(),
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          "Hızlı İşlemler",
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
