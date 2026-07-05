import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import 'package:student/pages/content_page.dart';
import 'package:student/pages/exams_page.dart';
import 'package:student/pages/messages_page.dart';
import 'package:student/pages/student_guidance_page.dart';
import 'package:student/pages/student_home_page.dart';
import 'package:student/pages/profile_page.dart';
import 'package:student/widgets/adaptive_scaffold.dart';
import 'package:student/pages/student_library_page.dart';

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
          label: 'İçerikler'.tr,
          pageBuilder: (_) => const ContentPage(),
          sidebarColor: const Color(0xFF8B5CF6),
        ),
        AdaptiveDestination(
          icon: Icons.fact_check_rounded,
          label: 'Sınavlarım'.tr,
          pageBuilder: (_) => const ExamsPage(),
          sidebarColor: const Color(0xFF7C3AED),
        ),
        AdaptiveDestination(
          icon: Icons.workspace_premium_rounded,
          label: 'Deneme',
          pageBuilder: (_) => const ExamsPage(mockOnly: true),
          sidebarColor: const Color(0xFFF97316),
        ),
        AdaptiveDestination(
          icon: Icons.psychology_alt_rounded,
          label: 'Rehberlik',
          pageBuilder: (_) => const StudentGuidancePage(),
          sidebarColor: const Color(0xFFF7941D),
        ),
        AdaptiveDestination(
          icon: Icons.local_library_rounded,
          label: 'Kütüphane'.tr,
          pageBuilder: (_) => const StudentLibraryPage(),
          sidebarColor: const Color(0xFF0EA5E9),
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
