import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_session_store.dart';
import '../services/current_user_api_service.dart';
import 'notification_preferences_page.dart';
import 'profile_edit_page.dart';
import 'admin_settings_page.dart';
import '../theme_provider.dart';
import '../utils/session_navigation.dart';
import '../widgets/admin_ui.dart';
import '../widgets/legal_profile_tile.dart';

class AdminProfilePage extends StatefulWidget {
  const AdminProfilePage({super.key});

  @override
  State<AdminProfilePage> createState() => _AdminProfilePageState();
}

class _AdminProfilePageState extends State<AdminProfilePage> {
  AuthSession? _session;
  CurrentUserProfile? _profile;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final session = await AuthSessionStore.instance.load();
    if (!mounted) return;
    setState(() => _session = session);
    await _loadProfile();
  }

  Future<void> _openEdit(CurrentUserProfile current) async {
    final updated = await Navigator.push<CurrentUserProfile>(
      context,
      MaterialPageRoute(builder: (_) => ProfileEditPage(profile: current)),
    );
    if (updated != null && mounted) {
      setState(() => _profile = updated);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Profil güncellendi.')));
    }
  }

  Future<void> _loadProfile() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final profile = await CurrentUserApiService.instance.fetchMe();
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final profile = _profile;
    final displayName = profile?.fullName.isNotEmpty == true
        ? profile!.fullName
        : _session?.fullName ?? 'Yönetici Hesabı';
    final displayUsername = profile?.username.isNotEmpty == true
        ? profile!.username
        : _session?.username ?? 'admin';
    final role = profile?.primaryRole.isNotEmpty == true
        ? profile!.primaryRole
        : 'Yönetici';
    final campus = profile?.campus ?? '';
    final department = profile?.departmentOrBranch ?? '';
    final tenantName = profile?.tenantName ?? '';

    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Profilim',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            tooltip: 'Yenile',
            onPressed: _loading ? null : _loadProfile,
            icon: _loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh),
          ),
        ],
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            AdminHeroCard(
              eyebrow: 'Yönetici profili',
              title:
                  'Kurum bilgileri, güvenlik tercihleri ve tema ayarları tek noktada.',
              description: tenantName.isEmpty
                  ? 'Yönetici rolüne ait iletişim ve bildirim tercihleri burada güncellenir.'
                  : '$tenantName • Yönetici rolü tercihleri burada güncellenir.',
              metrics: [
                AdminHeroMetric(label: 'Rol', value: role),
                AdminHeroMetric(
                  label: 'Kurum',
                  value: tenantName.isEmpty ? 'Bilinmiyor' : tenantName,
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (_error != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            AdminPanel(
              child: Column(
                children: [
                  _field('Ad Soyad', displayName),
                  const SizedBox(height: 12),
                  _field('Kullanıcı Adı', displayUsername),
                  const SizedBox(height: 12),
                  _field('Rol', role),
                  if (campus.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _field('Kampüs', campus),
                  ],
                  if (department.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _field('Departman', department),
                  ],
                  if (tenantName.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _field('Kurum', tenantName),
                  ],
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: profile == null
                          ? null
                          : () => _openEdit(profile),
                      icon: const Icon(Icons.edit_outlined),
                      label: const Text('Profili Düzenle'),
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
                    subtitle: const Text(
                      'Kritik, finans ve akademik banner akışlarını yönet.',
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const NotificationPreferencesPage(),
                      ),
                    ),
                  ),
                  const LegalProfileTile(contentPadding: EdgeInsets.zero),
                ],
              ),
            ),
            const SizedBox(height: 16),
            AdminPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Kurumsal Araçlar',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.settings_outlined),
                    title: const Text('Kurum Ayarları'),
                    subtitle: const Text(
                      'Genel sistem ve otomasyon tercihleri',
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const AdminSettingsPage(),
                      ),
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
                label: const Text('Çıkış Yap'),
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
      subtitle: Text(
        value,
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
      leading: const Icon(Icons.lock_outline_rounded),
    );
  }
}
