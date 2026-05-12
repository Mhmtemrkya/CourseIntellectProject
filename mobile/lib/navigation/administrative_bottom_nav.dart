import 'package:flutter/material.dart';
import '../pages/administrative_announcements_page.dart';
import '../pages/administrative_home_page.dart';
import '../pages/administrative_messages_page.dart';
import '../pages/administrative_profile_page.dart';
import '../pages/administrative_records_page.dart';
import '../widgets/adaptive_scaffold.dart';

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
          label: 'Kayıtlar',
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
          icon: Icons.person_outline_rounded,
          label: 'Profil',
          pageBuilder: (_) => const AdministrativeProfilePage(),
          sidebarColor: const Color(0xFF64748B),
        ),
      ],
    );
  }
}
