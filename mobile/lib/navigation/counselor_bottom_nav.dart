import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import 'package:student/pages/counselor_appointments_page.dart';
import 'package:student/pages/counselor_home_page.dart';
import 'package:student/pages/counselor_planner_page.dart';
import 'package:student/pages/counselor_reports_page.dart';
import 'package:student/pages/teacher_messages_page.dart';
import 'package:student/pages/teacher_profile_page.dart';
import 'package:student/widgets/adaptive_scaffold.dart';
import 'package:student/pages/teacher_library_page.dart';

class CounselorBottomNav extends StatelessWidget {
  const CounselorBottomNav({super.key});

  @override
  Widget build(BuildContext context) {
    return AdaptiveScaffold(
      userRole: 'Rehberlik Öğretmeni',
      destinations: [
        AdaptiveDestination(
          icon: Icons.psychology_rounded,
          label: 'Vaka Merkezi',
          pageBuilder: (_) => const CounselorHomePage(),
          sidebarColor: const Color(0xFF3B82F6),
        ),
        AdaptiveDestination(
          icon: Icons.event_available_rounded,
          label: 'Randevular',
          pageBuilder: (_) => const CounselorAppointmentsPage(),
          sidebarColor: const Color(0xFFF59E0B),
        ),
        AdaptiveDestination(
          icon: Icons.edit_calendar_rounded,
          label: 'Program',
          pageBuilder: (_) => const CounselorPlannerPage(),
          sidebarColor: const Color(0xFF06B6D4),
        ),
        AdaptiveDestination(
          icon: Icons.insights_rounded,
          label: 'Rapor',
          pageBuilder: (_) => const CounselorReportsPage(),
          sidebarColor: const Color(0xFF22C55E),
        ),
        AdaptiveDestination(
          icon: Icons.local_library_rounded,
          label: 'Kütüphane'.tr,
          pageBuilder: (_) => const TeacherLibraryPage(),
          sidebarColor: const Color(0xFF0EA5E9),
        ),
        AdaptiveDestination(
          icon: Icons.chat_bubble_outline_rounded,
          label: 'Mesajlar',
          pageBuilder: (_) => const TeacherMessagesPage(),
          sidebarColor: const Color(0xFF2563EB),
        ),
        AdaptiveDestination(
          icon: Icons.person_rounded,
          label: 'Profil',
          pageBuilder: (_) => const TeacherProfilePage(),
          sidebarColor: const Color(0xFF64748B),
        ),
      ],
    );
  }
}
