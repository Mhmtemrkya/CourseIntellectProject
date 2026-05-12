import 'package:flutter/material.dart';
import 'package:student/pages/teacher_home_page.dart';
import 'package:student/pages/teacher_meeting_approvals_page.dart';
import 'package:student/pages/teacher_messages_page.dart';
import 'package:student/pages/teacher_profile_page.dart';
import 'package:student/pages/teacher_schedule_page.dart';
import 'package:student/widgets/adaptive_scaffold.dart';

class TeacherBottomNav extends StatelessWidget {
  const TeacherBottomNav({super.key});

  @override
  Widget build(BuildContext context) {
    return AdaptiveScaffold(
      userRole: 'Öğretmen',
      destinations: [
        AdaptiveDestination(
          icon: Icons.home_rounded,
          label: 'Ana Sayfa',
          pageBuilder: (_) => const TeacherHomePage(),
          sidebarColor: const Color(0xFF3B82F6),
        ),
        AdaptiveDestination(
          icon: Icons.calendar_month_rounded,
          label: 'Program',
          pageBuilder: (_) => const TeacherSchedulePage(),
          sidebarColor: const Color(0xFFF59E0B),
        ),
        AdaptiveDestination(
          icon: Icons.how_to_reg_rounded,
          label: 'Onaylar',
          pageBuilder: (_) => const TeacherMeetingApprovalsPage(),
          sidebarColor: const Color(0xFF10B981),
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
