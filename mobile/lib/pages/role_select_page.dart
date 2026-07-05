import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import '../widgets/role_card.dart';
import '../widgets/course_intellect_logo.dart';
import '../widgets/responsive_layout.dart';
import 'login_page.dart';

class RoleSelectPage extends StatelessWidget {
  const RoleSelectPage({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: isDark
                ? const [Color(0xFF0A1017), Color(0xFF0F172A)]
                : const [Color(0xFFF7FBFF), Color(0xFFEAF3FA)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: ResponsiveContent(
              child: Column(
                children: [
                  const SizedBox(height: 8),
                  const SchoolAsistLogo(scale: 0.8, compact: true),
                  const SizedBox(height: 16),
                  Text(
                    "Hoş Geldiniz".tr,
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    "Kullanıcı tipinizi seçin".tr,
                    style: TextStyle(
                      color: theme.textTheme.bodyMedium?.color?.withValues(
                        alpha: 0.68,
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Expanded(
                    child: GridView.count(
                      crossAxisCount: ResponsiveLayout.columns(
                        context,
                        phone: 2,
                        tablet: 2,
                        largeTablet: 3,
                      ),
                      crossAxisSpacing: 16,
                      mainAxisSpacing: 16,
                      childAspectRatio: ResponsiveLayout.isLargeTablet(context)
                          ? 1.12
                          : .95,
                      children: [
                        RoleCard(
                          title: "Öğrenci".tr,
                          subtitle: "Derslerinizi takip edin",
                          icon: Icons.school,
                          color: Colors.blue,
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const LoginPage(),
                              ),
                            );
                          },
                        ),

                        RoleCard(
                          title: "Veli",
                          subtitle: "Çocuğunuzun eğitimini izleyin".tr,
                          icon: Icons.group,
                          color: Colors.green,
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const LoginPage(),
                              ),
                            );
                          },
                        ),

                        RoleCard(
                          title: "Öğretmen".tr,
                          subtitle: "Sınıflarınızı yönetin".tr,
                          icon: Icons.menu_book,
                          color: Colors.purple,
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const LoginPage(),
                              ),
                            );
                          },
                        ),

                        RoleCard(
                          title: "Muhasebeci",
                          subtitle: "Finansal işlemleri yönetin".tr,
                          icon: Icons.calculate,
                          color: Colors.orange,
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const LoginPage(),
                              ),
                            );
                          },
                        ),

                        RoleCard(
                          title: "İdari Birimler".tr,
                          subtitle: "Kayıt, duyuru ve öğrenci işleri".tr,
                          icon: Icons.apartment_outlined,
                          color: Colors.teal,
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const LoginPage(),
                              ),
                            );
                          },
                        ),

                        RoleCard(
                          title: "Yönetici".tr,
                          subtitle: "Kurumu uçtan uca yönetin".tr,
                          icon: Icons.admin_panel_settings_outlined,
                          color: Colors.indigo,
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const LoginPage(),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
