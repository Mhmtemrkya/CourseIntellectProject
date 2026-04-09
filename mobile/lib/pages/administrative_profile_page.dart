import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_session_store.dart';
import 'notification_preferences_page.dart';
import '../theme_provider.dart';
import '../utils/session_navigation.dart';
import '../widgets/admin_ui.dart';

class AdministrativeProfilePage extends StatefulWidget {
  const AdministrativeProfilePage({super.key});

  @override
  State<AdministrativeProfilePage> createState() => _AdministrativeProfilePageState();
}

class _AdministrativeProfilePageState extends State<AdministrativeProfilePage> {
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
              eyebrow: 'İdari profil',
              title: 'İletişim bilgileri, bildirim tercihleri ve tema ayarlarını yönetin.',
              description: 'İdari birim hesabına ait operasyonel tercihler burada güncellenir.',
              colors: [Color(0xFF0F172A), Color(0xFF0F766E)],
              metrics: [
                AdminHeroMetric(label: 'Rol', value: 'İdari Birimler'),
                AdminHeroMetric(label: 'Erişim', value: 'Kayıt • Duyuru • İletişim'),
              ],
            ),
            const SizedBox(height: 16),
            AdminPanel(
              child: Column(
                children: [
                  _field('Ad Soyad', _session?.fullName ?? 'Idari Kullanici'),
                  const SizedBox(height: 12),
                  _field('Pozisyon', 'Ogrenci Isleri Sorumlusu'),
                  const SizedBox(height: 12),
                  _field('Kullanici Adi', _session?.username ?? 'idari'),
                  const SizedBox(height: 12),
                  _field('Rol', 'Idari Birimler'),
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: const Text(
                      'Profil verileri dogrudan sistem kaydindan alinir. Duzenleme yalnizca yonetici ve idari kayit ekranlarindan yapilir.',
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
                    subtitle: const Text('Kayıt, veli dönüşü ve duyuru banner ayarlarını yönet.'),
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
                  Text('İdari Yetkiler', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 12),
                  const ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(Icons.person_add_alt_1_outlined),
                    title: Text('Öğrenci kayıt oluşturma'),
                    subtitle: Text('Yeni öğrenci ve veli bilgileri ekleyebilir'),
                  ),
                  const ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(Icons.campaign_outlined),
                    title: Text('Duyuru yayınlama'),
                    subtitle: Text('Öğrenci, veli ve kurum geneline duyuru paylaşabilir'),
                  ),
                  const ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(Icons.chat_bubble_outline_rounded),
                    title: Text('İletişim akışı'),
                    subtitle: Text('Veli ve kurum birimleriyle mesajlaşma erişimi'),
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
