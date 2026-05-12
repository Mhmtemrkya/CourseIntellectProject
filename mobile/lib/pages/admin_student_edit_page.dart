import 'package:flutter/material.dart';

import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';

class AdminStudentEditPage extends StatefulWidget {
  final StudentRegistryRecord student;

  const AdminStudentEditPage({super.key, required this.student});

  @override
  State<AdminStudentEditPage> createState() => _AdminStudentEditPageState();
}

class _AdminStudentEditPageState extends State<AdminStudentEditPage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _fullName;
  late final TextEditingController _tcNo;
  late final TextEditingController _className;
  late final TextEditingController _currentSchool;
  late final TextEditingController _schoolNumber;
  late final TextEditingController _birthDate;
  late final TextEditingController _programType;
  late final TextEditingController _parentName;
  late final TextEditingController _parentPhone;
  late final TextEditingController _parentEmail;
  late final TextEditingController _address;
  late final TextEditingController _note;

  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final s = widget.student;
    _fullName = TextEditingController(text: s.fullName);
    _tcNo = TextEditingController(text: s.tcNo);
    _className = TextEditingController(text: s.className);
    _currentSchool = TextEditingController(text: s.currentSchool);
    _schoolNumber = TextEditingController(text: s.schoolNumber);
    _birthDate = TextEditingController(text: s.birthDate);
    _programType = TextEditingController(text: s.programType);
    _parentName = TextEditingController(text: s.parentName);
    _parentPhone = TextEditingController(text: s.parentPhone);
    _parentEmail = TextEditingController(text: s.parentEmail);
    _address = TextEditingController(text: s.address);
    _note = TextEditingController(text: s.note);
  }

  @override
  void dispose() {
    _fullName.dispose();
    _tcNo.dispose();
    _className.dispose();
    _currentSchool.dispose();
    _schoolNumber.dispose();
    _birthDate.dispose();
    _programType.dispose();
    _parentName.dispose();
    _parentPhone.dispose();
    _parentEmail.dispose();
    _address.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await StudentRegistryStore.instance.updateStudent(
        id: widget.student.id,
        fullName: _fullName.text.trim(),
        tcNo: _tcNo.text.trim(),
        className: _className.text.trim(),
        currentSchool: _currentSchool.text.trim(),
        schoolNumber: _schoolNumber.text.trim(),
        birthDate: _birthDate.text.trim(),
        programType: _programType.text.trim(),
        parentName: _parentName.text.trim(),
        parentPhone: _parentPhone.text.trim(),
        parentEmail: _parentEmail.text.trim(),
        address: _address.text.trim(),
        note: _note.text.trim(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Öğrenci güncellendi.')));
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = 'Güncelleme başarısız: $error';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Öğrenci Düzenle',
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
                  const AdminSectionTitle(title: 'Öğrenci Bilgileri'),
                  const SizedBox(height: 12),
                  _field(_fullName, 'Ad Soyad', required: true),
                  _field(_tcNo, 'TC Kimlik No'),
                  _field(_className, 'Sınıf', required: true),
                  _field(_currentSchool, 'Okudugu Okul'),
                  _field(_schoolNumber, 'Okul No'),
                  _field(_birthDate, 'Dogum Tarihi (gg.aa.yyyy)'),
                  _field(_programType, 'Alan / Program'),
                ],
              ),
            ),
            const SizedBox(height: 16),
            AdminPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const AdminSectionTitle(title: 'Veli ve İletişim'),
                  const SizedBox(height: 12),
                  _field(_parentName, 'Veli Ad Soyad'),
                  _field(_parentPhone, 'Telefon'),
                  _field(_parentEmail, 'E-Posta'),
                  _field(_address, 'Adres', maxLines: 2),
                ],
              ),
            ),
            const SizedBox(height: 16),
            AdminPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const AdminSectionTitle(title: 'İdari Not'),
                  const SizedBox(height: 12),
                  _field(_note, 'Not', maxLines: 3),
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

  Widget _field(
    TextEditingController controller,
    String label, {
    bool required = false,
    int maxLines = 1,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        maxLines: maxLines,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
        validator: required
            ? (value) => (value == null || value.trim().isEmpty)
                  ? '$label zorunlu'
                  : null
            : null,
      ),
    );
  }
}
