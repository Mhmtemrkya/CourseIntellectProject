import 'package:flutter/material.dart';

import '../services/admin_workflow_api_service.dart';
import '../widgets/admin_ui.dart';

class AdminBranchRegistrationPage extends StatefulWidget {
  const AdminBranchRegistrationPage({super.key});

  @override
  State<AdminBranchRegistrationPage> createState() =>
      _AdminBranchRegistrationPageState();
}

class _AdminBranchRegistrationPageState
    extends State<AdminBranchRegistrationPage> {
  final _api = AdminWorkflowApiService.instance;
  final _nameController = TextEditingController();
  final _noteController = TextEditingController();
  List<Map<String, dynamic>> _units = const [];
  List<Map<String, dynamic>> _managers = const [];
  String _unitType = 'Şube';
  String? _managerUserId;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  bool _isBranch(Map<String, dynamic> unit) {
    final type = '${unit['unitType'] ?? ''}'.toLowerCase();
    return const {'şube', 'sube', 'kampüs', 'kampus'}.contains(type);
  }

  Future<void> _load() async {
    try {
      setState(() {
        _loading = true;
        _error = null;
      });
      final results = await Future.wait([
        _api.getOrgUnits(),
        _api.getManagerCandidates(),
      ]);
      if (!mounted) return;
      setState(() {
        _units = results[0].where(_isBranch).toList();
        _managers = results[1];
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Şube bilgileri alınamadı: $error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    final name = _nameController.text.trim();
    if (name.isEmpty || _managerUserId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Şube adı ve sorumlu seçimi zorunludur.')),
      );
      return;
    }
    final manager = _managers.cast<Map<String, dynamic>?>().firstWhere(
      (item) => '${item?['userId']}' == _managerUserId,
      orElse: () => null,
    );
    try {
      setState(() => _saving = true);
      await _api.createOrgUnit(
        name: name,
        unitType: _unitType,
        managerUserId: _managerUserId,
        managerName: manager?['fullName'] as String?,
        note: _noteController.text.trim().isEmpty
            ? null
            : _noteController.text.trim(),
      );
      _nameController.clear();
      _noteController.clear();
      _managerUserId = null;
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$name güvenli şekilde kaydedildi.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Şube kaydedilemedi: $error')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeCount = _units
        .where((unit) => unit['isActive'] != false)
        .length;
    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Şube Kaydı',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  AdminHeroCard(
                    eyebrow: 'Kurum yapılanması',
                    title: 'Şubelerinizi güvenli veri kapsamları olarak kurun.',
                    description:
                        'Öğrenci, personel, finans ve yetki kayıtları seçilen şube üzerinden ayrıştırılır. Her şubeye aktif bir sorumlu atayın.',
                    colors: const [Color(0xFF0F172A), Color(0xFF2563EB)],
                    metrics: [
                      AdminHeroMetric(
                        label: 'Aktif şube',
                        value: '$activeCount',
                      ),
                      AdminHeroMetric(
                        label: 'Toplam kayıt',
                        value: '${_units.length}',
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (_error != null) ...[
                    AdminPanel(child: Text(_error!)),
                    const SizedBox(height: 12),
                  ],
                  AdminPanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Yeni şube',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 14),
                        TextField(
                          controller: _nameController,
                          decoration: const InputDecoration(
                            labelText: 'Şube adı',
                            hintText: 'Örn. Merkez Şube',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          initialValue: _unitType,
                          decoration: const InputDecoration(
                            labelText: 'Tür',
                            border: OutlineInputBorder(),
                          ),
                          items: const [
                            DropdownMenuItem(
                              value: 'Şube',
                              child: Text('Şube'),
                            ),
                            DropdownMenuItem(
                              value: 'Kampüs',
                              child: Text('Kampüs'),
                            ),
                          ],
                          onChanged: (value) =>
                              setState(() => _unitType = value ?? 'Şube'),
                        ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          initialValue: _managerUserId,
                          decoration: const InputDecoration(
                            labelText: 'Şube sorumlusu',
                            border: OutlineInputBorder(),
                          ),
                          items: _managers
                              .map(
                                (manager) => DropdownMenuItem(
                                  value: '${manager['userId']}',
                                  child: Text(
                                    '${manager['fullName']} · ${manager['role']}',
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: (value) =>
                              setState(() => _managerUserId = value),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _noteController,
                          maxLines: 2,
                          decoration: const InputDecoration(
                            labelText: 'Açıklama (isteğe bağlı)',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 14),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: _saving ? null : _save,
                            child: Text(
                              _saving ? 'Kaydediliyor...' : 'Şubeyi Kaydet',
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Kayıtlı şubeler',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (_units.isEmpty)
                    const AdminPanel(
                      child: Text('Henüz şube veya kampüs kaydı bulunmuyor.'),
                    )
                  else
                    ..._units.map(
                      (unit) => AdminPanel(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(
                            '${unit['name']}',
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          subtitle: Text(
                            '${unit['managerName'] ?? 'Sorumlu atanmadı'} · ${unit['unitType']}',
                          ),
                          trailing: Text(
                            unit['isActive'] == false ? 'Pasif' : 'Aktif',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: unit['isActive'] == false
                                  ? const Color(0xFFB42318)
                                  : const Color(0xFF059669),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}
