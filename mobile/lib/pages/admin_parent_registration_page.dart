import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/auth_session_store.dart';
import '../services/credentials_pdf_service.dart';
import '../services/registration_api_service.dart';
import '../widgets/admin_ui.dart';

class AdminParentRegistrationPage extends StatefulWidget {
  const AdminParentRegistrationPage({super.key});

  @override
  State<AdminParentRegistrationPage> createState() =>
      _AdminParentRegistrationPageState();
}

class _AdminParentRegistrationPageState
    extends State<AdminParentRegistrationPage> {
  final _formKey = GlobalKey<FormState>();
  final _parentNameController = TextEditingController();
  final _parentPhoneController = TextEditingController();
  final _parentEmailController = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _parentNameController.dispose();
    _parentPhoneController.dispose();
    _parentEmailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _saving = true);
    try {
      final parentCreds = await RegistrationApiService.instance.createParent(
        fullName: _parentNameController.text.trim(),
        phone: _parentPhoneController.text.trim(),
        email: _parentEmailController.text.trim(),
      );
      if (!mounted) return;
      setState(() => _saving = false);
      await _showSuccessCard(parentCreds);
    } on RegistrationApiException catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
  }

  Future<void> _showSuccessCard(GeneratedCredentials creds) async {
    return showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        title: const Text('Veli kaydı oluşturuldu'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Bilgiler PDF olarak indirilebilir. İlk girişte şifre değişimi zorunludur.',
                style: TextStyle(fontSize: 13),
              ),
              const SizedBox(height: 14),
              _credentialBlock(
                label: 'Ad Soyad',
                value: creds.fullName.isNotEmpty
                    ? creds.fullName
                    : _parentNameController.text.trim(),
                bold: true,
              ),
              const SizedBox(height: 8),
              _credentialBlock(label: 'Kullanıcı Adı', value: creds.username),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.amber.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Geçici Şifre',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.amber.shade900,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    SelectableText(
                      creds.password,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                        letterSpacing: 1.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'İlk girişte değiştirilmesi zorunludur.',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.amber.shade900,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  icon: const Icon(Icons.picture_as_pdf_outlined),
                  label: const Text('PDF Olarak İndir / Paylaş'),
                  onPressed: () async {
                    final session = await AuthSessionStore.instance.load();
                    await CredentialsPdfService.generateAndShare(
                      tenantName: session?.tenantName ?? '',
                      fullName: creds.fullName.isNotEmpty
                          ? creds.fullName
                          : _parentNameController.text.trim(),
                      role: 'Veli',
                      username: creds.username,
                      temporaryPassword: creds.password,
                    );
                  },
                ),
              ),
              const SizedBox(height: 6),
              SizedBox(
                width: double.infinity,
                child: TextButton.icon(
                  icon: const Icon(Icons.copy_all_rounded),
                  label: const Text('Kopyala'),
                  onPressed: () async {
                    await Clipboard.setData(
                      ClipboardData(
                        text:
                            'Kullanıcı Adı: ${creds.username}\nGeçici Şifre: ${creds.password}',
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        actions: [
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              _parentNameController.clear();
              _parentPhoneController.clear();
              _parentEmailController.clear();
            },
            child: const Text('Tamam'),
          ),
        ],
      ),
    );
  }

  Widget _credentialBlock({
    required String label,
    required String value,
    bool bold = false,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 11, color: Colors.grey),
          ),
          const SizedBox(height: 2),
          SelectableText(
            value,
            style: TextStyle(
              fontFamily: bold ? null : 'monospace',
              fontWeight: FontWeight.w700,
              fontSize: bold ? 14 : 13,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildField({
    required TextEditingController controller,
    required String label,
    TextInputType? keyboardType,
    bool required = true,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      validator: required
          ? (value) {
              if (value == null || value.trim().isEmpty) {
                return '$label alanı zorunludur';
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

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Bağımsız Veli Kaydı',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const AdminHeroCard(
              eyebrow: 'Bağımsız veli kaydı',
              title: 'Öğrencisi henüz sistemde olmayan veliler için ayrı kayıt.',
              description:
                  'Yeni öğrenci kaydı yapacaksanız Öğrenciler sayfasını kullanın — orada veli bilgisi de doldurulduğunda veli hesabı otomatik oluşur.',
              colors: [Color(0xFF7C3AED), Color(0xFFC026D3)],
              metrics: [
                AdminHeroMetric(label: 'Çıktı', value: 'Otomatik Hesap'),
                AdminHeroMetric(label: 'PDF', value: 'Logo + Uyarı'),
              ],
            ),
            const SizedBox(height: 16),
            AdminPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const AdminSectionTitle(title: 'Veli Bilgileri'),
                  const SizedBox(height: 12),
                  _buildField(
                    controller: _parentNameController,
                    label: 'Veli Ad Soyad',
                  ),
                  const SizedBox(height: 12),
                  _buildField(
                    controller: _parentPhoneController,
                    label: 'Telefon',
                    keyboardType: TextInputType.phone,
                    required: false,
                  ),
                  const SizedBox(height: 12),
                  _buildField(
                    controller: _parentEmailController,
                    label: 'E-posta',
                    keyboardType: TextInputType.emailAddress,
                    required: false,
                  ),
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.blue.shade200),
                    ),
                    child: Text(
                      'Kayıt sonrası kurum domain\'inizi kullanan bir kullanıcı adı ve geçici şifre otomatik üretilir. Veli ilk girişinde şifresini değiştirmek zorundadır.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.blue.shade900,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: _saving ? null : _submit,
                      child: _saving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Veli Kaydını Oluştur'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
