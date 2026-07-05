import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import 'package:provider/provider.dart';

import '../theme_provider.dart';
import '../utils/session_navigation.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool notificationsEnabled = true;
  bool messageNotif = true;
  bool examNotif = true;
  bool homeworkNotif = true;

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text("Ayarlar")),

      body: ListView(
        children: [
          const SizedBox(height: 10),

          /// DARK MODE
          SwitchListTile(
            title: const Text("Dark Mode"),

            value: themeProvider.isDarkMode,

            onChanged: (val) {
              themeProvider.toggleTheme(val);
            },
          ),

          const Divider(),

          /// BİLDİRİMLER
          SwitchListTile(
            title: Text("Bildirimleri Aç".tr),

            value: notificationsEnabled,

            onChanged: (val) {
              setState(() {
                notificationsEnabled = val;
              });
            },
          ),

          if (notificationsEnabled) ...[
            SwitchListTile(
              title: const Text("Mesaj Bildirimleri"),

              value: messageNotif,

              onChanged: (val) {
                setState(() {
                  messageNotif = val;
                });
              },
            ),

            SwitchListTile(
              title: Text("Sınav Bildirimleri".tr),

              value: examNotif,

              onChanged: (val) {
                setState(() {
                  examNotif = val;
                });
              },
            ),

            SwitchListTile(
              title: Text("Ödev Bildirimleri".tr),

              value: homeworkNotif,

              onChanged: (val) {
                setState(() {
                  homeworkNotif = val;
                });
              },
            ),
          ],

          const Divider(),

          ListTile(
            leading: const Icon(Icons.logout),
            title: Text("Çıkış Yap".tr),
            onTap: () => logoutToRoleSelect(context),
          ),
        ],
      ),
    );
  }
}
