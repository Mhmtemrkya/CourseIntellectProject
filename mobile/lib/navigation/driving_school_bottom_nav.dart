import 'package:flutter/material.dart';
import '../pages/admin_finance_page.dart';
import '../pages/admin_profile_page.dart';
import '../pages/driving_collection_page.dart';
import '../pages/driving_expenses_page.dart';
import '../pages/driving_school_dashboard_page.dart';
import '../pages/driving_school_operations_page.dart';
import '../pages/driving_education_page.dart';
import '../pages/driving_graduation_page.dart';
import '../pages/driving_mobile_planning_page.dart';
import '../pages/driving_mebbis_work_center_page.dart';
import '../pages/driving_school_students_page.dart';
import '../pages/driving_school_vehicles_page.dart';
import '../pages/teacher_content_page.dart';
import '../pages/teacher_question_bank_page.dart';
import '../widgets/adaptive_scaffold.dart';

class DrivingSchoolBottomNav extends StatelessWidget {
  const DrivingSchoolBottomNav({super.key});
  @override
  Widget build(BuildContext context) => AdaptiveScaffold(
    userRole: 'Sürücü Kursu',
    destinations: [
      AdaptiveDestination(
        icon: Icons.space_dashboard_rounded,
        label: 'Panel',
        pageBuilder: (_) => const DrivingSchoolDashboardPage(),
        sidebarColor: const Color(0xFFF97316),
      ),
      AdaptiveDestination(
        icon: Icons.inventory_2_rounded,
        label: 'Paketler',
        pageBuilder: (_) => const DrivingSchoolOperationsPage(),
        sidebarColor: const Color(0xFF14B8A6),
      ),
      AdaptiveDestination(
        icon: Icons.groups_rounded,
        label: 'Öğrenciler',
        pageBuilder: (_) => const DrivingSchoolStudentsPage(),
        sidebarColor: const Color(0xFF8B5CF6),
      ),
      AdaptiveDestination(
        icon: Icons.payments_rounded,
        label: 'Ödeme Al',
        pageBuilder: (_) => const DrivingCollectionPage(),
        sidebarColor: const Color(0xFF059669),
      ),
      AdaptiveDestination(
        icon: Icons.receipt_long_rounded,
        label: 'Giderler',
        pageBuilder: (_) => const DrivingExpensesPage(),
        sidebarColor: const Color(0xFFE11D48),
      ),
      AdaptiveDestination(
        icon: Icons.directions_car_filled_rounded,
        label: 'Araçlar',
        pageBuilder: (_) => const DrivingSchoolVehiclesPage(),
        sidebarColor: const Color(0xFFEA580C),
      ),
      AdaptiveDestination(
        icon: Icons.calendar_month_rounded,
        label: 'Planlama',
        pageBuilder: (_) => const DrivingMobilePlanningPage(),
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
        icon: Icons.fact_check_rounded,
        label: 'MEBBİS',
        pageBuilder: (_) => const DrivingMebbisWorkCenterPage(),
        sidebarColor: const Color(0xFF0284C7),
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
        icon: Icons.account_balance_wallet_rounded,
        label: 'Finans',
        pageBuilder: (_) => const AdminFinancePage(),
        sidebarColor: const Color(0xFF10B981),
      ),
      AdaptiveDestination(
        icon: Icons.person_outline_rounded,
        label: 'Profil',
        pageBuilder: (_) => const AdminProfilePage(),
        sidebarColor: const Color(0xFF64748B),
      ),
    ],
  );
}
