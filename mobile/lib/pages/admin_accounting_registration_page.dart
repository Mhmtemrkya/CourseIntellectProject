import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/registration_api_service.dart';
import '../widgets/admin_ui.dart';

class AdminAccountingRegistrationPage extends StatefulWidget {
  const AdminAccountingRegistrationPage({super.key});

  @override
  State<AdminAccountingRegistrationPage> createState() =>
      _AdminAccountingRegistrationPageState();
}

class _AdminAccountingRegistrationPageState
    extends State<AdminAccountingRegistrationPage> {
  final _formKey = GlobalKey<FormState>();

  final _nameController = TextEditingController();
  final _tcController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _educationController = TextEditingController();
  final _startDateController = TextEditingController();
  final _campusController = TextEditingController(text: 'Merkez Kampüs');
  final _childCountController = TextEditingController(text: '0');
  final _noteController = TextEditingController();

  String _maritalStatus = 'Bekar';
  bool _saving = false;

  @override
  void dispose() {
    _nameController.dispose();
    _tcController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _educationController.dispose();
    _startDateController.dispose();
    _campusController.dispose();
    _childCountController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Muhasebe Kaydı',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const AdminHeroCard(
            eyebrow: 'Yöneticiye özel finans kadro kaydı',
            title:
                'Muhasebe kullanıcılarını ayrı bir finans kayıt akışıyla oluşturun.',
            description:
                'Bu ekran sadece yönetiçi tarafında kullanılır. Kayıt tamamlandığında muhasebe paneline girebilecek kullanıcı adı ve şifre otomatik üretilir.',
            colors: [Color(0xFF0F172A), Color(0xFF14532D)],
            metrics: [
              AdminHeroMetric(label: 'Rol', value: 'Muhasebe'),
              AdminHeroMetric(label: 'Erişim', value: 'Yönetici oluşturur'),
            ],
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const AdminSectionTitle(title: 'Muhasebe Profil Bilgileri'),
                  const SizedBox(height: 12),
                  _field(controller: _nameController, label: 'Ad Soyad'),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _field(
                          controller: _tcController,
                          label: 'TC Kimlik No',
                          keyboardType: TextInputType.number,
                          maxLength: 11,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _field(
                          controller: _phoneController,
                          label: 'Telefon',
                          keyboardType: TextInputType.phone,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _field(
                    controller: _emailController,
                    label: 'E-Posta',
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 12),
                  _field(
                    controller: _educationController,
                    label: 'Mezuniyet / Universite',
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _field(
                          controller: _startDateController,
                          label: 'Ise Baslama Tarihi',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _field(
                          controller: _campusController,
                          label: 'Kampüs',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _maritalStatus,
                          decoration: const InputDecoration(
                            labelText: 'Medeni Durum',
                            border: OutlineInputBorder(),
                          ),
                          items: const [
                            DropdownMenuItem(
                              value: 'Bekar',
                              child: Text('Bekar'),
                            ),
                            DropdownMenuItem(
                              value: 'Evli',
                              child: Text('Evli'),
                            ),
                          ],
                          onChanged: (value) => setState(
                            () => _maritalStatus = value ?? _maritalStatus,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _field(
                          controller: _childCountController,
                          label: 'Çocuk Sayisi',
                          keyboardType: TextInputType.number,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _field(
                    controller: _noteController,
                    label: 'Finans Notu',
                    maxLines: 4,
                    required: false,
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF14532D).withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Kayıt Sonrasi Yetki Cevresi',
                          style: Theme.of(context).textTheme.bodyLarge
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 8),
                        const _InfoRow(
                          title: 'Panel',
                          value: 'Muhasebe modülu aktif olur',
                        ),
                        const _InfoRow(
                          title: 'Mesajlaşma',
                          value: 'Yönetici ve veli ile iletişim',
                        ),
                        const _InfoRow(
                          title: 'Onay Yetkisi',
                          value: 'Verilmez, sadece takip eder',
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  FilledButton.icon(
                    onPressed: _saving ? null : _submit,
                    icon: _saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.person_add_alt_1_rounded),
                    label: Text(
                      _saving
                          ? 'Kayıt Oluşturuluyor'
                          : 'Muhasebe Kaydini Tamamla',
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _saving = true);
    try {
      final credentials = await RegistrationApiService.instance
          .createAccounting(
            fullName: _nameController.text.trim(),
            tcNo: _tcController.text.trim(),
            phone: _phoneController.text.trim(),
            email: _emailController.text.trim(),
            education: _educationController.text.trim(),
            startDate: _startDateController.text.trim(),
            campus: _campusController.text.trim(),
            maritalStatus: _maritalStatus,
            childCount: int.tryParse(_childCountController.text.trim()) ?? 0,
            note: _noteController.text.trim(),
          );
      if (!mounted) return;
      setState(() => _saving = false);

      await showDialog<void>(
        context: context,
        builder: (dialogContext) => Dialog(
          insetPadding: const EdgeInsets.symmetric(
            horizontal: 28,
            vertical: 24,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28),
          ),
          child: Padding(
            padding: const EdgeInsets.all(24),
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
                  child: const Icon(
                    Icons.verified_user_outlined,
                    color: Color(0xFF14532D),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Muhasebe hesabı oluşturuldu',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 8),
                Text(
                  '${_nameController.text.trim()} için finans paneli erişimi hazır. Aşağıdaki giriş bilgileriyle sisteme giriş yapabilir.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(height: 1.45),
                ),
                const SizedBox(height: 16),
                _credentialTile(context, 'Kullanıcı Adı', credentials.username),
                const SizedBox(height: 10),
                _credentialTile(context, 'Geçiçi Şifre', credentials.password),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () {
                          Clipboard.setData(
                            ClipboardData(
                              text:
                                  'Kullanıcı Adı: ${credentials.username}\nŞifre: ${credentials.password}',
                            ),
                          );
                          Navigator.of(dialogContext).pop();
                        },
                        child: const Text('Bilgileri Kopyala'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () => Navigator.of(dialogContext).pop(),
                        child: const Text('Tamam'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
    } on RegistrationApiException catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Widget _credentialTile(BuildContext context, String label, String value) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(
          context,
        ).scaffoldBackgroundColor.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }

  Widget _field({
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
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
      inputFormatters: keyboardType == TextInputType.number
          ? [FilteringTextInputFormatter.digitsOnly]
          : null,
      validator: required
          ? (value) {
              if (value == null || value.trim().isEmpty) {
                return '$label zorunlu';
              }
              return null;
            }
          : null,
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String title;
  final String value;

  const _InfoRow({required this.title, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(height: 1.45),
            ),
          ),
        ],
      ),
    );
  }
}
