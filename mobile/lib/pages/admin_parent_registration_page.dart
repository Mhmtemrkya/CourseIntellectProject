import 'package:flutter/material.dart';

import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';

class AdminParentRegistrationPage extends StatefulWidget {
  const AdminParentRegistrationPage({super.key});

  @override
  State<AdminParentRegistrationPage> createState() => _AdminParentRegistrationPageState();
}

class _AdminParentRegistrationPageState extends State<AdminParentRegistrationPage> {
  final _formKey = GlobalKey<FormState>();
  final _parentNameController = TextEditingController();
  final _parentPhoneController = TextEditingController();
  final _parentEmailController = TextEditingController();
  final _studentNameController = TextEditingController();
  final _classController = TextEditingController();
  final _schoolController = TextEditingController();
  final _noteController = TextEditingController();
  List<String> _classOptions = const [];
  String _programType = 'Genel Takip';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadClassOptions();
  }

  @override
  void dispose() {
    _parentNameController.dispose();
    _parentPhoneController.dispose();
    _parentEmailController.dispose();
    _studentNameController.dispose();
    _classController.dispose();
    _schoolController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _loadClassOptions() async {
    await StudentRegistryStore.instance.ensureLoaded();
    final classes = StudentRegistryStore.instance.students
        .map((item) => item.className.trim())
        .where((item) => item.isNotEmpty)
        .toSet()
        .toList()
      ..sort();
    if (!mounted) return;
    setState(() {
      _classOptions = classes;
      if (_classController.text.trim().isEmpty && classes.isNotEmpty) {
        _classController.text = classes.first;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(
        title: const Text('Veli Kaydı', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      child: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const AdminHeroCard(
              eyebrow: 'Veli kayıt akışı',
              title: 'Veli ve bağlı öğrenci bilgisini ayrı bir formda hazırlayın.',
              description: 'Bu ekran veli odaklı kayıt toplar ve sistemde öğrenci-veli bağlantısını tek akışta oluşturur.',
              colors: [Color(0xFF0F172A), Color(0xFF7C3AED)],
              metrics: [
                AdminHeroMetric(label: 'Kayıt Türü', value: 'Veli + Öğrenci'),
                AdminHeroMetric(label: 'Sonuç', value: 'Giriş Bilgisi'),
              ],
            ),
            const SizedBox(height: 16),
            AdminPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const AdminSectionTitle(title: 'Veli Bilgileri'),
                  const SizedBox(height: 12),
                  _field(controller: _parentNameController, label: 'Veli Ad Soyad'),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _field(
                          controller: _parentPhoneController,
                          label: 'Telefon',
                          keyboardType: TextInputType.phone,
                          required: false,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _field(
                          controller: _parentEmailController,
                          label: 'E-Posta',
                          keyboardType: TextInputType.emailAddress,
                          required: false,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            AdminPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const AdminSectionTitle(title: 'Bağlı Öğrenci Bilgileri'),
                  const SizedBox(height: 12),
                  _field(controller: _studentNameController, label: 'Öğrenci Ad Soyad'),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _classController.text.trim().isEmpty ? null : _classController.text.trim(),
                          decoration: const InputDecoration(
                            labelText: 'Sınıf',
                            border: OutlineInputBorder(),
                          ),
                          items: _classOptions
                              .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                              .toList(),
                          onChanged: (value) => _classController.text = value ?? '',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _programType,
                          decoration: const InputDecoration(
                            labelText: 'Takip Türü',
                            border: OutlineInputBorder(),
                          ),
                          items: const [
                            DropdownMenuItem(value: 'Genel Takip', child: Text('Genel Takip')),
                            DropdownMenuItem(value: 'LGS Takip', child: Text('LGS Takip')),
                            DropdownMenuItem(value: 'YKS Sayısal', child: Text('YKS Sayısal')),
                            DropdownMenuItem(value: 'YKS Eşit Ağırlık', child: Text('YKS Eşit Ağırlık')),
                          ],
                          onChanged: (value) => setState(() => _programType = value ?? _programType),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _field(
                    controller: _schoolController,
                    label: 'Okul / Not',
                    required: false,
                  ),
                  const SizedBox(height: 12),
                  _field(
                    controller: _noteController,
                    label: 'Kayıt Notu',
                    required: false,
                    maxLines: 4,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _saving ? null : _submit,
              icon: const Icon(Icons.save_outlined),
              label: Text(_saving ? 'Kaydediliyor...' : 'Veli Kaydını Oluştur'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    bool required = true,
    int maxLines = 1,
    TextInputType? keyboardType,
  }) {
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      keyboardType: keyboardType,
      validator: required
          ? (value) => (value == null || value.trim().isEmpty) ? '$label zorunlu.' : null
          : null,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final credentials = await StudentRegistryStore.instance.addStudent(
        fullName: _studentNameController.text.trim(),
        tcNo: '',
        className: _classController.text.trim(),
        currentSchool: _schoolController.text.trim(),
        schoolNumber: '',
        birthDate: '',
        programType: _programType,
        parentName: _parentNameController.text.trim(),
        parentPhone: _parentPhoneController.text.trim(),
        parentEmail: _parentEmailController.text.trim(),
        address: '',
        note: _noteController.text.trim(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Veli kaydı oluşturuldu. Öğrenci kullanıcı adı: ${credentials.username}'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.pop(context);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString()), behavior: SnackBarBehavior.floating),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}
