import 'package:flutter/material.dart';

import '../pages/driving_instructor_home_page.dart';
import '../pages/driving_education_page.dart';
import '../pages/teacher_content_page.dart';
import '../pages/teacher_profile_page.dart';
import '../pages/teacher_question_bank_page.dart';
import '../widgets/adaptive_scaffold.dart';

class DrivingInstructorBottomNav extends StatelessWidget {
  const DrivingInstructorBottomNav({super.key});
  @override
  Widget build(BuildContext context) => AdaptiveScaffold(
    userRole: 'Direksiyon Öğretmeni',
    destinations: [
      AdaptiveDestination(
        icon: Icons.route_rounded,
        label: 'Derslerim',
        pageBuilder: (_) => const DrivingInstructorHomePage(),
        sidebarColor: const Color(0xFF14B8A6),
      ),
      AdaptiveDestination(
        icon: Icons.school_rounded,
        label: 'Teorik & Sınav',
        pageBuilder: (_) => const DrivingEducationPage(),
        sidebarColor: const Color(0xFF7C3AED),
      ),
      AdaptiveDestination(
        icon: Icons.menu_book_rounded,
        label: 'Konu Anlatımı',
        pageBuilder: (_) => const TeacherContentPage(),
        sidebarColor: const Color(0xFF8B5CF6),
      ),
      AdaptiveDestination(
        icon: Icons.quiz_rounded,
        label: 'Soru Bankası',
        pageBuilder: (_) => const TeacherQuestionBankPage(),
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
