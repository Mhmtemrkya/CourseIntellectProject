import 'package:flutter/material.dart';

import '../services/admin_directory_api_service.dart';
import '../widgets/admin_ui.dart';

class AdminClassManagementPage extends StatefulWidget {
  const AdminClassManagementPage({super.key});

  @override
  State<AdminClassManagementPage> createState() =>
      _AdminClassManagementPageState();
}

class _AdminClassManagementPageState extends State<AdminClassManagementPage> {
  final TextEditingController _classNameController = TextEditingController();
  List<String> _classes = const [];
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadClasses();
  }

  @override
  void dispose() {
    _classNameController.dispose();
    super.dispose();
  }

  Future<void> _loadClasses() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final classes = await AdminDirectoryApiService.instance.fetchClasses();
      if (!mounted) return;
      setState(() {
        _classes = classes;
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

  Future<void> _createClass() async {
    final name = _classNameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lütfen sınıf adını girin.')),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      final created = await AdminDirectoryApiService.instance.createClass(name);
      if (!mounted) return;
      _classNameController.clear();
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('$created sınıfı eklendi.')));
      await _loadClasses();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Sınıf Ekle',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const AdminHeroCard(
                  eyebrow: 'Sınıf yönetimi',
                  title:
                      'Yeni sınıf tanımlarını ekleyin ve tüm mobil formlarda kullanıma açın.',
                  description:
                      'Eklenen sınıflar öğrenci kaydı ve ders programı ekranlarında liste olarak görünür.',
                  metrics: [
                    AdminHeroMetric(label: 'Kaynak', value: 'Veritabanı'),
                    AdminHeroMetric(label: 'Kapsam', value: 'Mobil Formlar'),
                  ],
                ),
                const SizedBox(height: 16),
                AdminPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const AdminSectionTitle(title: 'Yeni Sınıf'),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _classNameController,
                        decoration: const InputDecoration(
                          labelText: 'Sınıf Adı',
                          hintText: 'Örn: 10-B',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: _saving ? null : _createClass,
                          icon: _saving
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Icon(Icons.add_rounded),
                          label: Text(
                            _saving ? 'Ekleniyor...' : 'Sınıfı Kaydet',
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _error!,
                    style: const TextStyle(color: Color(0xFFB42318)),
                  ),
                ],
                const SizedBox(height: 16),
                AdminPanel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AdminSectionTitle(
                        title: 'Kayıtlı Sınıflar',
                        actionLabel: 'Yenile',
                        onAction: _loadClasses,
                      ),
                      const SizedBox(height: 12),
                      if (_classes.isEmpty)
                        const Text('Henüz sınıf kaydı bulunmuyor.')
                      else
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: _classes
                              .map(
                                (item) => AdminAccentBadge(
                                  label: item,
                                  color: const Color(0xFF2563EB),
                                ),
                              )
                              .toList(),
                        ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
