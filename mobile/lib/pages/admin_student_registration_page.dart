import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/administrative_notice_store.dart';
import '../services/announcement_store.dart';
import '../services/registration_api_service.dart';
import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';

class AdminStudentRegistrationPage extends StatefulWidget {
  const AdminStudentRegistrationPage({super.key});

  @override
  State<AdminStudentRegistrationPage> createState() => _AdminStudentRegistrationPageState();
}

class _AdminStudentRegistrationPageState extends State<AdminStudentRegistrationPage> {
  final _formKey = GlobalKey<FormState>();

  final _fullNameController = TextEditingController();
  final _tcController = TextEditingController();
  final _classController = TextEditingController();
  final _schoolController = TextEditingController();
  final _schoolNumberController = TextEditingController();
  final _birthDateController = TextEditingController();
  final _parentNameController = TextEditingController();
  final _parentPhoneController = TextEditingController();
  final _parentEmailController = TextEditingController();
  final _addressController = TextEditingController();
  final _noteController = TextEditingController();

  String _programType = 'Sayisal';
  List<String> _classOptions = const [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadClassOptions();
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _tcController.dispose();
    _classController.dispose();
    _schoolController.dispose();
    _schoolNumberController.dispose();
    _birthDateController.dispose();
    _parentNameController.dispose();
    _parentPhoneController.dispose();
    _parentEmailController.dispose();
    _addressController.dispose();
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
        title: const Text('Yeni Ogrenci Kaydi', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      child: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const AdminHeroCard(
              eyebrow: 'Kayit merkezi',
              title: 'Ogrenci kaydini idari standartlara uygun sekilde tamamlayin.',
              description: 'Kayit sonrasi ogrenci icin sistem kullanici adi ve sifre otomatik uretilir; veli bilgileri ve program alani ayni akista tamamlanir.',
              colors: [Color(0xFF0F172A), Color(0xFF0F766E)],
              metrics: [
                AdminHeroMetric(label: 'Alan', value: 'Tum Kayit'),
                AdminHeroMetric(label: 'Cikti', value: 'Otomatik Giris'),
              ],
            ),
            const SizedBox(height: 16),
            AdminPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const AdminSectionTitle(title: 'Ogrenci Bilgileri'),
                  const SizedBox(height: 12),
                  _buildField(controller: _fullNameController, label: 'Ad Soyad'),
                  const SizedBox(height: 12),
                  _buildField(
                    controller: _tcController,
                    label: 'TC Kimlik No',
                    keyboardType: TextInputType.number,
                    maxLength: 11,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _classController.text.trim().isEmpty ? null : _classController.text.trim(),
                          decoration: const InputDecoration(
                            labelText: 'Sinif',
                            border: OutlineInputBorder(),
                          ),
                          items: _classOptions
                              .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                              .toList(),
                          onChanged: (value) {
                            _classController.text = value ?? '';
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildField(
                          controller: _schoolNumberController,
                          label: 'Okul No',
                          keyboardType: TextInputType.number,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _buildField(controller: _schoolController, label: 'Okudugu Okul'),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: _buildField(controller: _birthDateController, label: 'Dogum Tarihi')),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _programType,
                          decoration: const InputDecoration(
                            labelText: 'Program / Alan',
                            border: OutlineInputBorder(),
                          ),
                          items: const [
                            DropdownMenuItem(value: 'Sayisal', child: Text('Sayisal')),
                            DropdownMenuItem(value: 'Esit Agirlik', child: Text('Esit Agirlik')),
                            DropdownMenuItem(value: 'Dil', child: Text('Dil')),
                            DropdownMenuItem(value: 'LGS Takip', child: Text('LGS Takip')),
                          ],
                          onChanged: (value) => setState(() => _programType = value ?? _programType),
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
                  const AdminSectionTitle(title: 'Veli ve Iletisim Bilgileri'),
                  const SizedBox(height: 12),
                  _buildField(controller: _parentNameController, label: 'Veli Ad Soyad'),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _buildField(
                          controller: _parentPhoneController,
                          label: 'Veli Telefon',
                          keyboardType: TextInputType.phone,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildField(
                          controller: _parentEmailController,
                          label: 'Veli E-Posta',
                          keyboardType: TextInputType.emailAddress,
                          required: false,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _buildField(
                    controller: _addressController,
                    label: 'Adres',
                    maxLines: 3,
                    required: false,
                  ),
                  const SizedBox(height: 12),
                  _buildField(
                    controller: _noteController,
                    label: 'Kayit Notu',
                    maxLines: 4,
                    required: false,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            AdminPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const AdminSectionTitle(title: 'Onizleme ve Ek Kontroller'),
                  const SizedBox(height: 12),
                  _previewTile('Kayit Tipi', 'Kurumsal tam kayit'),
                  _previewTile('Veli Bilgilendirme', 'Kullanici adi ve sifre otomatik paylasima hazir'),
                  _previewTile('Ogrenci Durumu', 'Kayit sonrasi aktif kullanici olarak olusur'),
                ],
              ),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _saving ? null : () => Navigator.pop(context),
                    child: const Text('Vazgec'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _saving ? null : _submit,
                    icon: _saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.person_add_alt_1_outlined),
                    label: Text(_saving ? 'Kaydediliyor' : 'Kaydi Tamamla'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildField({
    required TextEditingController controller,
    required String label,
    TextInputType? keyboardType,
    int maxLines = 1,
    int? maxLength,
    bool required = true,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      maxLength: maxLength,
      validator: required
          ? (value) {
              if (value == null || value.trim().isEmpty) {
                return '$label alani zorunludur';
              }
              return null;
            }
          : null,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
    );
  }

  Widget _previewTile(String title, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          const Icon(Icons.check_circle_outline_rounded, size: 18),
          const SizedBox(width: 10),
          Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700))),
          const SizedBox(width: 10),
          Flexible(child: Text(value, textAlign: TextAlign.right)),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _saving = true);
    try {
      final credentials = await RegistrationApiService.instance.createStudent(
        fullName: _fullNameController.text.trim(),
        tcNo: _tcController.text.trim(),
        className: _classController.text.trim(),
        currentSchool: _schoolController.text.trim(),
        schoolNumber: _schoolNumberController.text.trim(),
        birthDate: _birthDateController.text.trim(),
        programType: _programType,
        parentName: _parentNameController.text.trim(),
        parentPhone: _parentPhoneController.text.trim(),
        parentEmail: _parentEmailController.text.trim(),
        address: _addressController.text.trim(),
        note: _noteController.text.trim(),
      );
      await AnnouncementStore.instance.addAnnouncement(
        title: '${_fullNameController.text.trim()} kaydı tamamlandı',
        detail:
            '${_parentNameController.text.trim()} için hoş geldiniz ve giriş bilgisi bilgilendirmesi hazırlandı. Kullanıcı adı: ${credentials.username}',
        audience: 'Veli',
      );
      await AdministrativeNoticeStore.instance.addNotice(
        title: 'Yeni öğrenci kaydı tamamlandı',
        detail:
            '${_fullNameController.text.trim()} • ${_classController.text.trim()} kaydı açıldı. Veli bilgilendirmesi otomatik oluşturuldu.',
        date: '15 Mart 2026 • 12:10',
        color: const Color(0xFF0F766E),
        icon: Icons.person_add_alt_1_outlined,
      );
      if (!mounted) return;
      setState(() => _saving = false);
      await _showSuccessCard(credentials);
    } on RegistrationApiException catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    }
  }

  Future<void> _showSuccessCard(GeneratedCredentials credentials) {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return Dialog(
          insetPadding: const EdgeInsets.symmetric(horizontal: 28),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: const Color(0xFF14532D).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(Icons.verified_rounded, color: Color(0xFF14532D)),
                ),
                const SizedBox(height: 14),
                Text(
                  'Kayit tamamlandi',
                  style: Theme.of(dialogContext).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 8),
                Text(
                  'Ogrenci sisteme girebilir. Asagidaki giris bilgileri otomatik olusturuldu.',
                  style: Theme.of(dialogContext).textTheme.bodyMedium?.copyWith(height: 1.45),
                ),
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDBEAFE),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Text(
                    'Veli için hoş geldiniz duyurusu ve idari bildirim kaydı otomatik oluşturuldu.',
                    style: TextStyle(
                      color: Color(0xFF1D4ED8),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Theme.of(dialogContext).cardColor,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Theme.of(dialogContext).dividerColor.withValues(alpha: 0.28)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _credentialRow('Kullanici Adi', credentials.username),
                      const SizedBox(height: 10),
                      _credentialRow('Sifre', credentials.password),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => _launchSms(credentials),
                      icon: const Icon(Icons.sms_outlined),
                      label: const Text('SMS'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => _launchWhatsapp(credentials),
                      icon: const Icon(Icons.chat_outlined),
                      label: const Text('WhatsApp'),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () async {
                          await Clipboard.setData(
                            ClipboardData(
                              text: 'Kullanici Adi: ${credentials.username}\nSifre: ${credentials.password}',
                            ),
                          );
                          if (!mounted) {
                            return;
                          }
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Giris bilgileri panoya kopyalandi.'),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        },
                        icon: const Icon(Icons.copy_all_rounded),
                        label: const Text('Kopyala'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () {
                          Navigator.pop(dialogContext);
                          Navigator.pop(context);
                        },
                        child: const Text('Listeye Don'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _credentialRow(String label, String value) {
    return Row(
      children: [
        Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700))),
        const SizedBox(width: 12),
        SelectableText(value, style: const TextStyle(fontWeight: FontWeight.w800)),
      ],
    );
  }

  Future<void> _launchSms(GeneratedCredentials credentials) async {
    final phone = _parentPhoneController.text.trim();
    final body =
        'Merhaba ${_parentNameController.text.trim()}, ${_fullNameController.text.trim()} kaydi tamamlandi. Kullanici adi: ${credentials.username} Sifre: ${credentials.password}';
    final uri = Uri(
      scheme: 'sms',
      path: phone,
      queryParameters: {'body': body},
    );
    await _launchExternal(uri);
  }

  Future<void> _launchWhatsapp(GeneratedCredentials credentials) async {
    final phone = _parentPhoneController.text.replaceAll(RegExp(r'[^0-9]'), '');
    final message =
        'Merhaba ${_parentNameController.text.trim()}, ${_fullNameController.text.trim()} kaydi tamamlandi. Kullanici adi: ${credentials.username} Sifre: ${credentials.password}';
    final uri = Uri.parse('https://wa.me/$phone?text=${Uri.encodeComponent(message)}');
    await _launchExternal(uri);
  }

  Future<void> _launchExternal(Uri uri) async {
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication) && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Paylaşım uygulaması açılamadı.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}
