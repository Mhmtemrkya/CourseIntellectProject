import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/admin_workflow_api_service.dart';

/// Özel roller: kurum yöneticisi ad + taban rol + modül seçimiyle kendi rolünü tanımlar
/// (ör. "Kayıt Sorumlusu"). Modül kısıtı backend'de (EntitlementService) zorlanır.
/// Desktop'taki Özel Roller bölümünün eşi.
class CustomRolesPage extends StatefulWidget {
  const CustomRolesPage({super.key});

  @override
  State<CustomRolesPage> createState() => _CustomRolesPageState();
}

class _CustomRolesPageState extends State<CustomRolesPage> {
  // Taban rol → seçilebilir modüller (desktop packageCatalog ROLE_MODULES ile hizalı).
  static const Map<String, List<(String, String)>> _modulesByBase = {
    'Administrative': [
      ('operations', 'Operasyon Paneli'),
      ('tasks', 'Görevler'),
      ('schedule', 'Ders Programı'),
      ('duties', 'Nöbetler'),
      ('records', 'Kayıtlar'),
      ('documents', 'Evrak'),
      ('password-reset', 'Şifre Sıfırlama'),
      ('registrations', 'Kayıt İşlemleri'),
      ('reports', 'Raporlar'),
      ('notifications', 'Bildirimler'),
      ('meetings', 'Görüşmeler'),
      ('chat', 'Mesajlaşma'),
      ('service', 'Servis Takip'),
      ('cafeteria', 'Yemekhane'),
      ('library', 'Kütüphane'),
      ('staff-hr', 'Personel / İK'),
    ],
    'Teacher': [
      ('dashboard', 'Panel'),
      ('schedule', 'Ders Programı'),
      ('attendance', 'Yoklama'),
      ('live-lessons', 'Canlı Dersler'),
      ('duties', 'Nöbetler'),
      ('content', 'İçerikler'),
      ('question-bank', 'Soru Bankası'),
      ('questions', 'Sorular'),
      ('exams', 'Sınavlar'),
      ('grade-entry', 'Not Girişi'),
      ('reports', 'Raporlar'),
      ('assignments', 'Ödevler'),
      ('meetings', 'Görüşmeler'),
      ('notifications', 'Bildirimler'),
      ('chat', 'Mesajlaşma'),
      ('library', 'Kütüphane'),
    ],
    'Cafeteria': [
      ('cafeteria', 'Yemekhane'),
    ],
  };

  final _api = AdminWorkflowApiService.instance;
  List<Map<String, dynamic>> _roles = const [];
  bool _loading = true;
  bool _creating = false;

  final _nameController = TextEditingController();
  String _baseRole = 'Administrative';
  final Set<String> _selectedModules = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final roles = await _api.getCustomRoles();
      if (!mounted) return;
      setState(() {
        _roles = roles;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _toast(String msg) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

  Future<void> _create() async {
    final name = _nameController.text.trim();
    if (name.length < 3) return _toast('Rol adı en az 3 karakter olmalıdır.'.tr);
    if (_selectedModules.isEmpty) return _toast('En az bir modül seçin.'.tr);
    try {
      await _api.createCustomRole(name: name, baseRole: _baseRole, modules: _selectedModules.toList());
      setState(() {
        _nameController.clear();
        _selectedModules.clear();
        _creating = false;
      });
      await _load();
      _toast('Özel rol oluşturuldu.'.tr);
    } catch (_) {
      _toast('Rol oluşturulamadı (aynı ad olabilir).'.tr);
    }
  }

  Future<void> _delete(String id) async {
    try {
      await _api.deleteCustomRole(id);
      await _load();
    } catch (_) {
      _toast('Silinemedi (atanmış kullanıcı olabilir).'.tr);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final modules = _modulesByBase[_baseRole] ?? const [];

    return Scaffold(
      appBar: AppBar(title: Text('Özel Roller'.tr)),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => setState(() => _creating = !_creating),
        icon: Icon(_creating ? Icons.close : Icons.add),
        label: Text(_creating ? 'Vazgeç'.tr : 'Yeni Rol'.tr),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_creating) ...[
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          TextField(
                            controller: _nameController,
                            decoration: InputDecoration(
                              labelText: 'Rol adı'.tr,
                              hintText: 'Örn: Kayıt Sorumlusu'.tr,
                              border: const OutlineInputBorder(),
                            ),
                          ),
                          const SizedBox(height: 10),
                          DropdownButtonFormField<String>(
                            initialValue: _baseRole,
                            decoration: InputDecoration(
                              labelText: 'Taban rol (panel)'.tr,
                              border: const OutlineInputBorder(),
                            ),
                            items: [
                              DropdownMenuItem(value: 'Administrative', child: Text('İdari Personel'.tr)),
                              DropdownMenuItem(value: 'Teacher', child: Text('Öğretmen'.tr)),
                              DropdownMenuItem(value: 'Cafeteria', child: Text('Yemekhaneci')),
                            ],
                            onChanged: (v) => setState(() {
                              _baseRole = v ?? 'Administrative';
                              _selectedModules.clear();
                            }),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            '${'Erişebileceği modüller'.tr} (${_selectedModules.length})',
                            style: theme.textTheme.bodySmall,
                          ),
                          Wrap(
                            spacing: 6,
                            children: modules
                                .map((m) => FilterChip(
                                      label: Text(m.$2),
                                      selected: _selectedModules.contains(m.$1),
                                      onSelected: (_) => setState(() {
                                        if (!_selectedModules.add(m.$1)) {
                                          _selectedModules.remove(m.$1);
                                        }
                                      }),
                                    ))
                                .toList(),
                          ),
                          const SizedBox(height: 10),
                          Align(
                            alignment: Alignment.centerRight,
                            child: FilledButton.icon(
                              onPressed: _create,
                              icon: const Icon(Icons.add),
                              label: Text('Rolü oluştur'.tr),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                ..._roles.map(
                  (r) => Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: ListTile(
                      leading: const CircleAvatar(child: Icon(Icons.badge_outlined)),
                      title: Text('${r['name']}', style: const TextStyle(fontWeight: FontWeight.w800)),
                      subtitle: Text(
                        '${r['baseRole']} · ${((r['modules'] as List?) ?? const []).length} ${'modül'.tr} · ${r['userCount']} ${'kullanıcı'.tr}',
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline),
                        onPressed: () => _delete(r['id'].toString()),
                      ),
                    ),
                  ),
                ),
                if (_roles.isEmpty && !_creating)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40),
                    child: Center(
                      child: Text(
                        'Henüz özel rol yok. "Yeni Rol" ile kuruma özgü rol tanımlayın; personel kaydında seçilebilir olur.'.tr,
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}
