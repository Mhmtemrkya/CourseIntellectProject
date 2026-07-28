import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/admin_workflow_api_service.dart';
import '../services/auth_session_store.dart';
import '../services/staff_registry_store.dart';

class AdminStaffEditPage extends StatefulWidget {
  final String staffId;

  const AdminStaffEditPage({super.key, required this.staffId});

  @override
  State<AdminStaffEditPage> createState() => _AdminStaffEditPageState();
}

class _AdminStaffEditPageState extends State<AdminStaffEditPage> {
  final _store = StaffRegistryStore.instance;
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _fullName;
  late final TextEditingController _branchOrDepartment;
  late final TextEditingController _phone;
  late final TextEditingController _email;
  late final TextEditingController _education;
  late final TextEditingController _campus;
  late final TextEditingController _homeroomClass;
  late final TextEditingController _assignedClasses;
  late final TextEditingController _note;
  late final TextEditingController _childCount;

  String _maritalStatus = 'Belirtilmedi';
  bool _isSaving = false;
  bool _isLoadingPermissions = false;
  bool _canManagePermissions = false;
  String _role = '';
  String _branchId = '';
  String _customRoleId = '';
  List<Map<String, dynamic>> _branches = const [];
  List<Map<String, dynamic>> _customRoles = const [];

  static const _maritalOptions = ['Belirtilmedi', 'Bekar', 'Evli'];

  @override
  void initState() {
    super.initState();
    final record = _findRecord();
    _fullName = TextEditingController(text: record?.fullName ?? '');
    _branchOrDepartment = TextEditingController(
      text: record?.branchOrDepartment ?? '',
    );
    _phone = TextEditingController(text: record?.phone ?? '');
    _email = TextEditingController(text: record?.email ?? '');
    _education = TextEditingController(text: record?.education ?? '');
    _campus = TextEditingController(text: record?.campus ?? '');
    _homeroomClass = TextEditingController(
      text: (record?.homeroomClass ?? '') == 'Sınıf öğretmenliği yok'
          ? ''
          : (record?.homeroomClass ?? ''),
    );
    _assignedClasses = TextEditingController(
      text: (record?.assignedClasses ?? const <String>[]).join(', '),
    );
    _note = TextEditingController(text: record?.note ?? '');
    _childCount = TextEditingController(
      text: (record?.childCount ?? 0).toString(),
    );
    final initialMarital = record?.maritalStatus ?? 'Belirtilmedi';
    _maritalStatus = _maritalOptions.contains(initialMarital)
        ? initialMarital
        : 'Belirtilmedi';
    _role = _apiRole(record?.roleType ?? '');
    _branchId = record?.branchId ?? '';
    _customRoleId = record?.customRoleId ?? '';
    _loadPermissionOptions();
  }

  String _apiRole(String role) => switch (role) {
    'Öğretmen' => 'Teacher',
    'Personel' || 'İdari Birimler' => 'Administrative',
    'Muhasebeci' => 'Accounting',
    'Yemekhaneci' => 'Cafeteria',
    _ => role,
  };

  Future<void> _loadPermissionOptions() async {
    final session = await AuthSessionStore.instance.load();
    final isAdmin = session?.primaryRole.toLowerCase() == 'admin';
    if (!mounted) return;
    setState(() => _canManagePermissions = isAdmin);
    if (!isAdmin) return;

    setState(() => _isLoadingPermissions = true);
    try {
      final api = AdminWorkflowApiService.instance;
      final results = await Future.wait([
        api.getOrgUnits(),
        api.getCustomRoles(),
      ]);
      if (!mounted) return;
      setState(() {
        _branches = results[0]
            .where(
              (unit) =>
                  unit['isActive'] != false &&
                  [
                    'şube',
                    'sube',
                    'kampüs',
                    'kampus',
                  ].contains((unit['unitType'] ?? '').toString().toLowerCase()),
            )
            .toList();
        _customRoles = results[1];
      });
    } finally {
      if (mounted) setState(() => _isLoadingPermissions = false);
    }
  }

  StaffRegistryRecord? _findRecord() {
    return _store.staff
        .where((record) => record.id == widget.staffId)
        .cast<StaffRegistryRecord?>()
        .firstWhere((_) => true, orElse: () => null);
  }

  @override
  void dispose() {
    _fullName.dispose();
    _branchOrDepartment.dispose();
    _phone.dispose();
    _email.dispose();
    _education.dispose();
    _campus.dispose();
    _homeroomClass.dispose();
    _assignedClasses.dispose();
    _note.dispose();
    _childCount.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_canManagePermissions &&
        _role == 'BranchManager' &&
        _branchId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Şube müdürü için şube seçimi zorunludur.'.tr)),
      );
      return;
    }
    setState(() => _isSaving = true);

    final assignedClasses = _assignedClasses.text
        .split(',')
        .map((part) => part.trim())
        .where((part) => part.isNotEmpty)
        .toList();
    final childCount = int.tryParse(_childCount.text.trim()) ?? 0;

    try {
      await _store.updateStaff(
        id: widget.staffId,
        fullName: _fullName.text.trim(),
        branchOrDepartment: _branchOrDepartment.text.trim(),
        phone: _phone.text.trim(),
        email: _email.text.trim(),
        education: _education.text.trim(),
        campus: _campus.text.trim(),
        homeroomClass: _homeroomClass.text.trim(),
        assignedClasses: assignedClasses,
        maritalStatus: _maritalStatus,
        childCount: childCount,
        note: _note.text.trim(),
      );
      final record = _findRecord();
      if (_canManagePermissions && record != null && record.userId.isNotEmpty) {
        await AdminWorkflowApiService.instance.updateStaffAssignment(
          record.userId,
          role: _role,
          branchId: _branchId.isEmpty ? null : _branchId,
          customRoleId: _customRoleId.isEmpty ? null : _customRoleId,
          clearCustomRole: _customRoleId.isEmpty,
          clearBranch: _branchId.isEmpty,
        );
        await _store.refresh();
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Personel bilgileri güncellendi.'.tr)),
      );
      Navigator.pop(context);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Güncelleme başarısız: $error')));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final record = _findRecord();
    if (record == null) {
      return Scaffold(
        appBar: AppBar(title: Text('Personel Düzenle'.tr)),
        body: Center(child: Text('Personel kaydı bulunamadı.'.tr)),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text('Personel Düzenle'.tr)),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _Section(
              title: 'Kimlik',
              children: [
                _textField(
                  controller: _fullName,
                  label: 'Ad Soyad',
                  required: true,
                ),
                _textField(
                  controller: _email,
                  label: 'E-posta',
                  keyboardType: TextInputType.emailAddress,
                ),
                _textField(
                  controller: _phone,
                  label: 'Telefon',
                  keyboardType: TextInputType.phone,
                ),
              ],
            ),
            _Section(
              title: 'Görev'.tr,
              children: [
                _textField(controller: _campus, label: 'Kampüs'.tr),
                _textField(
                  controller: _branchOrDepartment,
                  label: 'Departman / Branş'.tr,
                ),
                _textField(
                  controller: _homeroomClass,
                  label: 'Sınıf Öğretmenliği (opsiyonel)'.tr,
                ),
                _textField(
                  controller: _assignedClasses,
                  label: 'Atanan Sınıflar (virgülle ayır)'.tr,
                  hint: 'Örn: 10-A, 11-B',
                ),
              ],
            ),
            _Section(
              title: 'Özlük'.tr,
              children: [
                _textField(controller: _education, label: 'Öğrenim'.tr),
                DropdownButtonFormField<String>(
                  initialValue: _maritalStatus,
                  items: _maritalOptions
                      .map(
                        (option) => DropdownMenuItem(
                          value: option,
                          child: Text(option),
                        ),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setState(() => _maritalStatus = value ?? 'Belirtilmedi'),
                  decoration: _fieldDecoration('Medeni Durum'),
                ),
                const SizedBox(height: 12),
                _textField(
                  controller: _childCount,
                  label: 'Çocuk Sayısı'.tr,
                  keyboardType: TextInputType.number,
                ),
                _textField(controller: _note, label: 'Not', maxLines: 3),
              ],
            ),
            if (_canManagePermissions)
              _Section(
                title: 'Rol, Şube ve Yetkiler'.tr,
                children: [
                  if (_isLoadingPermissions)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: LinearProgressIndicator(),
                    ),
                  DropdownButtonFormField<String>(
                    key: ValueKey('role-$_role'),
                    initialValue: _role.isEmpty ? null : _role,
                    isExpanded: true,
                    decoration: _fieldDecoration('Temel Rol'),
                    items: const [
                      DropdownMenuItem(
                        value: 'Teacher',
                        child: Text('Öğretmen'),
                      ),
                      DropdownMenuItem(
                        value: 'BranchManager',
                        child: Text('Şube Müdürü'),
                      ),
                      DropdownMenuItem(
                        value: 'Administrative',
                        child: Text('İdari Personel'),
                      ),
                      DropdownMenuItem(
                        value: 'Accounting',
                        child: Text('Muhasebe'),
                      ),
                      DropdownMenuItem(
                        value: 'Cafeteria',
                        child: Text('Yemekhaneci'),
                      ),
                    ],
                    onChanged: _isLoadingPermissions
                        ? null
                        : (value) => setState(() {
                            _role = value ?? _role;
                            _customRoleId = '';
                          }),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    key: ValueKey('branch-$_branchId'),
                    initialValue: _branchId.isEmpty ? '__none__' : _branchId,
                    isExpanded: true,
                    decoration: _fieldDecoration(
                      _role == 'BranchManager' ? 'Şube *' : 'Şube',
                    ),
                    items: [
                      const DropdownMenuItem(
                        value: '__none__',
                        child: Text('Kurum geneli'),
                      ),
                      if (_branchId.isNotEmpty &&
                          !_branches.any(
                            (branch) => branch['id']?.toString() == _branchId,
                          ))
                        DropdownMenuItem(
                          value: _branchId,
                          child: const Text('Mevcut şube'),
                        ),
                      ..._branches.map(
                        (branch) => DropdownMenuItem(
                          value: branch['id']?.toString(),
                          child: Text(
                            '${branch['name']}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                    ],
                    onChanged: _isLoadingPermissions
                        ? null
                        : (value) => setState(
                            () => _branchId = value == '__none__'
                                ? ''
                                : (value ?? ''),
                          ),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    key: ValueKey('custom-$_customRoleId-$_role'),
                    initialValue: _customRoleId.isEmpty
                        ? '__base__'
                        : _customRoleId,
                    isExpanded: true,
                    decoration: _fieldDecoration('Yetki Profili'),
                    items: [
                      const DropdownMenuItem(
                        value: '__base__',
                        child: Text('Temel rol yetkileri'),
                      ),
                      if (_customRoleId.isNotEmpty &&
                          !_customRoles.any(
                            (role) => role['id']?.toString() == _customRoleId,
                          ))
                        DropdownMenuItem(
                          value: _customRoleId,
                          child: const Text('Mevcut yetki profili'),
                        ),
                      ..._customRoles
                          .where(
                            (role) =>
                                _role.isEmpty || role['baseRole'] == _role,
                          )
                          .map(
                            (role) => DropdownMenuItem(
                              value: role['id']?.toString(),
                              child: Text(
                                '${role['name']}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ),
                    ],
                    onChanged: _isLoadingPermissions
                        ? null
                        : (value) {
                            final selected = _customRoles
                                .where(
                                  (role) => role['id']?.toString() == value,
                                )
                                .cast<Map<String, dynamic>?>()
                                .firstWhere((_) => true, orElse: () => null);
                            setState(() {
                              _customRoleId = value == '__base__'
                                  ? ''
                                  : (value ?? '');
                              if (selected?['baseRole'] != null) {
                                _role = selected!['baseRole'].toString();
                              }
                            });
                          },
                  ),
                  if (_customRoleId.isNotEmpty)
                    _PermissionSummary(
                      role: _customRoles
                          .where(
                            (role) => role['id']?.toString() == _customRoleId,
                          )
                          .cast<Map<String, dynamic>?>()
                          .firstWhere((_) => true, orElse: () => null),
                    ),
                ],
              ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: _isSaving ? null : _save,
              icon: _isSaving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.save_outlined),
              label: Text(_isSaving ? 'Kaydediliyor…' : 'Kaydet'),
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _textField({
    required TextEditingController controller,
    required String label,
    String? hint,
    TextInputType? keyboardType,
    int maxLines = 1,
    bool required = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        maxLines: maxLines,
        decoration: _fieldDecoration(label, hint: hint),
        validator: required
            ? (value) => (value == null || value.trim().isEmpty)
                  ? '$label zorunlu.'
                  : null
            : null,
      ),
    );
  }

  InputDecoration _fieldDecoration(String label, {String? hint}) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      filled: true,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _Section({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}

class _PermissionSummary extends StatelessWidget {
  final Map<String, dynamic>? role;

  const _PermissionSummary({required this.role});

  @override
  Widget build(BuildContext context) {
    if (role == null) return const SizedBox.shrink();
    final modules = (role!['modules'] as List<dynamic>? ?? const [])
        .map((item) => item.toString())
        .toList();
    final permissions = (role!['permissions'] as List<dynamic>? ?? const [])
        .map((item) => item.toString())
        .toList();
    final entries = [...modules, ...permissions];
    if (entries.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(
          context,
        ).colorScheme.primaryContainer.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Verilecek erişimler',
            style: Theme.of(
              context,
            ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: entries.map((entry) => Chip(label: Text(entry))).toList(),
          ),
        ],
      ),
    );
  }
}
