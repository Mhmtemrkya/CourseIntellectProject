import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../utils/input_formatters.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/administrative_notice_store.dart';
import '../services/admin_directory_api_service.dart';
import '../services/admin_workflow_api_service.dart';
import '../services/announcement_store.dart';
import '../services/auth_session_store.dart';
import '../services/credentials_pdf_service.dart';
import '../services/registration_api_service.dart';
import '../widgets/admin_ui.dart';

class AdminStudentRegistrationPage extends StatefulWidget {
  const AdminStudentRegistrationPage({super.key});

  @override
  State<AdminStudentRegistrationPage> createState() =>
      _AdminStudentRegistrationPageState();
}

class _AdminStudentRegistrationPageState
    extends State<AdminStudentRegistrationPage> {
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
  final _academicYearController = TextEditingController();
  final _grossAmountController = TextEditingController();
  final _discountAmountController = TextEditingController();
  final _discountReasonController = TextEditingController();
  final _downPaymentController = TextEditingController();
  final _installmentCountController = TextEditingController();

  String _programType = 'Lise';
  String _downPaymentMethod = 'Nakit';
  // Peşinat kayıtta tahsil edildi mi? false → makbuz kesilmez, "bekliyor" olur.
  bool _downPaymentPaid = true;
  List<String> _classOptions = const [];
  List<Map<String, dynamic>> _branches = const [];
  String? _branchId;
  bool _saving = false;

  List<AdminStudentRecord> _allStudents = const [];
  List<AdminStaffRecord> _allStaff = const [];
  String? _rosterClass;

  @override
  void initState() {
    super.initState();
    _loadClassOptions();
    _loadTenantName();
    _loadBranches();
    _loadRoster();
  }

  Future<void> _loadRoster() async {
    final results = await Future.wait([
      AdminDirectoryApiService.instance.fetchStudents().catchError((_) => <AdminStudentRecord>[]),
      AdminDirectoryApiService.instance.fetchStaff().catchError((_) => <AdminStaffRecord>[]),
    ]);
    if (!mounted) return;
    setState(() {
      _allStudents = results[0] as List<AdminStudentRecord>;
      _allStaff = results[1] as List<AdminStaffRecord>;
    });
  }

  Future<void> _loadBranches() async {
    try {
      final units = await AdminWorkflowApiService.instance.getOrgUnits();
      // Pasif birimler seçim listesinde görünmez.
      final activeUnits = units.where((u) => u['isActive'] != false).toList();
      final branchUnits = activeUnits.where((u) {
        final t = (u['unitType'] as String? ?? '').toLowerCase();
        return t == 'şube' || t == 'sube' || t == 'kampüs' || t == 'kampus';
      }).toList();
      if (!mounted) return;
      setState(() => _branches = branchUnits.isNotEmpty ? branchUnits : activeUnits);
    } catch (_) {
      /* şube yoksa alan gizli kalır */
    }
  }

  Future<void> _loadTenantName() async {
    final session = await AuthSessionStore.instance.load();
    if (!mounted) return;
    final tenantName = session?.tenantName ?? '';
    if (tenantName.isNotEmpty) {
      setState(() {
        _schoolController.text = tenantName;
      });
    }
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
    _academicYearController.dispose();
    _grossAmountController.dispose();
    _discountAmountController.dispose();
    _discountReasonController.dispose();
    _downPaymentController.dispose();
    _installmentCountController.dispose();
    super.dispose();
  }

  Future<void> _loadClassOptions() async {
    final classes = await AdminDirectoryApiService.instance.fetchClasses();
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
        title: Text(
          'Yeni Öğrenci Kaydı'.tr,
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            AdminHeroCard(
              eyebrow: 'Kayıt merkezi',
              title:
                  'Öğrenci kaydını idari standartlara uygun şekilde tamamlayın.'.tr,
              description:
                  'Kayıt sonrası öğrenci için sistem kullanıcı adı ve şifre otomatik üretilir; veli bilgileri ve program alanı aynı akışta tamamlanır.',
              colors: [Color(0xFF0F172A), Color(0xFF0F766E)],
              metrics: [
                AdminHeroMetric(label: 'Alan', value: 'Tüm Kayıt'),
                AdminHeroMetric(label: 'Çıktı'.tr, value: 'Otomatik Giriş'),
              ],
            ),
            const SizedBox(height: 16),
            AdminPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AdminSectionTitle(title: 'Öğrenci Bilgileri'.tr),
                  const SizedBox(height: 12),
                  _buildField(
                    controller: _fullNameController,
                    label: 'Ad Soyad',
                  ),
                  const SizedBox(height: 12),
                  _buildField(
                    controller: _tcController,
                    label: 'TC Kimlik No',
                    keyboardType: TextInputType.number,
                    maxLength: 11,
                    inputFormatters: AppInputFormatters.tcKimlik(),
                    validator: AppInputFormatters.validateTcKimlik,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          key: ValueKey(
                            'student-class-${_classController.text.trim()}-${_classOptions.length}',
                          ),
                          initialValue: _classController.text.trim().isEmpty
                              ? null
                              : _classController.text.trim(),
                          decoration: InputDecoration(
                            labelText: 'Sınıf'.tr,
                            border: OutlineInputBorder(),
                          ),
                          items: _classOptions
                              .map(
                                (item) => DropdownMenuItem(
                                  value: item,
                                  child: Text(item),
                                ),
                              )
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
                  _buildField(
                    controller: _schoolController,
                    label: 'Mevcut Okul',
                    readOnly: true,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _buildField(
                          controller: _birthDateController,
                          label: 'Doğum Tarihi'.tr,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _programType,
                          decoration: InputDecoration(
                            labelText: 'Eğitim Seviyesi'.tr,
                            border: OutlineInputBorder(),
                          ),
                          items: [
                            DropdownMenuItem(
                              value: 'Ilkokul',
                              child: Text('İlkokul'.tr),
                            ),
                            DropdownMenuItem(
                              value: 'Ortaokul',
                              child: Text('Ortaokul'),
                            ),
                            DropdownMenuItem(
                              value: 'Lise',
                              child: Text('Lise'),
                            ),
                            DropdownMenuItem(
                              value: 'Universite',
                              child: Text('Üniversite'.tr),
                            ),
                            DropdownMenuItem(
                              value: 'Mezun',
                              child: Text('Mezun'),
                            ),
                          ],
                          onChanged: (value) => setState(
                            () => _programType = value ?? _programType,
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (_branches.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _branchId,
                      decoration: InputDecoration(
                        labelText: 'Şube'.tr,
                        border: OutlineInputBorder(),
                      ),
                      hint: Text('Şube seçin'.tr),
                      items: _branches
                          .map((b) => DropdownMenuItem(
                                value: b['id'] as String?,
                                child: Text((b['name'] as String?) ?? ''),
                              ))
                          .toList(),
                      onChanged: (value) => setState(() => _branchId = value),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            AdminPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AdminSectionTitle(title: 'Veli ve İletişim Bilgileri'.tr),
                  const SizedBox(height: 12),
                  _buildField(
                    controller: _parentNameController,
                    label: 'Veli Ad Soyad',
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _buildField(
                          controller: _parentPhoneController,
                          label: 'Veli Telefon',
                          keyboardType: TextInputType.phone,
                          inputFormatters: AppInputFormatters.phone(),
                          prefixText: '+90 ',
                          validator: AppInputFormatters.validatePhone,
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
                    label: 'Kayıt Notu'.tr,
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
                  AdminSectionTitle(title: 'Kayıt Ücreti & Taksit Planı'.tr),
                  const SizedBox(height: 6),
                  Text(
                    'Tutar girilirse kayıtta otomatik sözleşme ve taksit planı oluşturulur. Boş bırakılırsa finans kaydı oluşturulmaz.'.tr,
                    style: TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const SizedBox(height: 12),
                  _buildField(
                    controller: _grossAmountController,
                    label: 'Toplam Ücret (₺)'.tr,
                    required: false,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _buildField(
                          controller: _discountAmountController,
                          label: 'İndirim (₺)'.tr,
                          required: false,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildField(
                          controller: _discountReasonController,
                          label: 'İndirim Sebebi'.tr,
                          required: false,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _buildField(
                          controller: _downPaymentController,
                          label: 'Peşinat (₺)'.tr,
                          required: false,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildField(
                          controller: _installmentCountController,
                          label: 'Taksit Sayısı'.tr,
                          required: false,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: _downPaymentMethod,
                    decoration: InputDecoration(
                      labelText: 'Peşinat Ödeme Yöntemi'.tr,
                      border: OutlineInputBorder(),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'Nakit', child: Text('Nakit')),
                      DropdownMenuItem(value: 'Kart', child: Text('Kart / POS')),
                      DropdownMenuItem(
                        value: 'Havale',
                        child: Text('Havale / EFT'),
                      ),
                    ],
                    onChanged: (value) =>
                        setState(() => _downPaymentMethod = value ?? 'Nakit'),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Peşinat Durumu'.tr,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: _DownPaymentStatusButton(
                          label: 'Ödendi'.tr,
                          icon: Icons.check_circle,
                          color: Colors.green,
                          selected: _downPaymentPaid,
                          onTap: () => setState(() => _downPaymentPaid = true),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _DownPaymentStatusButton(
                          label: 'Ödenmedi'.tr,
                          icon: Icons.cancel,
                          color: Colors.red,
                          selected: !_downPaymentPaid,
                          onTap: () => setState(() => _downPaymentPaid = false),
                        ),
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      _downPaymentPaid
                          ? 'Kayıtta tahsil edildi; makbuz kesilir.'.tr
                          : 'Tahsil edilmedi; “Peşinat Bekleyenler” listesinde görünür.'.tr,
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _buildField(
                    controller: _academicYearController,
                    label: 'Akademik Yıl (örn: 2025-2026)'.tr,
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
                  AdminSectionTitle(title: 'Önizleme ve Ek Kontroller'.tr),
                  const SizedBox(height: 12),
                  _previewTile('Kayıt Tipi', 'Kurumsal tam kayıt'),
                  _previewTile(
                    'Veli Bilgilendirme',
                    'Kullanıcı adı ve şifre otomatik paylaşıma hazır',
                  ),
                  _previewTile(
                    'Öğrenci Durumu',
                    'Kayıt sonrası aktif kullanıcı olarak oluşur',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _classRosterPanel(context),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _saving ? null : () => Navigator.pop(context),
                    child: Text('Vazgeç'.tr),
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
                    label: Text(_saving ? 'Kaydediliyor' : 'Kaydı Tamamla'),
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
    bool readOnly = false,
    List<TextInputFormatter>? inputFormatters,
    String? prefixText,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      maxLength: maxLength,
      readOnly: readOnly,
      inputFormatters: inputFormatters,
      validator:
          validator ??
          (required && !readOnly
              ? (value) {
                  if (value == null || value.trim().isEmpty) {
                    return '$label alanı zorunludur';
                  }
                  return null;
                }
              : null),
      decoration: InputDecoration(
        labelText: label,
        prefixText: prefixText,
        border: const OutlineInputBorder(),
        filled: readOnly,
      ),
    );
  }

  Widget _classRosterPanel(BuildContext context) {
    final selectedClass = _rosterClass ?? (_classOptions.isNotEmpty ? _classOptions.first : null);
    final roster = selectedClass == null
        ? const <AdminStudentRecord>[]
        : _allStudents.where((s) => s.className == selectedClass).toList();
    final homeroom = selectedClass == null
        ? null
        : _allStaff.where((t) => t.homeroomClass == selectedClass).cast<AdminStaffRecord?>().firstWhere((_) => true, orElse: () => null);

    return AdminPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AdminSectionTitle(title: 'Sınıf Mevcudu'.tr),
          const SizedBox(height: 12),
          if (_classOptions.isEmpty)
            Text('Sınıf listesi yüklenemedi.'.tr)
          else
            DropdownButtonFormField<String>(
              initialValue: selectedClass,
              decoration: InputDecoration(labelText: 'Sınıf'.tr, border: OutlineInputBorder()),
              items: _classOptions.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
              onChanged: (v) => setState(() => _rosterClass = v),
            ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _rosterStat('Öğrenci Sayısı', '${roster.length}'),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _rosterStat('Sınıf Öğretmeni', homeroom?.fullName ?? 'Atanmadı'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (roster.isEmpty)
            Text('Bu sınıfta kayıtlı öğrenci yok.'.tr)
          else
            ...roster.map(
              (s) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 16,
                      backgroundColor: const Color(0xFF2563EB).withValues(alpha: 0.12),
                      child: Text(
                        s.fullName.isEmpty ? '?' : s.fullName.characters.first,
                        style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w800, fontSize: 13),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: Text(s.fullName, style: const TextStyle(fontWeight: FontWeight.w600))),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _rosterStat(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w900)),
        ],
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
          Expanded(
            child: Text(
              title,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
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
        academicYear: _academicYearController.text.trim().isEmpty
            ? null
            : _academicYearController.text.trim(),
        enrollmentGrossAmount: double.tryParse(_grossAmountController.text.trim()),
        enrollmentDiscountAmount:
            double.tryParse(_discountAmountController.text.trim()),
        enrollmentDiscountReason: _discountReasonController.text.trim().isEmpty
            ? null
            : _discountReasonController.text.trim(),
        enrollmentDownPayment: double.tryParse(_downPaymentController.text.trim()),
        enrollmentDownPaymentMethod:
            _downPaymentController.text.trim().isEmpty ? null : _downPaymentMethod,
        // Peşinat girildiyse ödendi/ödenmedi; peşinat yoksa anlamsız (true).
        enrollmentDownPaymentPaid:
            _downPaymentController.text.trim().isEmpty ? true : _downPaymentPaid,
        enrollmentInstallmentCount:
            int.tryParse(_installmentCountController.text.trim()),
        branchId: (_branchId != null && _branchId!.isNotEmpty) ? _branchId : null,
      );
      await AnnouncementStore.instance.addAnnouncement(
        title: '${_fullNameController.text.trim()} kaydı tamamlandı',
        detail:
            '${_parentNameController.text.trim()} için hoş geldiniz ve giriş bilgisi bilgilendirmesi hazırlandı. Kullanıcı adı: ${credentials.username}',
        audience: 'Veli',
      );
      await AdministrativeNoticeStore.instance.addNotice(
        title: 'Yeni öğrenci kaydı tamamlandı'.tr,
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
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _showSuccessCard(GeneratedCredentials credentials) {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return Dialog(
          insetPadding: const EdgeInsets.symmetric(horizontal: 28),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28),
          ),
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
                  child: const Icon(
                    Icons.verified_rounded,
                    color: Color(0xFF14532D),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'Kayıt tamamlandı'.tr,
                  style: Theme.of(
                    dialogContext,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 8),
                Text(
                  'Öğrenci sisteme girebilir. Aşağıdaki giriş bilgileri otomatik oluşturuldu.'.tr,
                  style: Theme.of(
                    dialogContext,
                  ).textTheme.bodyMedium?.copyWith(height: 1.45),
                ),
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDBEAFE),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    'Veli için hoş geldiniz duyurusu ve idari bildirim kaydı otomatik oluşturuldu.'.tr,
                    style: TextStyle(
                      color: Color(0xFF1D4ED8),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                _buildCredentialBlock(
                  context: dialogContext,
                  badgeColor: const Color(0xFF1D4ED8),
                  badgeText: 'Öğrenci',
                  fullName: credentials.fullName.isNotEmpty
                      ? credentials.fullName
                      : _fullNameController.text.trim(),
                  username: credentials.username,
                  password: credentials.password,
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.picture_as_pdf_outlined),
                    label: Text('Öğrenci PDF\'i İndir / Paylaş'.tr),
                    onPressed: () async {
                      final session = await AuthSessionStore.instance.load();
                      await CredentialsPdfService.generateAndShare(
                        tenantName: session?.tenantName ?? '',
                        fullName: credentials.fullName.isNotEmpty
                            ? credentials.fullName
                            : _fullNameController.text.trim(),
                        role: 'Öğrenci',
                        username: credentials.username,
                        temporaryPassword: credentials.password,
                        className: _classController.text.trim(),
                      );
                    },
                  ),
                ),
                if (credentials.parent != null) ...[
                  const SizedBox(height: 16),
                  _buildCredentialBlock(
                    context: dialogContext,
                    badgeColor: const Color(0xFF047857),
                    badgeText: 'Veli',
                    fullName: credentials.parent!.fullName.isNotEmpty
                        ? credentials.parent!.fullName
                        : _parentNameController.text.trim(),
                    username: credentials.parent!.username,
                    password: credentials.parent!.password,
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.picture_as_pdf_outlined),
                      label: Text('Veli PDF\'i İndir / Paylaş'.tr),
                      onPressed: () async {
                        final session = await AuthSessionStore.instance.load();
                        final studentName = credentials.fullName.isNotEmpty
                            ? credentials.fullName
                            : _fullNameController.text.trim();
                        await CredentialsPdfService.generateAndShare(
                          tenantName: session?.tenantName ?? '',
                          fullName: credentials.parent!.fullName.isNotEmpty
                              ? credentials.parent!.fullName
                              : _parentNameController.text.trim(),
                          role: 'Veli',
                          username: credentials.parent!.username,
                          temporaryPassword: credentials.parent!.password,
                          extra:
                              'Velisi olduğu öğrenci: $studentName (${_classController.text.trim()})',
                        );
                      },
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.amber.shade200),
                  ),
                  child: Text(
                    'Tüm geçici şifreler ilk girişte zorunlu olarak değiştirilmelidir.'.tr,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.amber.shade900,
                      fontWeight: FontWeight.w600,
                    ),
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
                              text:
                                  'Kullanıcı Adı: ${credentials.username}\nŞifre: ${credentials.password}',
                            ),
                          );
                          if (!mounted) {
                            return;
                          }
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                'Giriş bilgileri panoya kopyalandı.'.tr,
                              ),
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

  Widget _buildCredentialBlock({
    required BuildContext context,
    required Color badgeColor,
    required String badgeText,
    required String fullName,
    required String username,
    required String password,
  }) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: badgeColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  badgeText,
                  style: TextStyle(
                    color: badgeColor,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  fullName,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'Kullanıcı Adı'.tr,
            style: TextStyle(fontSize: 11, color: Colors.grey),
          ),
          const SizedBox(height: 2),
          SelectableText(
            username,
            style: const TextStyle(
              fontFamily: 'monospace',
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Geçici Şifre'.tr,
            style: TextStyle(fontSize: 11, color: Colors.grey),
          ),
          const SizedBox(height: 2),
          SelectableText(
            password,
            style: const TextStyle(
              fontFamily: 'monospace',
              fontWeight: FontWeight.w800,
              fontSize: 16,
              letterSpacing: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _launchSms(GeneratedCredentials credentials) async {
    final phone = _parentPhoneController.text.trim();
    final body =
        'Merhaba ${_parentNameController.text.trim()}, ${_fullNameController.text.trim()} kaydı tamamlandı. Kullanıcı adı: ${credentials.username} Şifre: ${credentials.password}';
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
        'Merhaba ${_parentNameController.text.trim()}, ${_fullNameController.text.trim()} kaydı tamamlandı. Kullanıcı adı: ${credentials.username} Şifre: ${credentials.password}';
    final uri = Uri.parse(
      'https://wa.me/$phone?text=${Uri.encodeComponent(message)}',
    );
    await _launchExternal(uri);
  }

  Future<void> _launchExternal(Uri uri) async {
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication) &&
        mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Paylaşım uygulaması açılamadı.'.tr),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }
}

/// Peşinat ödendi/ödenmedi seçim düğmesi (tik / çarpı).
class _DownPaymentStatusButton extends StatelessWidget {
  const _DownPaymentStatusButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
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
            Icon(icon, size: 18, color: selected ? color : Colors.grey.shade500),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: selected ? color : Colors.grey.shade600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
