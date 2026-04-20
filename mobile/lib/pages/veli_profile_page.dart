import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'notification_preferences_page.dart';
import '../services/auth_session_store.dart';
import '../services/linked_children_service.dart';
import '../theme_provider.dart';
import '../utils/session_navigation.dart';
import '../widgets/adaptive_scaffold.dart';
import '../widgets/app_header.dart';

class VeliProfilPage extends StatefulWidget {
  const VeliProfilPage({super.key});

  @override
  State<VeliProfilPage> createState() => _VeliProfilPageState();
}

class _VeliProfilPageState extends State<VeliProfilPage> {
  AuthSession? _session;
  String _selectedChild = '';
  List<LinkedChildRecord> _children = const [];

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    final session = await AuthSessionStore.instance.load();
    final children = await LinkedChildrenService.instance.loadLinkedChildren();
    if (!mounted) return;
    setState(() {
      _session = session;
      _children = children;
      _selectedChild = children.isNotEmpty ? children.first.displayLabel : '';
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = _session;
    final themeProvider = context.watch<ThemeProvider>();

    final hasSidebar = SidebarState.of(context);
    return Scaffold(
      appBar: hasSidebar ? null : const AppHeader(title: "Profilim"),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _card(
            Column(
              children: [
                const CircleAvatar(
                  radius: 40,
                  child: Icon(Icons.family_restroom_rounded, size: 36),
                ),
                const SizedBox(height: 10),
                Text(
                  session?.fullName ?? "Veli",
                  style: const TextStyle(
                    fontSize: 18,
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
                  "Veli Bilgileri",
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 12),
                _infoRow("Ad Soyad", session?.fullName ?? "-"),
                _infoRow("Kullanıcı Adı", session?.username ?? "-"),
                _infoRow("Rol", "Veli"),
                _infoRow(
                  "Seçili Çocuk",
                  _selectedChild.isEmpty ? "-" : _selectedChild,
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: _selectedChild.isEmpty ? null : _selectedChild,
                  decoration: const InputDecoration(
                    labelText: 'Çocuk Seç',
                    border: OutlineInputBorder(),
                  ),
                  items: _children
                      .map(
                        (child) => DropdownMenuItem(
                          value: child.displayLabel,
                          child: Text(child.displayLabel),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    if (value == null) return;
                    setState(() => _selectedChild = value);
                  },
                ),
                const SizedBox(height: 12),
                const Text(
                  "Bu bilgiler sadece yönetiçi ve idari birimler tarafından güncellenebilir.",
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
                    "Ödeme, mesaj, görüşme ve rapor uyarılarını yönet.",
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
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 6)],
      ),
      child: child,
    );
  }
}
