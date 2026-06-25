import 'package:flutter/material.dart';

import '../services/admin_directory_api_service.dart';
import '../services/student_registry_store.dart';
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
    StudentRegistryStore.instance.ensureLoaded();
  }

  void _showClassDetails() {
    final students = StudentRegistryStore.instance.students;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) {
        return SafeArea(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(sheetContext).size.height * 0.8),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              shrinkWrap: true,
              children: [
                Text(
                  'Kayıtlı Sınıflar (${_classes.length})',
                  style: Theme.of(sheetContext).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 12),
                if (_classes.isEmpty)
                  const Text('Henüz sınıf kaydı bulunmuyor.')
                else
                  ..._classes.map((className) {
                    final count = students.where((s) => s.className == className).length;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: const CircleAvatar(child: Icon(Icons.school_outlined)),
                        title: Text(className, style: const TextStyle(fontWeight: FontWeight.w800)),
                        subtitle: Text('$count öğrenci kayıtlı'),
                      ),
                    );
                  }),
              ],
            ),
          ),
        );
      },
    );
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
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: OutlinedButton.icon(
                          onPressed: _classes.isEmpty ? null : _showClassDetails,
                          icon: const Icon(Icons.visibility_outlined, size: 18),
                          label: Text('Gör (${_classes.length})'),
                        ),
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
