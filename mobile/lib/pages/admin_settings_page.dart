import 'package:flutter/material.dart';

import '../widgets/admin_ui.dart';

class AdminSettingsPage extends StatefulWidget {
  const AdminSettingsPage({super.key});

  @override
  State<AdminSettingsPage> createState() => _AdminSettingsPageState();
}

class _AdminSettingsPageState extends State<AdminSettingsPage> {
  final _schoolNameController = TextEditingController(text: 'Mindivan Akademi');
  final _mailController = TextEditingController(text: 'bilgi@mindivanakademi.com');
  final _phoneController = TextEditingController(text: '+90 212 555 33 22');
  final _quotaController = TextEditingController(text: '850');

  bool autoReports = true;
  bool parentNotifications = true;
  bool financeApprovals = true;

  @override
  void dispose() {
    _schoolNameController.dispose();
    _mailController.dispose();
    _phoneController.dispose();
    _quotaController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(
        title: const Text('Kurum Ayarları', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const AdminHeroCard(
            eyebrow: 'Kurumsal yapı',
            title: 'Kurum bilgileri, otomasyon tercihleri ve genel yönetim ayarları tek sayfada.',
            description: 'Yönetici tarafında rapor, iletişim ve kapasite ayarları merkezi olarak güncellenir.',
            metrics: [
              AdminHeroMetric(label: 'Aktif Şube', value: '4'),
              AdminHeroMetric(label: 'Kapasite', value: '850'),
            ],
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              children: [
                _field('Kurum Adı', _schoolNameController),
                const SizedBox(height: 12),
                _field('Kurumsal E-posta', _mailController),
                const SizedBox(height: 12),
                _field('Telefon', _phoneController),
                const SizedBox(height: 12),
                _field('Öğrenci Kapasitesi', _quotaController),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Kurum ayarları güncellendi.'), behavior: SnackBarBehavior.floating),
                      );
                    },
                    child: const Text('Ayarları Kaydet'),
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
                  value: autoReports,
                  onChanged: (value) => setState(() => autoReports = value),
                  title: const Text('Haftalık raporları otomatik üret'),
                ),
                SwitchListTile(
                  value: parentNotifications,
                  onChanged: (value) => setState(() => parentNotifications = value),
                  title: const Text('Velilere toplu bildirim akışı'),
                ),
                SwitchListTile(
                  value: financeApprovals,
                  onChanged: (value) => setState(() => financeApprovals = value),
                  title: const Text('Finans onayları için ikinci kontrol'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _field(String label, TextEditingController controller) {
    return TextField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
    );
  }
}
