import 'package:flutter/material.dart';
import '../pages/accounting_exports_page.dart';
import '../pages/accounting_home_page.dart';
import '../pages/accounting_installments_page.dart';
import '../pages/accounting_ledger_page.dart';
import '../pages/accounting_messages_page.dart';
import '../pages/accounting_profile_page.dart';
import '../pages/accounting_receipts_page.dart';
import '../widgets/adaptive_scaffold.dart';

class AccountingBottomNav extends StatelessWidget {
  const AccountingBottomNav({super.key});

  @override
  Widget build(BuildContext context) {
    return AdaptiveScaffold(
      userRole: 'Muhasebeci',
      destinations: [
        AdaptiveDestination(
          icon: Icons.dashboard_outlined,
          label: 'Panel',
          pageBuilder: (_) => const AccountingHomePage(),
          sidebarColor: const Color(0xFF3B82F6),
        ),
        AdaptiveDestination(
          icon: Icons.payments_outlined,
          label: 'Tahsilatlar',
          pageBuilder: (_) => const AccountingReceiptsPage(),
          sidebarColor: const Color(0xFF10B981),
        ),
        AdaptiveDestination(
          icon: Icons.calendar_month_outlined,
          label: 'Taksitler',
          pageBuilder: (_) => const AccountingInstallmentsPage(),
          sidebarColor: const Color(0xFFF59E0B),
        ),
        AdaptiveDestination(
          icon: Icons.menu_book_outlined,
          label: 'Defter',
          pageBuilder: (_) => const AccountingLedgerPage(),
          sidebarColor: const Color(0xFF8B5CF6),
        ),
        AdaptiveDestination(
          icon: Icons.chat_bubble_outline_rounded,
          label: 'Mesajlar',
          pageBuilder: (_) => const AccountingMessagesPage(),
          sidebarColor: const Color(0xFF2563EB),
        ),
        AdaptiveDestination(
          icon: Icons.ios_share_outlined,
          label: 'Dışa Aktar',
          pageBuilder: (_) => const AccountingExportsPage(),
          sidebarColor: const Color(0xFF14B8A6),
        ),
        AdaptiveDestination(
          icon: Icons.person_outline_rounded,
          label: 'Profil',
          pageBuilder: (_) => const AccountingProfilePage(),
          sidebarColor: const Color(0xFF64748B),
        ),
      ],
    );
  }
}
