import 'package:flutter/material.dart';

import '../pages/content_page.dart';
import '../pages/driving_student_documents_page.dart';
import '../pages/driving_student_home_page.dart';
import '../pages/driving_student_payments_page.dart';
import '../pages/driving_education_page.dart';
import '../pages/driving_appointment_request_page.dart';
import '../pages/driving_graduation_page.dart';
import '../pages/profile_page.dart';
import '../pages/question_bank_page.dart';
import '../widgets/adaptive_scaffold.dart';

class DrivingStudentBottomNav extends StatelessWidget {
  const DrivingStudentBottomNav({super.key});
  @override
  Widget build(BuildContext context) => AdaptiveScaffold(
    userRole: 'Sürücü Adayı',
    destinations: [
      AdaptiveDestination(
        icon: Icons.directions_car_filled_rounded,
        label: 'Programım',
        pageBuilder: (_) => const DrivingStudentHomePage(),
        sidebarColor: const Color(0xFF06B6D4),
      ),
      AdaptiveDestination(
        icon: Icons.edit_calendar_rounded,
        label: 'Randevu Talebi',
        pageBuilder: (_) => const DrivingAppointmentRequestPage(),
        sidebarColor: const Color(0xFF0EA5E9),
      ),
      AdaptiveDestination(
        icon: Icons.school_rounded,
        label: 'Eğitim & Sınav',
        pageBuilder: (_) => const DrivingEducationPage(),
        sidebarColor: const Color(0xFF7C3AED),
      ),
      AdaptiveDestination(
        icon: Icons.workspace_premium_rounded,
        label: 'Mezuniyet',
        pageBuilder: (_) => const DrivingGraduationPage(),
        sidebarColor: const Color(0xFF16A34A),
      ),
      AdaptiveDestination(
        icon: Icons.folder_shared_rounded,
        label: 'Evraklarım',
        pageBuilder: (_) => const DrivingStudentDocumentsPage(),
        sidebarColor: const Color(0xFFF59E0B),
      ),
      AdaptiveDestination(
        icon: Icons.receipt_long_rounded,
        label: 'Ödemelerim',
        pageBuilder: (_) => const DrivingStudentPaymentsPage(),
        sidebarColor: const Color(0xFF16A34A),
      ),
      AdaptiveDestination(
        icon: Icons.menu_book_rounded,
        label: 'Konu Anlatımı',
        pageBuilder: (_) => const ContentPage(),
        sidebarColor: const Color(0xFF8B5CF6),
      ),
      AdaptiveDestination(
        icon: Icons.quiz_rounded,
        label: 'Soru Bankası',
        pageBuilder: (_) => const QuestionBankPage(),
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
