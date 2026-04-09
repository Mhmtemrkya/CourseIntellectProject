import 'package:flutter/material.dart';
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
                  const CourseIntellectLogo(scale: 0.8, compact: true),
                  const SizedBox(height: 16),
                  const Text(
                    "Hos Geldiniz",
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    "Kullanici tipinizi secin",
                    style: TextStyle(
                      color: theme.textTheme.bodyMedium?.color?.withValues(alpha: 0.68),
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
                      childAspectRatio: ResponsiveLayout.isLargeTablet(context) ? 1.12 : .95,
                      children: [

                        RoleCard(
                        title: "Öğrenci",
                        subtitle: "Derslerinizi takip edin",
                        icon: Icons.school,
                        color: Colors.blue,
                        onTap: (){
                          Navigator.push(context,
                            MaterialPageRoute(
                              builder: (_) => const LoginPage(role: "Öğrenci"),
                            ),
                          );
                        },
                      ),

                        RoleCard(
                        title: "Veli",
                        subtitle: "Çocuğunuzun eğitimini izleyin",
                        icon: Icons.group,
                        color: Colors.green,
                        onTap: (){
                          Navigator.push(context,
                            MaterialPageRoute(
                              builder: (_) => const LoginPage(role: "Veli"),
                            ),
                          );
                        },
                      ),

                        RoleCard(
                        title: "Öğretmen",
                        subtitle: "Sınıflarınızı yönetin",
                        icon: Icons.menu_book,
                        color: Colors.purple,
                        onTap: (){
                          Navigator.push(context,
                            MaterialPageRoute(
                              builder: (_) => const LoginPage(role: "Öğretmen"),
                            ),
                          );
                        },
                      ),

                        RoleCard(
                        title: "Muhasebeci",
                        subtitle: "Finansal işlemleri yönetin",
                        icon: Icons.calculate,
                        color: Colors.orange,
                        onTap: (){
                          Navigator.push(context,
                            MaterialPageRoute(
                              builder: (_) => const LoginPage(role: "Muhasebeci"),
                            ),
                          );
                        },
                      ),

                        RoleCard(
                        title: "İdari Birimler",
                        subtitle: "Kayıt, duyuru ve öğrenci işleri",
                        icon: Icons.apartment_outlined,
                        color: Colors.teal,
                        onTap: (){
                          Navigator.push(context,
                            MaterialPageRoute(
                              builder: (_) => const LoginPage(role: "İdari Birimler"),
                            ),
                          );
                        },
                      ),

                        RoleCard(
                        title: "Yönetici",
                        subtitle: "Kurumu uçtan uca yönetin",
                        icon: Icons.admin_panel_settings_outlined,
                        color: Colors.indigo,
                        onTap: (){
                          Navigator.push(context,
                            MaterialPageRoute(
                              builder: (_) => const LoginPage(role: "Yönetici"),
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
