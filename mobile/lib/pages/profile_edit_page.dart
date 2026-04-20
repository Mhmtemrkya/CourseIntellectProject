import 'package:flutter/material.dart';

import '../services/current_user_api_service.dart';
import '../widgets/admin_ui.dart';

class ProfileEditPage extends StatefulWidget {
  final CurrentUserProfile profile;

  const ProfileEditPage({super.key, required this.profile});

  @override
  State<ProfileEditPage> createState() => _ProfileEditPageState();
}

class _ProfileEditPageState extends State<ProfileEditPage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _fullName;
  late final TextEditingController _campus;
  late final TextEditingController _department;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fullName = TextEditingController(text: widget.profile.fullName);
    _campus = TextEditingController(text: widget.profile.campus);
    _department = TextEditingController(
      text: widget.profile.departmentOrBranch,
    );
  }

  @override
  void dispose() {
    _fullName.dispose();
    _campus.dispose();
    _department.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final updated = await CurrentUserApiService.instance.updateMe(
        fullName: _fullName.text.trim(),
        campus: _campus.text.trim(),
        departmentOrBranch: _department.text.trim(),
      );
      if (!mounted) return;
      Navigator.pop<CurrentUserProfile>(context, updated);
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
          'Profili Düzenle',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AdminPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const AdminSectionTitle(title: 'Kişisel Bilgiler'),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _fullName,
                    decoration: const InputDecoration(
                      labelText: 'Ad Soyad',
                      border: OutlineInputBorder(),
                    ),
                    validator: (value) =>
                        (value == null || value.trim().isEmpty)
                        ? 'Ad Soyad zorunlu'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _campus,
                    decoration: const InputDecoration(
                      labelText: 'Kampüs',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _department,
                    decoration: const InputDecoration(
                      labelText: 'Departman / Birim',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Color(0xFFB42318))),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Kaydet'),
            ),
          ],
        ),
      ),
    );
  }
}
