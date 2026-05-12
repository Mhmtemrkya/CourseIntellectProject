import 'package:flutter/material.dart';
import '../pages/admin_academics_page.dart';
import '../pages/admin_finance_page.dart';
import '../pages/admin_home_page.dart';
import '../pages/admin_operations_page.dart';
import '../pages/admin_profile_page.dart';
import '../widgets/adaptive_scaffold.dart';

class AdminBottomNav extends StatelessWidget {
  const AdminBottomNav({super.key});

  @override
  Widget build(BuildContext context) {
    return AdaptiveScaffold(
      userRole: 'Yönetici',
      destinations: [
        AdaptiveDestination(
          icon: Icons.space_dashboard_rounded,
          label: 'Panel',
          pageBuilder: (_) => const AdminHomePage(),
          sidebarColor: const Color(0xFF3B82F6),
        ),
        AdaptiveDestination(
          icon: Icons.school_outlined,
          label: 'Akademik',
          pageBuilder: (_) => const AdminAcademicsPage(),
          sidebarColor: const Color(0xFF8B5CF6),
        ),
        AdaptiveDestination(
          icon: Icons.account_balance_wallet_outlined,
          label: 'Finans',
          pageBuilder: (_) => const AdminFinancePage(),
          sidebarColor: const Color(0xFF10B981),
        ),
        AdaptiveDestination(
          icon: Icons.apartment_outlined,
          label: 'Operasyon',
          pageBuilder: (_) => const AdminOperationsPage(),
          sidebarColor: const Color(0xFF14B8A6),
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
}
