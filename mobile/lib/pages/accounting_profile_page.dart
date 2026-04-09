import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_session_store.dart';
import 'notification_preferences_page.dart';
import '../theme_provider.dart';
import '../utils/session_navigation.dart';
import '../widgets/accounting_ui.dart';

class AccountingProfilePage extends StatefulWidget {
  const AccountingProfilePage({super.key});

  @override
  State<AccountingProfilePage> createState() => _AccountingProfilePageState();
}

class _AccountingProfilePageState extends State<AccountingProfilePage> {
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

    return AccountingScaffold(
      appBar: AppBar(title: const Text('Profilim', style: TextStyle(fontWeight: FontWeight.bold))),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AccountingPanel(
            child: Column(
              children: [
                const CircleAvatar(radius: 40, child: Icon(Icons.account_balance_wallet_rounded, size: 34)),
                const SizedBox(height: 10),
                Text(session?.fullName ?? "Muhasebe", style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                const SizedBox(height: 4),
                Text(session?.username ?? "-", style: const TextStyle(color: Colors.grey)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AccountingPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("Muhasebe Profili", style: TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 12),
                _infoRow("Ad Soyad", session?.fullName ?? "-"),
                _infoRow("Kullanici Adi", session?.username ?? "-"),
                _infoRow("Rol", "Muhasebe"),
                _infoRow("Birim", "Finans Operasyonlari"),
                const SizedBox(height: 12),
                const Text("Bu bilgiler sadece yonetici ve idari birimler tarafindan guncellenebilir."),
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
                  subtitle: const Text("Finans ve duyuru banner akışlarını yönet."),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const NotificationPreferencesPage()),
                  ),
                ),
                ListTile(
                  leading: const Icon(Icons.logout_rounded, color: Colors.red),
                  title: const Text("Cikis Yap", style: TextStyle(color: Colors.red)),
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
          Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700))),
          Expanded(child: Text(value, textAlign: TextAlign.right)),
        ],
      ),
    );
  }
}
