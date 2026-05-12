import 'package:flutter/material.dart';

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
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Personel bilgileri güncellendi.')),
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
        appBar: AppBar(title: const Text('Personel Düzenle')),
        body: const Center(child: Text('Personel kaydı bulunamadı.')),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Personel Düzenle')),
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
              title: 'Görev',
              children: [
                _textField(controller: _campus, label: 'Kampüs'),
                _textField(
                  controller: _branchOrDepartment,
                  label: 'Departman / Branş',
                ),
                _textField(
                  controller: _homeroomClass,
                  label: 'Sınıf Öğretmenliği (opsiyonel)',
                ),
                _textField(
                  controller: _assignedClasses,
                  label: 'Atanan Sınıflar (virgülle ayır)',
                  hint: 'Örn: 10-A, 11-B',
                ),
              ],
            ),
            _Section(
              title: 'Özlük',
              children: [
                _textField(controller: _education, label: 'Öğrenim'),
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
                  label: 'Çocuk Sayısı',
                  keyboardType: TextInputType.number,
                ),
                _textField(controller: _note, label: 'Not', maxLines: 3),
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
