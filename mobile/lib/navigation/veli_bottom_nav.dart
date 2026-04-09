import 'package:flutter/material.dart';
import '../pages/veli_home_page.dart';
import '../pages/veli_devamsizlik_page.dart';
import '../pages/veli_duyurular_page.dart';
import '../pages/veli_mesajlar_page.dart';
import '../pages/veli_odeme_page.dart';
import '../pages/veli_profile_page.dart';
import '../widgets/adaptive_scaffold.dart';

class VeliBottomNav extends StatelessWidget {
  const VeliBottomNav({super.key});

  @override
  Widget build(BuildContext context) {
    return AdaptiveScaffold(
      userRole: 'Veli',
      destinations: [
        AdaptiveDestination(
          icon: Icons.home_rounded,
          label: 'Ana Sayfa',
          pageBuilder: (_) => const VeliHomePage(),
          sidebarColor: const Color(0xFF3B82F6),
        ),
        AdaptiveDestination(
          icon: Icons.fact_check_outlined,
          label: 'Devamsizlik',
          pageBuilder: (_) => const VeliDevamsizlikPage(),
          sidebarColor: const Color(0xFFEF4444),
        ),
        AdaptiveDestination(
          icon: Icons.campaign_outlined,
          label: 'Duyurular',
          pageBuilder: (_) => const VeliDuyurularPage(),
          sidebarColor: const Color(0xFFF59E0B),
        ),
        AdaptiveDestination(
          icon: Icons.payment_rounded,
          label: 'Odemeler',
          pageBuilder: (_) => const VeliOdemePage(),
          sidebarColor: const Color(0xFF10B981),
        ),
        AdaptiveDestination(
          icon: Icons.chat_bubble_outline_rounded,
          label: 'Mesajlar',
          pageBuilder: (_) => const VeliMesajlarPage(),
          sidebarColor: const Color(0xFF2563EB),
        ),
        AdaptiveDestination(
          icon: Icons.person_rounded,
          label: 'Profil',
          pageBuilder: (_) => const VeliProfilPage(),
          sidebarColor: const Color(0xFF64748B),
        ),
      ],
    );
  }
}
