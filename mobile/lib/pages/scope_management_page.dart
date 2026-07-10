import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/admin_workflow_api_service.dart';

/// Kapsam yönetimi (platform admin): grup hiyerarşisi (İl/İlçe/Marka), kurum→grup bağlama
/// ve kullanıcı yetki kapsamları (grant). Desktop'taki Kapsam Yönetimi ekranının eşi.
class ScopeManagementPage extends StatefulWidget {
  const ScopeManagementPage({super.key});

  @override
  State<ScopeManagementPage> createState() => _ScopeManagementPageState();
}

class _ScopeManagementPageState extends State<ScopeManagementPage> {
  final _api = AdminWorkflowApiService.instance;

  List<Map<String, dynamic>> _groups = const [];
  List<Map<String, dynamic>> _tenants = const [];
  bool _loading = true;

  final _groupNameController = TextEditingController();
  String? _newGroupParent;

  final _userSearchController = TextEditingController();
  List<Map<String, dynamic>> _users = const [];
  Map<String, dynamic>? _selectedUser;
  List<Map<String, dynamic>> _grants = const [];

  String _newLevel = 'Group';
  String? _newTargetId;
  String _newAccessMode = 'Manage';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _groupNameController.dispose();
    _userSearchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([_api.getScopeGroups(), _api.getScopeTenants()]);
      if (!mounted) return;
      setState(() {
        _groups = results[0];
        _tenants = results[1];
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _toast(String msg) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

  String _groupName(String? id) =>
      _groups.firstWhere((g) => g['id'] == id, orElse: () => const {})['name']?.toString() ?? '—';

  Future<void> _createGroup() async {
    final name = _groupNameController.text.trim();
    if (name.isEmpty) return _toast('Grup adı zorunludur.'.tr);
    try {
      await _api.createScopeGroup(name: name, parentGroupId: _newGroupParent);
      _groupNameController.clear();
      _newGroupParent = null;
      await _load();
      _toast('Grup oluşturuldu.'.tr);
    } catch (_) {
      _toast('Grup oluşturulamadı.'.tr);
    }
  }

  Future<void> _deleteGroup(String id) async {
    try {
      await _api.deleteScopeGroup(id);
      await _load();
    } catch (_) {
      _toast('Silinemedi (alt grubu veya bağlı kurumu olabilir).'.tr);
    }
  }

  Future<void> _assignTenant(String tenantId, String? groupId) async {
    try {
      await _api.assignTenantGroup(tenantId, groupId);
      await _load();
    } catch (_) {
      _toast('Atanamadı.'.tr);
    }
  }

  Future<void> _searchUsers() async {
    try {
      final res = await _api.searchScopeUsers(_userSearchController.text.trim());
      setState(() => _users = res);
    } catch (_) {
      setState(() => _users = const []);
    }
  }

  Future<void> _selectUser(Map<String, dynamic> user) async {
    setState(() => _selectedUser = user);
    try {
      final g = await _api.getUserGrants(user['id'].toString());
      if (mounted) setState(() => _grants = g);
    } catch (_) {
      if (mounted) setState(() => _grants = const []);
    }
  }

  Future<void> _addGrant() async {
    final user = _selectedUser;
    if (user == null) return;
    if (_newLevel != 'Platform' && (_newTargetId == null || _newTargetId!.isEmpty)) {
      return _toast('Hedef seçimi zorunludur.'.tr);
    }
    try {
      await _api.addUserGrant(
        user['id'].toString(),
        level: _newLevel,
        targetId: _newLevel == 'Platform' ? null : _newTargetId,
        accessMode: _newAccessMode,
      );
      setState(() {
        _newLevel = 'Group';
        _newTargetId = null;
        _newAccessMode = 'Manage';
      });
      final g = await _api.getUserGrants(user['id'].toString());
      if (mounted) setState(() => _grants = g);
      _toast('Kapsam eklendi.'.tr);
    } catch (_) {
      _toast('Eklenemedi (zaten atanmış olabilir).'.tr);
    }
  }

  Future<void> _removeGrant(String grantId) async {
    final user = _selectedUser;
    if (user == null) return;
    try {
      await _api.removeUserGrant(grantId);
      final g = await _api.getUserGrants(user['id'].toString());
      if (mounted) setState(() => _grants = g);
    } catch (_) {
      _toast('Silinemedi.'.tr);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Kapsam Yönetimi'.tr)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _groupsSection(),
                const SizedBox(height: 16),
                _tenantSection(),
                const SizedBox(height: 16),
                _grantsSection(),
              ],
            ),
    );
  }

  Widget _sectionTitle(String t) =>
      Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(t, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)));

  Widget _groupsSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionTitle('Grup Hiyerarşisi'.tr),
            TextField(
              controller: _groupNameController,
              decoration: InputDecoration(labelText: 'Grup adı (İl/İlçe/Marka)'.tr, border: const OutlineInputBorder()),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String?>(
                    initialValue: _newGroupParent,
                    decoration: InputDecoration(labelText: 'Üst grup'.tr, border: const OutlineInputBorder()),
                    items: [
                      DropdownMenuItem<String?>(value: null, child: Text('— Kök —'.tr)),
                      ..._groups.map((g) => DropdownMenuItem<String?>(value: g['id'].toString(), child: Text('${g['name']}'))),
                    ],
                    onChanged: (v) => setState(() => _newGroupParent = v),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(onPressed: _createGroup, child: Text('Ekle'.tr)),
              ],
            ),
            const Divider(),
            ..._groups.map((g) => ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text('${g['name']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text(
                    '${g['parentGroupId'] != null ? '↳ ${_groupName(g['parentGroupId']?.toString())} · ' : ''}${g['tenantCount']} ${'kurum'.tr}',
                  ),
                  trailing: IconButton(icon: const Icon(Icons.delete_outline), onPressed: () => _deleteGroup(g['id'].toString())),
                )),
            if (_groups.isEmpty) Text('Henüz grup yok.'.tr, style: TextStyle(color: Theme.of(context).hintColor)),
          ],
        ),
      ),
    );
  }

  Widget _tenantSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionTitle('Kurumları Gruba Bağla'.tr),
            ..._tenants.map((t) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Expanded(child: Text('${t['name']}', style: const TextStyle(fontWeight: FontWeight.w700))),
                      SizedBox(
                        width: 160,
                        child: DropdownButton<String?>(
                          isExpanded: true,
                          value: t['groupId']?.toString(),
                          hint: Text('— Grupsuz —'.tr),
                          items: [
                            DropdownMenuItem<String?>(value: null, child: Text('— Grupsuz —'.tr)),
                            ..._groups.map((g) => DropdownMenuItem<String?>(value: g['id'].toString(), child: Text('${g['name']}'))),
                          ],
                          onChanged: (v) => _assignTenant(t['id'].toString(), v),
                        ),
                      ),
                    ],
                  ),
                )),
            if (_tenants.isEmpty) Text('Kurum yok.'.tr, style: TextStyle(color: Theme.of(context).hintColor)),
          ],
        ),
      ),
    );
  }

  Widget _grantsSection() {
    final targets = _newLevel == 'Group'
        ? _groups
        : _newLevel == 'Tenant'
            ? _tenants
            : const <Map<String, dynamic>>[];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionTitle('Kullanıcı Kapsamları'.tr),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _userSearchController,
                    decoration: InputDecoration(labelText: 'Kullanıcı ara'.tr, border: const OutlineInputBorder()),
                    onSubmitted: (_) => _searchUsers(),
                  ),
                ),
                IconButton(icon: const Icon(Icons.search), onPressed: _searchUsers),
              ],
            ),
            if (_users.isNotEmpty && _selectedUser == null)
              ..._users.map((u) => ListTile(
                    dense: true,
                    title: Text('${u['fullName']}'),
                    subtitle: Text('${u['username']} · ${u['primaryRole']}'),
                    onTap: () => _selectUser(u),
                  )),
            if (_selectedUser != null) ...[
              const Divider(),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(child: Text('${_selectedUser!['fullName']}', style: const TextStyle(fontWeight: FontWeight.w800))),
                  TextButton(onPressed: () => setState(() { _selectedUser = null; _grants = const []; }), child: Text('değiştir'.tr)),
                ],
              ),
              ..._grants.map((gr) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text('${gr['level']} · ${gr['targetName']}'),
                    subtitle: Text('${gr['accessMode']}${gr['isHome'] == true ? ' · ev' : ''}'),
                    trailing: gr['isHome'] == true
                        ? null
                        : IconButton(icon: const Icon(Icons.delete_outline), onPressed: () => _removeGrant(gr['id'].toString())),
                  )),
              if (_grants.isEmpty) Text('Kapsam yok.'.tr, style: TextStyle(color: Theme.of(context).hintColor)),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: _newLevel,
                decoration: InputDecoration(labelText: 'Seviye'.tr, border: const OutlineInputBorder()),
                items: [
                  DropdownMenuItem(value: 'Group', child: Text('Grup (İl/İlçe/Marka)'.tr)),
                  DropdownMenuItem(value: 'Tenant', child: Text('Kurum'.tr)),
                  DropdownMenuItem(value: 'Platform', child: Text('Platform (tümü)'.tr)),
                ],
                onChanged: (v) => setState(() { _newLevel = v ?? 'Group'; _newTargetId = null; }),
              ),
              if (_newLevel != 'Platform') ...[
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: _newTargetId,
                  decoration: InputDecoration(labelText: 'Hedef'.tr, border: const OutlineInputBorder()),
                  items: targets
                      .map((o) => DropdownMenuItem(value: o['id'].toString(), child: Text('${o['name']}')))
                      .toList(),
                  onChanged: (v) => setState(() => _newTargetId = v),
                ),
              ],
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                initialValue: _newAccessMode,
                decoration: InputDecoration(labelText: 'Erişim'.tr, border: const OutlineInputBorder()),
                items: [
                  DropdownMenuItem(value: 'Manage', child: Text('Yönetim'.tr)),
                  DropdownMenuItem(value: 'ReadOnly', child: Text('Salt-okunur'.tr)),
                ],
                onChanged: (v) => setState(() => _newAccessMode = v ?? 'Manage'),
              ),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton.icon(onPressed: _addGrant, icon: const Icon(Icons.add), label: Text('Kapsam ekle'.tr)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
