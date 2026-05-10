import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_session_store.dart';
import '../services/current_user_api_service.dart';
import 'change_password_page.dart';
import 'notification_preferences_page.dart';
import 'profile_edit_page.dart';
import '../theme_provider.dart';
import '../utils/session_navigation.dart';
import '../widgets/accounting_ui.dart';
import '../widgets/legal_profile_tile.dart';

class AccountingProfilePage extends StatefulWidget {
  const AccountingProfilePage({super.key});

  @override
  State<AccountingProfilePage> createState() => _AccountingProfilePageState();
}

class _AccountingProfilePageState extends State<AccountingProfilePage> {
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
    final session = _session;
    final profile = _profile;
    final themeProvider = context.watch<ThemeProvider>();
    final fullName = profile?.fullName.isNotEmpty == true
        ? profile!.fullName
        : session?.fullName ?? 'Muhasebe';
    final username = profile?.username.isNotEmpty == true
        ? profile!.username
        : session?.username ?? '-';
    final role = profile?.primaryRole.isNotEmpty == true
        ? profile!.primaryRole
        : 'Muhasebe';
    final department = profile?.departmentOrBranch ?? '';
    final campus = profile?.campus ?? '';
    final tenantName = profile?.tenantName ?? '';

    return AccountingScaffold(
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
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingPanel(
            child: Column(
              children: [
                const CircleAvatar(
                  radius: 40,
                  child: Icon(Icons.account_balance_wallet_rounded, size: 34),
                ),
                const SizedBox(height: 10),
                Text(
                  fullName,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
                const SizedBox(height: 4),
                Text(username, style: const TextStyle(color: Colors.grey)),
              ],
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            ),
          ],
          const SizedBox(height: 16),
          AccountingPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Muhasebe Profili",
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 12),
                _infoRow("Ad Soyad", fullName),
                _infoRow("Kullanıcı Adı", username),
                _infoRow("Rol", role),
                if (department.isNotEmpty) _infoRow("Birim", department),
                if (campus.isNotEmpty) _infoRow("Kampüs", campus),
                if (tenantName.isNotEmpty) _infoRow("Kurum", tenantName),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _profile == null
                        ? null
                        : () => _openEdit(_profile!),
                    icon: const Icon(Icons.edit_outlined),
                    label: const Text('Profili Düzenle'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AccountingPanel(
            child: Column(
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
                    "Finans ve duyuru banner akışlarını yönet.",
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
}
