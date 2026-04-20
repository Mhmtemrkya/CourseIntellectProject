import 'package:flutter/material.dart';

import '../services/app_settings_api_service.dart';
import '../widgets/admin_ui.dart';

class AdminSettingsPage extends StatefulWidget {
  const AdminSettingsPage({super.key});

  @override
  State<AdminSettingsPage> createState() => _AdminSettingsPageState();
}

class _AdminSettingsPageState extends State<AdminSettingsPage> {
  final _schoolNameController = TextEditingController();
  final _mailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _quotaController = TextEditingController();

  bool autoReports = true;
  bool parentNotifications = true;
  bool financeApprovals = true;

  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  @override
  void dispose() {
    _schoolNameController.dispose();
    _mailController.dispose();
    _phoneController.dispose();
    _quotaController.dispose();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await AppSettingsApiService.instance.fetchAll(
        category: 'institution',
      );
      if (!mounted) return;
      final map = {for (final item in items) item.key: item.value};
      _schoolNameController.text = map['institution_name'] ?? '';
      _mailController.text = map['institution_email'] ?? '';
      _phoneController.text = map['institution_phone'] ?? '';
      _quotaController.text = map['institution_quota'] ?? '';
      autoReports = map['auto_reports'] != 'false';
      parentNotifications = map['parent_notifications'] != 'false';
      financeApprovals = map['finance_approvals'] != 'false';
      setState(() => _loading = false);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.toString();
      });
    }
  }

  Future<void> _saveSettings() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await AppSettingsApiService.instance.upsert([
        {
          'key': 'institution_name',
          'value': _schoolNameController.text.trim(),
          'type': 'string',
          'category': 'institution',
          'description': 'Kurum adı',
        },
        {
          'key': 'institution_email',
          'value': _mailController.text.trim(),
          'type': 'string',
          'category': 'institution',
          'description': 'Kurumsal e-posta',
        },
        {
          'key': 'institution_phone',
          'value': _phoneController.text.trim(),
          'type': 'string',
          'category': 'institution',
          'description': 'Telefon',
        },
        {
          'key': 'institution_quota',
          'value': _quotaController.text.trim(),
          'type': 'string',
          'category': 'institution',
          'description': 'Öğrenci kapasitesi',
        },
        {
          'key': 'auto_reports',
          'value': autoReports.toString(),
          'type': 'bool',
          'category': 'institution',
          'description': 'Otomatik rapor',
        },
        {
          'key': 'parent_notifications',
          'value': parentNotifications.toString(),
          'type': 'bool',
          'category': 'institution',
          'description': 'Veli bildirim',
        },
        {
          'key': 'finance_approvals',
          'value': financeApprovals.toString(),
          'type': 'bool',
          'category': 'institution',
          'description': 'Finans onay',
        },
      ]);
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Kurum ayarları kaydedildi.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Kurum Ayarları',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            tooltip: 'Yenile',
            onPressed: _loading ? null : _loadSettings,
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
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                AdminHeroCard(
                  eyebrow: 'Kurumsal yapı',
                  title:
                      'Kurum bilgileri, otomasyon tercihleri ve genel yönetim ayarları tek sayfada.',
                  description:
                      'Yönetici tarafında rapor, iletişim ve kapasite ayarları merkezi olarak güncellenir.',
                  metrics: [
                    const AdminHeroMetric(label: 'Aktif Şube', value: '4'),
                    AdminHeroMetric(
                      label: 'Kapasite',
                      value: _quotaController.text.isEmpty
                          ? '-'
                          : _quotaController.text,
                    ),
                  ],
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                AdminPanel(
                  child: Column(
                    children: [
                      _field('Kurum Adi', _schoolNameController),
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
                          onPressed: _saving ? null : _saveSettings,
                          child: _saving
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Text('Ayarları Kaydet'),
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
                        onChanged: (value) =>
                            setState(() => autoReports = value),
                        title: const Text('Haftalık raporları otomatik uret'),
                      ),
                      SwitchListTile(
                        value: parentNotifications,
                        onChanged: (value) =>
                            setState(() => parentNotifications = value),
                        title: const Text('Velilere toplu bildirim akışı'),
                      ),
                      SwitchListTile(
                        value: financeApprovals,
                        onChanged: (value) =>
                            setState(() => financeApprovals = value),
                        title: const Text(
                          'Finans onaylari için ikinci kontrol',
                        ),
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
