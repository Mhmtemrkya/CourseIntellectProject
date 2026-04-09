import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_session_store.dart';
import 'notification_preferences_page.dart';
import 'admin_settings_page.dart';
import '../theme_provider.dart';
import '../utils/session_navigation.dart';
import '../widgets/admin_ui.dart';

class AdminProfilePage extends StatefulWidget {
  const AdminProfilePage({super.key});

  @override
  State<AdminProfilePage> createState() => _AdminProfilePageState();
}

class _AdminProfilePageState extends State<AdminProfilePage> {
  AuthSession? _session;

  @override
  void initState() {
    super.initState();
    AuthSessionStore.instance.load().then((value) {
      if (!mounted) return;
      setState(() => _session = value);
    });
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();

    return AdminScaffold(
      appBar: AppBar(
        title: const Text('Profilim', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            const AdminHeroCard(
              eyebrow: 'Yönetici profili',
              title: 'Kurum bilgileri, güvenlik tercihleri ve tema ayarları tek noktada.',
              description: 'Yönetici rolüne ait iletişim ve bildirim tercihleri burada güncellenir.',
              metrics: [
                AdminHeroMetric(label: 'Rol', value: 'Yönetici'),
                AdminHeroMetric(label: 'Erişim', value: 'Tam Yetki'),
              ],
            ),
            const SizedBox(height: 16),
            AdminPanel(
              child: Column(
                children: [
                  _field('Ad Soyad', _session?.fullName ?? 'Yonetici Hesabi'),
                  const SizedBox(height: 12),
                  _field('Pozisyon', 'Kurum Yoneticisi'),
                  const SizedBox(height: 12),
                  _field('Kullanici Adi', _session?.username ?? 'admin'),
                  const SizedBox(height: 12),
                  _field('Rol', 'Yonetici'),
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: const Text(
                      'Profil bilgileri veritabanindan okunur. Guncelleme yalnizca idari ve yonetici akislarindan yapilir.',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            AdminPanel(
              child: Column(
                children: [
                SwitchListTile(
                    value: themeProvider.isDarkMode,
                    onChanged: (value) => themeProvider.toggleTheme(value),
                    title: const Text('Dark Mode'),
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.notifications_active_outlined),
                    title: const Text('Bildirim Tercihleri'),
                    subtitle: const Text('Kritik, finans ve akademik banner akışlarını yönet.'),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const NotificationPreferencesPage()),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            AdminPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Kurumsal Araçlar', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 12),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.settings_outlined),
                    title: const Text('Kurum Ayarları'),
                    subtitle: const Text('Genel sistem ve otomasyon tercihleri'),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const AdminSettingsPage()),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => logoutToRoleSelect(context),
                icon: const Icon(Icons.logout_rounded),
                label: const Text('Cikis Yap'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(String label, String value) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label),
      subtitle: Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      leading: const Icon(Icons.lock_outline_rounded),
    );
  }
}
