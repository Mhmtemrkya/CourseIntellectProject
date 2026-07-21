import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../i18n/app_locale.dart';
import '../services/api_config.dart';
import '../services/driving_school_api_service.dart';
import '../services/uploads_api_service.dart';
import '../widgets/driving_ui.dart';

/// Sürücü kursu kursiyer kaydı (mobil). Masaüstü sihirbazının çekirdek alanlarını
/// tek ekranda toplar: kimlik, paket, uygunluk, anlık fotoğraf ve finans (peşinat
/// ödendi/ödenmedi durumu dâhil). Kayıt `/api/driving-school/students/wizard`.
class DrivingStudentRegistrationPage extends StatefulWidget {
  const DrivingStudentRegistrationPage({super.key});

  @override
  State<DrivingStudentRegistrationPage> createState() =>
      _DrivingStudentRegistrationPageState();
}

class _DrivingStudentRegistrationPageState
    extends State<DrivingStudentRegistrationPage> {
  final _service = DrivingSchoolApiService.instance;
  final _formKey = GlobalKey<FormState>();

  final _fullName = TextEditingController();
  final _identityNumber = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _note = TextEditingController();
  final _gross = TextEditingController();
  final _discount = TextEditingController();
  final _downPayment = TextEditingController();
  final _installmentCount = TextEditingController();

  int _identityKind = 1; // 1=T.C. 2=Yabancı 3=Pasaport
  int _drivingExperience = 1; // 1=Hiç yok 2=Biraz 3=Deneyimli
  DateTime? _birthDate;
  bool _availableWeekdays = true;
  bool _availableWeekend = false;
  bool _kvkkConsent = false;
  bool _communicationConsent = false;
  String _downPaymentMethod = 'Nakit';
  bool _downPaymentPaid = true;

  List<Map<String, dynamic>> _packages = [];
  String? _packageId;
  bool _loadingPackages = true;

  String? _livePhotoUrl;
  bool _uploadingPhoto = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _loadPackages();
  }

  @override
  void dispose() {
    _fullName.dispose();
    _identityNumber.dispose();
    _phone.dispose();
    _email.dispose();
    _note.dispose();
    _gross.dispose();
    _discount.dispose();
    _downPayment.dispose();
    _installmentCount.dispose();
    super.dispose();
  }

  Future<void> _loadPackages() async {
    try {
      final packages = await _service.packages();
      if (!mounted) return;
      setState(() {
        _packages = packages;
        _loadingPackages = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingPackages = false);
    }
  }

  Future<void> _capturePhoto() async {
    final picker = ImagePicker();
    final shot = await picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      maxWidth: 900,
      imageQuality: 85,
    );
    if (shot == null) return;
    setState(() => _uploadingPhoto = true);
    try {
      final bytes = await shot.readAsBytes();
      final uploaded = await UploadsApiService.instance.uploadBytes(
        bytes: bytes,
        fileName: 'webcam-${DateTime.now().millisecondsSinceEpoch}.jpg',
        folder: 'driving-student-photos',
        contentType: 'image/jpeg',
      );
      if (mounted) setState(() => _livePhotoUrl = uploaded.fileUrl);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${'Fotoğraf yüklenemedi'.tr}: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthDate ?? DateTime(now.year - 18),
      firstDate: DateTime(now.year - 100),
      lastDate: DateTime(now.year - 16, now.month, now.day),
      helpText: 'Doğum tarihi'.tr,
    );
    if (picked != null) setState(() => _birthDate = picked);
  }

  String? _validate() {
    if (_fullName.text.trim().length < 3) return 'Ad soyad zorunludur.'.tr;
    if (_identityNumber.text.trim().isEmpty) {
      return 'Kimlik numarası zorunludur.'.tr;
    }
    if (_identityKind == 1 && _identityNumber.text.trim().length != 11) {
      return 'TC kimlik numarası 11 haneli olmalıdır.'.tr;
    }
    if (_birthDate == null) return 'Doğum tarihi zorunludur.'.tr;
    if (_packageId == null) return 'Paket seçimi zorunludur.'.tr;
    if (!_availableWeekdays && !_availableWeekend) {
      return 'En az bir zaman uygunluğu seçilmelidir.'.tr;
    }
    if (!_kvkkConsent) return 'KVKK onayı zorunludur.'.tr;
    final gross = double.tryParse(_gross.text.trim()) ?? 0;
    final discount = double.tryParse(_discount.text.trim()) ?? 0;
    final down = double.tryParse(_downPayment.text.trim()) ?? 0;
    if (gross > 0) {
      if (discount > gross) return 'İndirim, brüt tutardan büyük olamaz.'.tr;
      if (down > gross - discount) {
        return 'Peşinat, net tutardan büyük olamaz.'.tr;
      }
    }
    return null;
  }

  Future<void> _submit() async {
    final error = _validate();
    if (error != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error)));
      return;
    }
    setState(() => _submitting = true);
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);

    final gross = double.tryParse(_gross.text.trim()) ?? 0;
    Map<String, dynamic>? finance;
    if (gross > 0) {
      final down = double.tryParse(_downPayment.text.trim()) ?? 0;
      finance = {
        'grossAmount': gross,
        'discountAmount': double.tryParse(_discount.text.trim()) ?? 0,
        'discountReason': null,
        'downPayment': down,
        'installmentCount': int.tryParse(_installmentCount.text.trim()) ?? 0,
        'firstInstallmentDate': null,
        'downPaymentMethod': _downPaymentMethod,
        // Peşinat girildiyse ödendi/ödenmedi; yoksa anlamsız (true).
        'downPaymentPaid': down > 0 ? _downPaymentPaid : true,
      };
    }

    final body = <String, dynamic>{
      'fullName': _fullName.text.trim(),
      'identityKind': _identityKind,
      'identityNumber': _identityNumber.text.trim(),
      'nationality': 'T.C.',
      'birthDate':
          '${_birthDate!.year.toString().padLeft(4, '0')}-${_birthDate!.month.toString().padLeft(2, '0')}-${_birthDate!.day.toString().padLeft(2, '0')}',
      'phone': _phone.text.trim().isEmpty ? null : _phone.text.trim(),
      'email': _email.text.trim().isEmpty ? null : _email.text.trim(),
      'hasExistingLicense': false,
      'theoryExamFee': 0,
      'drivingExamFee': 0,
      'theoryExamFeePaid': false,
      'drivingExamFeePaid': false,
      'packageId': _packageId,
      'drivingExperience': _drivingExperience,
      'availableWeekdays': _availableWeekdays,
      'availableWeekend': _availableWeekend,
      'prefersMorning': false,
      'prefersMidday': false,
      'prefersEvening': false,
      'kvkkConsent': _kvkkConsent,
      'communicationConsent': _communicationConsent,
      'livePhotoUrl': _livePhotoUrl,
      'note': _note.text.trim().isEmpty ? null : _note.text.trim(),
      'finance': finance,
      'documents': const <Map<String, dynamic>>[],
    };

    try {
      final result = await _service.registerDrivingStudent(body);
      if (!mounted) return;
      final creds = result['credentials'] as Map?;
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text('Kursiyer kaydedildi'.tr),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_fullName.text.trim(),
                  style: const TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              if (creds != null) ...[
                Text('${'Kullanıcı adı'.tr}: ${creds['username'] ?? '-'}'),
                Text('${'Geçici şifre'.tr}: ${creds['password'] ?? '-'}'),
              ],
              if (finance != null && !(_downPaymentPaid) &&
                  (double.tryParse(_downPayment.text.trim()) ?? 0) > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'Peşinat “bekliyor” olarak işaretlendi; Ödeme Al ekranından tahsil edebilirsiniz.'.tr,
                    style: const TextStyle(fontSize: 12, color: Colors.orange),
                  ),
                ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text('Tamam'.tr),
            ),
          ],
        ),
      );
      navigator.pop(true);
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DrivingScaffold(
      appBar: AppBar(title: Text('Yeni Kursiyer'.tr)),
      child: _loadingPackages
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _section('Kimlik'.tr),
                  TextFormField(
                    controller: _fullName,
                    decoration: _dec('Ad soyad *'.tr),
                    textCapitalization: TextCapitalization.words,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<int>(
                    initialValue: _identityKind,
                    decoration: _dec('Kimlik türü'.tr),
                    items: [
                      DropdownMenuItem(value: 1, child: Text('T.C. Kimlik'.tr)),
                      DropdownMenuItem(value: 2, child: Text('Yabancı Kimlik'.tr)),
                      DropdownMenuItem(value: 3, child: Text('Pasaport'.tr)),
                    ],
                    onChanged: (v) => setState(() => _identityKind = v ?? 1),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _identityNumber,
                    decoration: _dec('Kimlik / Pasaport numarası *'.tr),
                    keyboardType: _identityKind == 1
                        ? TextInputType.number
                        : TextInputType.text,
                    inputFormatters: _identityKind == 1
                        ? [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(11),
                          ]
                        : null,
                  ),
                  const SizedBox(height: 12),
                  InkWell(
                    onTap: _pickBirthDate,
                    child: InputDecorator(
                      decoration: _dec('Doğum tarihi *'.tr),
                      child: Text(
                        _birthDate == null
                            ? 'Seçiniz'.tr
                            : '${_birthDate!.day.toString().padLeft(2, '0')}.${_birthDate!.month.toString().padLeft(2, '0')}.${_birthDate!.year}',
                        style: TextStyle(
                          color: _birthDate == null ? Colors.grey : null,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _phone,
                          decoration: _dec('Telefon'.tr),
                          keyboardType: TextInputType.phone,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextFormField(
                          controller: _email,
                          decoration: _dec('E-posta'.tr),
                          keyboardType: TextInputType.emailAddress,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  _section('Anlık fotoğraf (kamera)'.tr),
                  Row(
                    children: [
                      if (_livePhotoUrl != null)
                        Padding(
                          padding: const EdgeInsets.only(right: 12),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.network(
                              '${ApiConfig.baseUrl}$_livePhotoUrl',
                              width: 72,
                              height: 72,
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stack) =>
                                  const SizedBox(
                                width: 72,
                                height: 72,
                                child: Icon(Icons.person),
                              ),
                            ),
                          ),
                        ),
                      OutlinedButton.icon(
                        onPressed: _uploadingPhoto ? null : _capturePhoto,
                        icon: _uploadingPhoto
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Icon(Icons.camera_alt_rounded),
                        label: Text(
                          _livePhotoUrl == null
                              ? 'Fotoğraf çek'.tr
                              : 'Yeniden çek'.tr,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  _section('Paket ve uygunluk'.tr),
                  DropdownButtonFormField<String>(
                    initialValue: _packageId,
                    isExpanded: true,
                    decoration: _dec('Paket *'.tr),
                    items: _packages
                        .map((p) => DropdownMenuItem(
                              value: '${p['id']}',
                              child: Text(
                                '${p['name']} ${p['price'] != null ? '• ₺${p['price']}' : ''}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ))
                        .toList(),
                    onChanged: (v) => setState(() => _packageId = v),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<int>(
                    initialValue: _drivingExperience,
                    decoration: _dec('Sürüş deneyimi'.tr),
                    items: [
                      DropdownMenuItem(value: 1, child: Text('Hiç yok'.tr)),
                      DropdownMenuItem(value: 2, child: Text('Biraz var'.tr)),
                      DropdownMenuItem(value: 3, child: Text('Deneyimli'.tr)),
                    ],
                    onChanged: (v) =>
                        setState(() => _drivingExperience = v ?? 1),
                  ),
                  const SizedBox(height: 6),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _availableWeekdays,
                    onChanged: (v) =>
                        setState(() => _availableWeekdays = v ?? false),
                    title: Text('Hafta içi uygun'.tr),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _availableWeekend,
                    onChanged: (v) =>
                        setState(() => _availableWeekend = v ?? false),
                    title: Text('Hafta sonu uygun'.tr),
                  ),
                  const SizedBox(height: 20),
                  _section('Finans (opsiyonel)'.tr),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _gross,
                          decoration: _dec('Brüt (₺)'.tr),
                          keyboardType: TextInputType.number,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextFormField(
                          controller: _discount,
                          decoration: _dec('İndirim (₺)'.tr),
                          keyboardType: TextInputType.number,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _downPayment,
                          decoration: _dec('Peşinat (₺)'.tr),
                          keyboardType: TextInputType.number,
                          onChanged: (_) => setState(() {}),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextFormField(
                          controller: _installmentCount,
                          decoration: _dec('Taksit sayısı'.tr),
                          keyboardType: TextInputType.number,
                        ),
                      ),
                    ],
                  ),
                  if ((double.tryParse(_downPayment.text.trim()) ?? 0) > 0) ...[
                    const SizedBox(height: 12),
                    Text('Peşinat Durumu'.tr,
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 13)),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Expanded(
                          child: _statusButton(
                            label: 'Ödendi'.tr,
                            icon: Icons.check_circle,
                            color: Colors.green,
                            selected: _downPaymentPaid,
                            onTap: () => setState(() => _downPaymentPaid = true),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: _statusButton(
                            label: 'Ödenmedi'.tr,
                            icon: Icons.cancel,
                            color: Colors.red,
                            selected: !_downPaymentPaid,
                            onTap: () =>
                                setState(() => _downPaymentPaid = false),
                          ),
                        ),
                      ],
                    ),
                    if (_downPaymentPaid) ...[
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        initialValue: _downPaymentMethod,
                        decoration: _dec('Peşinat yöntemi'.tr),
                        items: const [
                          DropdownMenuItem(
                              value: 'Nakit', child: Text('Nakit')),
                          DropdownMenuItem(
                              value: 'Kart', child: Text('Kart / POS')),
                          DropdownMenuItem(
                              value: 'Havale', child: Text('Havale / EFT')),
                        ],
                        onChanged: (v) =>
                            setState(() => _downPaymentMethod = v ?? 'Nakit'),
                      ),
                    ] else
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'Tahsil edilmedi; “Peşinat Bekleyenler” listesinde görünür.'.tr,
                          style:
                              TextStyle(fontSize: 11, color: Colors.grey.shade600),
                        ),
                      ),
                  ],
                  const SizedBox(height: 20),
                  _section('Onaylar'.tr),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _kvkkConsent,
                    onChanged: (v) => setState(() => _kvkkConsent = v ?? false),
                    title: Text('KVKK aydınlatma onayı *'.tr),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _communicationConsent,
                    onChanged: (v) =>
                        setState(() => _communicationConsent = v ?? false),
                    title: Text('İletişim (SMS/arama) izni'.tr),
                  ),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: _submitting ? null : _submit,
                    icon: _submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.save_rounded),
                    label: Text('Kursiyeri Kaydet'.tr),
                  ),
                  const SizedBox(height: 40),
                ],
              ),
            ),
    );
  }

  Widget _section(String title) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(title,
            style:
                const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
      );

  InputDecoration _dec(String label) => InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
        isDense: true,
      );

  Widget _statusButton({
    required String label,
    required IconData icon,
    required Color color,
    required bool selected,
    required VoidCallback onTap,
  }) =>
      InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected ? color : Colors.grey.shade300,
              width: selected ? 1.5 : 1,
            ),
            color: selected ? color.withValues(alpha: 0.10) : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 18, color: selected ? color : Colors.grey.shade500),
              const SizedBox(width: 6),
              Text(label,
                  style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: selected ? color : Colors.grey.shade600)),
            ],
          ),
        ),
      );
}
