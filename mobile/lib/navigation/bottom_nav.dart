import 'package:flutter/material.dart';
import 'package:student/pages/content_page.dart';
import 'package:student/pages/messages_page.dart';
import 'package:student/pages/student_home_page.dart';
import 'package:student/pages/profile_page.dart';
import 'package:student/widgets/adaptive_scaffold.dart';

class BottomNav extends StatelessWidget {
  const BottomNav({super.key});

  @override
  Widget build(BuildContext context) {
    return AdaptiveScaffold(
      userRole: 'Öğrenci',
      destinations: [
        AdaptiveDestination(
          icon: Icons.home_rounded,
          label: 'Ana Sayfa',
          pageBuilder: (_) => const StudentHomePage(),
          sidebarColor: const Color(0xFF3B82F6),
        ),
        AdaptiveDestination(
          icon: Icons.menu_book,
          label: 'İçerikler',
          pageBuilder: (_) => const ContentPage(),
          sidebarColor: const Color(0xFF8B5CF6),
        ),
        AdaptiveDestination(
          icon: Icons.chat_bubble_outline_rounded,
          label: 'Mesajlar',
          pageBuilder: (_) => const MessagesPage(),
          sidebarColor: const Color(0xFF2563EB),
        ),
        AdaptiveDestination(
          icon: Icons.person_rounded,
          label: 'Profil',
          pageBuilder: (_) => const ProfilePage(),
          sidebarColor: const Color(0xFF64748B),
        ),
      ],
    );
  }
}
