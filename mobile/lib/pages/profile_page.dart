import 'package:flutter/material.dart';
import 'package:student/i18n/language_tile.dart';
import 'package:student/i18n/app_locale.dart';
import 'package:provider/provider.dart';

import 'change_password_page.dart';
import 'notification_preferences_page.dart';
import '../services/auth_session_store.dart';
import '../theme_provider.dart';
import '../utils/session_navigation.dart';
import '../widgets/adaptive_scaffold.dart';
import '../widgets/legal_profile_tile.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  AuthSession? _session;
  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    final session = await AuthSessionStore.instance.load();
    if (!mounted) return;
    setState(() => _session = session);
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final theme = Theme.of(context);
    final session = _session;

    final hasSidebar = SidebarState.of(context);
    return Scaffold(
      appBar: hasSidebar
          ? null
          : AppBar(
              title: const Text(
                "Profilim",
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _card(
            Column(
              children: [
                const CircleAvatar(
                  radius: 40,
                  child: Icon(Icons.person_rounded, size: 40),
                ),
                const SizedBox(height: 10),
                Text(
                  session?.fullName ?? "Öğrenci",
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  session?.username ?? "-",
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _card(
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Öğrenci Bilgileri".tr,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 12),
                _infoRow("Ad Soyad", session?.fullName ?? "-"),
                _infoRow("Kullanıcı Adı", session?.username ?? "-"),
                _infoRow("Rol", "Öğrenci"),
                _infoRow(
                  "Kampüs",
                  session?.primaryRole == null ? "-" : "Merkez Kampüs",
                ),
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFF7A00).withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    "Bu alanlar sadece yönetiçi ve idari birimler tarafından güncellenebilir.".tr,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _card(
            Column(
              children: [
                SwitchListTile(
                  title: const Text("Dark Mode"),
                  value: themeProvider.isDarkMode,
                  onChanged: themeProvider.toggleTheme,
                ),
                const LanguageTile(),
                ListTile(
                  leading: const Icon(Icons.notifications_active_outlined),
                  title: const Text("Bildirim Tercihleri"),
                  subtitle: Text(
                    "Canlı banner, sessiz mod ve önizleme ayarlarını yönet.".tr,
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const NotificationPreferencesPage(),
                    ),
                  ),
                ),
                ListTile(
                  leading: const Icon(Icons.lock_outline),
                  title: Text("Şifre Değiştir".tr),
                  subtitle: Text(
                    "Hesap güvenliği için şifrenizi güncelleyin.".tr,
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const ChangePasswordPage(),
                    ),
                  ),
                ),
                ListTile(
                  leading: const Icon(Icons.security_rounded),
                  title: const Text("Hesap Yetkileri"),
                  subtitle: Text(
                    "Profil verileri sadece yönetiçi ve idari birimler tarafından güncellenebilir.".tr,
                  ),
                ),
                const LegalProfileTile(),
                ListTile(
                  leading: const Icon(Icons.logout_rounded, color: Colors.red),
                  title: Text(
                    "Çıkış Yap".tr,
                    style: TextStyle(color: Colors.red),
                  ),
                  onTap: () => logoutToRoleSelect(context),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String title, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          Expanded(child: Text(value, textAlign: TextAlign.right)),
        ],
      ),
    );
  }

  Widget _card(Widget child) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(16),
      ),
      child: child,
    );
  }
}
