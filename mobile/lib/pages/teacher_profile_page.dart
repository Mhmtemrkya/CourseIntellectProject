import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'change_password_page.dart';
import 'notification_preferences_page.dart';
import '../services/auth_session_store.dart';
import '../theme_provider.dart';
import '../utils/session_navigation.dart';
import '../widgets/adaptive_scaffold.dart';
import '../widgets/legal_profile_tile.dart';

class TeacherProfilePage extends StatefulWidget {
  const TeacherProfilePage({super.key});

  @override
  State<TeacherProfilePage> createState() => _TeacherProfilePageState();
}

class _TeacherProfilePageState extends State<TeacherProfilePage> {
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
    final session = _session;
    final themeProvider = context.watch<ThemeProvider>();
    final roleLabel = session?.primaryRole == 'Teacher'
        ? 'Öğretmen'
        : (session?.primaryRole ?? 'Öğretmen');

    final hasSidebar = SidebarState.of(context);
    return Scaffold(
      appBar: hasSidebar ? null : AppBar(title: const Text("Profilim")),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _card(
            Column(
              children: [
                const CircleAvatar(
                  radius: 42,
                  child: Icon(Icons.school_rounded, size: 38),
                ),
                const SizedBox(height: 10),
                Text(
                  session?.fullName ?? "Öğretmen",
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  session?.username ?? "-",
                  style: const TextStyle(color: Colors.grey),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _card(
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Öğretmen Profili",
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 12),
                _infoRow("Ad Soyad", session?.fullName ?? "-"),
                _infoRow("Kullanıcı Adı", session?.username ?? "-"),
                _infoRow("Rol", roleLabel),
                _infoRow(
                  "Ek Yetkiler",
                  (session?.extraRoles.isEmpty ?? true)
                      ? 'Yok'
                      : session!.extraRoles.join(', '),
                ),
                const SizedBox(height: 12),
                const Text(
                  "Profil güncellemesi sadece yönetiçi ve idari birimler tarafından yapılabilir.",
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
                ListTile(
                  leading: const Icon(Icons.notifications_active_outlined),
                  title: const Text("Bildirim Tercihleri"),
                  subtitle: const Text(
                    "Mesaj, sınav, görüşme ve rapor banner ayarlarını yönet.",
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
                  title: const Text("Şifre Değiştir"),
                  subtitle: const Text(
                    "Hesap güvenliği için şifrenizi güncelleyin.",
                  ),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const ChangePasswordPage(),
                    ),
                  ),
                ),
                const LegalProfileTile(),
                ListTile(
                  leading: const Icon(Icons.logout_rounded, color: Colors.red),
                  title: const Text(
                    "Çıkış Yap",
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
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(16),
      ),
      child: child,
    );
  }
}
