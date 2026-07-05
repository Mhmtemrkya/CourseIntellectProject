import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import '../pages/administrative_announcements_page.dart';
import '../pages/administrative_home_page.dart';
import '../pages/administrative_messages_page.dart';
import '../pages/administrative_profile_page.dart';
import '../pages/administrative_records_page.dart';
import '../pages/teacher_reports_page.dart';
import '../widgets/adaptive_scaffold.dart';
import '../pages/library_manage_page.dart';

class AdministrativeBottomNav extends StatelessWidget {
  const AdministrativeBottomNav({super.key});

  @override
  Widget build(BuildContext context) {
    return AdaptiveScaffold(
      userRole: 'İdari Birimler',
      destinations: [
        AdaptiveDestination(
          icon: Icons.space_dashboard_rounded,
          label: 'Panel',
          pageBuilder: (_) => const AdministrativeHomePage(),
          sidebarColor: const Color(0xFF3B82F6),
        ),
        AdaptiveDestination(
          icon: Icons.folder_shared_outlined,
          label: 'Kayıtlar'.tr,
          pageBuilder: (_) => const AdministrativeRecordsPage(),
          sidebarColor: const Color(0xFF8B5CF6),
        ),
        AdaptiveDestination(
          icon: Icons.campaign_outlined,
          label: 'Duyurular',
          pageBuilder: (_) => const AdministrativeAnnouncementsPage(),
          sidebarColor: const Color(0xFFF59E0B),
        ),
        AdaptiveDestination(
          icon: Icons.chat_bubble_outline_rounded,
          label: 'Mesajlar',
          pageBuilder: (_) => const AdministrativeMessagesPage(),
          sidebarColor: const Color(0xFF2563EB),
        ),
        AdaptiveDestination(
          icon: Icons.local_library_rounded,
          label: 'Kütüphane'.tr,
          pageBuilder: (_) => const LibraryManagePage(),
          sidebarColor: const Color(0xFF0EA5E9),
        ),
        AdaptiveDestination(
          icon: Icons.bar_chart_rounded,
          label: 'Raporlar',
          pageBuilder: (_) => const TeacherReportsPage(),
          sidebarColor: const Color(0xFFFF9D2E),
        ),
        AdaptiveDestination(
          icon: Icons.person_outline_rounded,
          label: 'Profil',
          pageBuilder: (_) => const AdministrativeProfilePage(),
          sidebarColor: const Color(0xFF64748B),
        ),
      ],
    );
  }
}
