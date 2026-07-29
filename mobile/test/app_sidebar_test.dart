import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:student/theme_provider.dart';
import 'package:student/widgets/app_sidebar.dart';

/// Kenar çubuğu marka düzeni: üstte ÜRÜN markası, kullanıcı kartında KURUM.
///
/// Masaüstündeki PremiumSidebar ile aynı kural: iki marka birbirinin yerini
/// almaz. Bu testler düzen geri alınırsa (kurum adı başlığa dönerse, kartta
/// yeniden e-posta belirirse) kırılır.
void main() {
  Widget harness(ThemeProvider theme) => ChangeNotifierProvider<ThemeProvider>.value(
        value: theme,
        child: MaterialApp(
          home: Scaffold(
            body: AppSidebar(
              destinations: const [
                SidebarDestination(icon: Icons.home, label: 'Ana Sayfa'),
              ],
              selectedIndex: 0,
              onDestinationSelected: (_) {},
              userName: 'Demo Kurum Yonetici',
              userRole: 'Kurum Yöneticisi',
            ),
          ),
        ),
      );

  testWidgets('başlıkta ürün markası, kartta kurum adı yazar', (tester) async {
    final theme = ThemeProvider();
    theme.applyBranding(
      primaryColor: const Color(0xFF08111F),
      accentColor: const Color(0xFFFF7A1A),
      logoUrl: null,
      tenantName: 'Demo Kurum',
    );

    await tester.pumpWidget(harness(theme));
    await tester.pump();

    // Üst şerit: ürün markası ve tanımı. ("SchoolAsist" alt bilgide de geçer.)
    expect(find.text('SchoolAsist'), findsWidgets);
    expect(find.text('Okul Yönetim Sistemi'), findsOneWidget);

    // Kullanıcı kartı: ad / kurum adı / rol.
    expect(find.text('Demo Kurum Yonetici'), findsOneWidget);
    expect(find.text('Demo Kurum'), findsOneWidget);
    expect(find.text('Kurum Yöneticisi'), findsOneWidget);
  });

  testWidgets('kurum logosu yokken kartta adın baş harfi görünür', (tester) async {
    final theme = ThemeProvider();
    theme.applyBranding(
      primaryColor: const Color(0xFF08111F),
      accentColor: const Color(0xFFFF7A1A),
      logoUrl: null,
      tenantName: 'Demo Kurum',
    );

    await tester.pumpWidget(harness(theme));
    await tester.pump();

    expect(find.text('D'), findsOneWidget);
  });
}
