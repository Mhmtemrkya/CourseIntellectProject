import 'package:flutter/material.dart';
import '../pages/driving_collection_page.dart';
import '../pages/driving_school_dashboard_page.dart';
import '../pages/driving_mobile_planning_page.dart';
import '../pages/driving_school_students_page.dart';
import '../widgets/adaptive_scaffold.dart';

/// Sürücü kursu alt menüsü YALNIZCA günlük en sık kullanılan 4 işlemi taşır:
/// Panel, Öğrenciler, Planlama (bugünkü direksiyon/randevu), Ödeme Al. Diğer tüm
/// ekranlara (Paketler, Araçlar, Eğitim & Sınav, Mezuniyet, MEBBİS, Giderler,
/// Finans, Konu Anlatımı, Soru Bankası, Profil) Panel ekranındaki "Hızlı
/// İşlemler" kartlarından tek dokunuşla gidilir. Böylece alt menü kalabalık
/// olmaz, açılışta hızlı geçiş kartları öne çıkar.
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
        icon: Icons.groups_rounded,
        label: 'Öğrenciler',
        pageBuilder: (_) => const DrivingSchoolStudentsPage(),
        sidebarColor: const Color(0xFF8B5CF6),
      ),
      AdaptiveDestination(
        icon: Icons.calendar_month_rounded,
        label: 'Planlama',
        pageBuilder: (_) => const DrivingMobilePlanningPage(),
        sidebarColor: const Color(0xFF0EA5E9),
      ),
      AdaptiveDestination(
        icon: Icons.payments_rounded,
        label: 'Ödeme Al',
        pageBuilder: (_) => const DrivingCollectionPage(),
        sidebarColor: const Color(0xFF059669),
      ),
    ],
  );
}
