import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import 'package:flutter/services.dart';

import '../utils/input_formatters.dart';

import '../services/admin_directory_api_service.dart';
import '../services/admin_workflow_api_service.dart';
import '../services/auth_session_store.dart';
import '../services/credentials_pdf_service.dart';
import '../services/registration_api_service.dart';
import '../services/service_tracking_api_service.dart';
import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';
import '../widgets/responsive_layout.dart';

class AdminStaffRegistrationPage extends StatefulWidget {
  const AdminStaffRegistrationPage({super.key});

  @override
  State<AdminStaffRegistrationPage> createState() =>
      _AdminStaffRegistrationPageState();
}

class _AdminStaffRegistrationPageState extends State<AdminStaffRegistrationPage>
    with SingleTickerProviderStateMixin {
  final _teacherFormKey = GlobalKey<FormState>();
  final _personnelFormKey = GlobalKey<FormState>();

  late final TabController _tabController;

  final _teacherNameController = TextEditingController();
  final _teacherTcController = TextEditingController();
  final _teacherPhoneController = TextEditingController();
  final _teacherEducationController = TextEditingController();
  final _teacherStartDateController = TextEditingController();
  final _teacherCampusController = TextEditingController(text: 'Merkez Kampüs');
  final _teacherChildCountController = TextEditingController(text: '0');
  final _teacherNoteController = TextEditingController();

  final _personnelNameController = TextEditingController();
  final _personnelTcController = TextEditingController();
  final _personnelPhoneController = TextEditingController();
  final _personnelEmailController = TextEditingController();
  final _personnelEducationController = TextEditingController();
  final _personnelStartDateController = TextEditingController();
  final _personnelCampusController = TextEditingController(
    text: 'Merkez Kampüs',
  );
  final _personnelChildCountController = TextEditingController(text: '0');
  final _personnelNoteController = TextEditingController();
  final _driverLicenseController = TextEditingController();
  final _vehicleNumberController = TextEditingController();
  final _vehiclePlateController = TextEditingController();
  final _vehicleBrandController = TextEditingController();
  final _vehicleModelController = TextEditingController();
  final _vehicleCapacityController = TextEditingController(text: '15');
  final _routeNameController = TextEditingController();
  final _routeStartController = TextEditingController(text: '07:30');
  final _routeEndController = TextEditingController(text: '09:00');

  String _teacherBranch = 'Matematik';
  String _personnelRole = 'Administrative';
  String _personnelDepartment = 'Öğrenci Isleri';
  String _routeType = 'Morning';
  String _teacherHomeroomClass = 'Sınıf öğretmenliği yok';
  final Set<String> _teacherAssignedClasses = {};
  List<String> _classOptions = const [];
  List<Map<String, dynamic>> _branches = const [];
  List<AdminStaffRecord> _allStaff = const [];
  String _staffRoleFilter = 'Teacher';
  String? _branchId;
  String _teacherMaritalStatus = 'Bekar';
  String _personnelMaritalStatus = 'Bekar';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadClassOptions();
    _loadBranches();
    _loadStaff();
  }

  Future<void> _loadStaff() async {
    try {
      final staff = await AdminDirectoryApiService.instance.fetchStaff();
      if (!mounted) return;
      setState(() => _allStaff = staff);
    } catch (_) {
      /* personel listesi alınamadıysa panel boş kalır */
    }
  }

  Future<void> _loadBranches() async {
    try {
      final units = await AdminWorkflowApiService.instance.getOrgUnits();
      final branchUnits = units.where((u) {
        final t = (u['unitType'] as String? ?? '').toLowerCase();
        return t == 'şube' || t == 'sube' || t == 'kampüs' || t == 'kampus';
      }).toList();
      if (!mounted) return;
      setState(() => _branches = branchUnits.isNotEmpty ? branchUnits : units);
    } catch (_) {
      /* şube yoksa alan gizli kalır */
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _teacherNameController.dispose();
    _teacherTcController.dispose();
    _teacherPhoneController.dispose();
    _teacherEducationController.dispose();
    _teacherStartDateController.dispose();
    _teacherCampusController.dispose();
    _teacherChildCountController.dispose();
    _teacherNoteController.dispose();
    _personnelNameController.dispose();
    _personnelTcController.dispose();
    _personnelPhoneController.dispose();
    _personnelEmailController.dispose();
    _personnelEducationController.dispose();
    _personnelStartDateController.dispose();
    _personnelCampusController.dispose();
    _personnelChildCountController.dispose();
    _personnelNoteController.dispose();
    _driverLicenseController.dispose();
    _vehicleNumberController.dispose();
    _vehiclePlateController.dispose();
    _vehicleBrandController.dispose();
    _vehicleModelController.dispose();
    _vehicleCapacityController.dispose();
    _routeNameController.dispose();
    _routeStartController.dispose();
    _routeEndController.dispose();
    super.dispose();
  }

  Future<void> _loadClassOptions() async {
    await StudentRegistryStore.instance.ensureLoaded();
    final classes =
        StudentRegistryStore.instance.students
            .map((item) => item.className.trim())
            .where((item) => item.isNotEmpty)
            .toSet()
            .toList()
          ..sort();
    if (!mounted) return;
    setState(() {
      _classOptions = classes;
      _teacherAssignedClasses.removeWhere(
        (item) => !_classOptions.contains(item),
      );
      if (_teacherHomeroomClass != 'Sınıf öğretmenliği yok' &&
          !_classOptions.contains(_teacherHomeroomClass)) {
        _teacherHomeroomClass = 'Sınıf öğretmenliği yok';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(
        title: Text(
          'Öğretmen ve Personel Kaydı'.tr,
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'İnsan kaynağı kayıt merkezi',
            title:
                'Öğretmen, idari personel ve yemekhaneci profillerini kurumsal standartta oluşturun.'.tr,
            description:
                'Branş, departman, kampüs ve iletişim bilgileri tek akışta toplanır. Öğretmen hesapları için sistem giriş bilgisi otomatik üretilir.',
            colors: [Color(0xFF0F172A), Color(0xFF7C3AED)],
            metrics: [
              AdminHeroMetric(label: 'Öğretmen'.tr, value: 'Hesap oluşur'),
              AdminHeroMetric(label: 'Personel', value: 'Hesap oluşur'),
            ],
          ),
          const SizedBox(height: 16),
          _staffByRolePanel(context),
          const SizedBox(height: 16),
          AdminPanel(
            padding: const EdgeInsets.fromLTRB(10, 10, 10, 16),
            child: Column(
              children: [
                Container(
                  decoration: BoxDecoration(
                    color: Theme.of(
                      context,
                    ).scaffoldBackgroundColor.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: TabBar(
                    controller: _tabController,
                    dividerColor: Colors.transparent,
                    indicator: BoxDecoration(
                      color: const Color(0xFF1D4ED8),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    labelColor: Colors.white,
                    unselectedLabelColor: Theme.of(
                      context,
                    ).textTheme.bodyMedium?.color,
                    tabs: const [
                      Tab(text: 'Öğretmen Kaydı'),
                      Tab(text: 'Personel Kaydı'),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  height: ResponsiveLayout.isTablet(context) ? 1380 : 1120,
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildTeacherForm(context),
                      _buildPersonnelForm(context),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTeacherForm(BuildContext context) {
    return Form(
      key: _teacherFormKey,
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _field(controller: _teacherNameController, label: 'Ad Soyad'),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _field(
                    controller: _teacherTcController,
                    label: 'TC Kimlik No',
                    keyboardType: TextInputType.number,
                    maxLength: 11,
                    inputFormatters: AppInputFormatters.tcKimlik(),
                    validator: AppInputFormatters.validateTcKimlik,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _teacherBranch,
                    decoration: InputDecoration(
                      labelText: 'Branş'.tr,
                      border: OutlineInputBorder(),
                    ),
                    items: [
                      DropdownMenuItem(
                        value: 'Matematik',
                        child: Text('Matematik'),
                      ),
                      DropdownMenuItem(
                        value: 'Fen Bilimleri',
                        child: Text('Fen Bilimleri'),
                      ),
                      DropdownMenuItem(value: 'Türkçe', child: Text('Türkçe'.tr)),
                      DropdownMenuItem(
                        value: 'İngilizce',
                        child: Text('İngilizce'.tr),
                      ),
                    ],
                    onChanged: (value) => setState(
                      () => _teacherBranch = value ?? _teacherBranch,
                    ),
                  ),
                ),
              ],
            ),
            if (_branches.isNotEmpty) ...[
              const SizedBox(height: 12),
              _branchDropdown(),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _field(
                    controller: _teacherPhoneController,
                    label: 'Telefon',
                    keyboardType: TextInputType.phone,
                    inputFormatters: AppInputFormatters.phone(),
                    prefixText: '+90 ',
                    validator: AppInputFormatters.validatePhone,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _field(
              controller: _teacherEducationController,
              label: 'Mezuniyet / Universite',
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _field(
                    controller: _teacherStartDateController,
                    label: 'Ise Baslama Tarihi',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _field(
                    controller: _teacherCampusController,
                    label: 'Kampüs'.tr,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _teacherHomeroomClass,
              decoration: InputDecoration(
                labelText: 'Sınıf Öğretmenliği'.tr,
                border: OutlineInputBorder(),
              ),
              items: [
                DropdownMenuItem(
                  value: 'Sınıf öğretmenliği yok',
                  child: Text('Sınıf öğretmenliği yok'.tr),
                ),
                ..._classOptions.map(
                  (item) => DropdownMenuItem(value: item, child: Text(item)),
                ),
              ],
              onChanged: (value) => setState(
                () => _teacherHomeroomClass = value ?? _teacherHomeroomClass,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Ders Girdiği Sınıflar'.tr,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _classOptions
                  .map(
                    (className) => FilterChip(
                      selected: _teacherAssignedClasses.contains(className),
                      label: Text(className),
                      onSelected: (selected) {
                        setState(() {
                          if (selected) {
                            _teacherAssignedClasses.add(className);
                          } else {
                            _teacherAssignedClasses.remove(className);
                          }
                        });
                      },
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _teacherMaritalStatus,
                    decoration: const InputDecoration(
                      labelText: 'Medeni Durum',
                      border: OutlineInputBorder(),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'Bekar', child: Text('Bekar')),
                      DropdownMenuItem(value: 'Evli', child: Text('Evli')),
                    ],
                    onChanged: (value) => setState(
                      () => _teacherMaritalStatus =
                          value ?? _teacherMaritalStatus,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _field(
                    controller: _teacherChildCountController,
                    label: 'Çocuk Sayisi'.tr,
                    keyboardType: TextInputType.number,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _field(
              controller: _teacherNoteController,
              label: 'Görev Notu'.tr,
              maxLines: 4,
              required: false,
            ),
            const SizedBox(height: 16),
            AdminSectionTitle(title: 'Kayıt Sonrasi'.tr),
            const SizedBox(height: 10),
            _InfoRow(
              title: 'Sistem Hesabı'.tr,
              value: 'Otomatik kullanıcı adı ve şifre üretilir',
            ),
            const _InfoRow(
              title: 'Rol',
              value: 'Öğretmen paneline giriş hazır olur',
            ),
            _InfoRow(
              title: 'Öğretmen Ataması'.tr,
              value: _teacherAssignedClasses.isEmpty
                  ? 'Sınıf seçilmedi'
                  : (_teacherHomeroomClass == 'Sınıf öğretmenliği yok'
                        ? 'Branş öğretmeni'
                        : 'Sınıf öğretmeni: $_teacherHomeroomClass'),
            ),
            const SizedBox(height: 16),
            _submitButton(
              label: 'Öğretmen Kaydını Tamamla'.tr,
              onPressed: _submitTeacher,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPersonnelForm(BuildContext context) {
    return Form(
      key: _personnelFormKey,
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _field(controller: _personnelNameController, label: 'Ad Soyad'),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _personnelRole,
              decoration: InputDecoration(
                labelText: 'Personel Rolü'.tr,
                border: OutlineInputBorder(),
              ),
              items: [
                DropdownMenuItem(
                  value: 'BranchManager',
                  child: Text('Şube Müdürü'.tr),
                ),
                DropdownMenuItem(
                  value: 'Administrative',
                  child: Text('İdari Personel'.tr),
                ),
                DropdownMenuItem(
                  value: 'Cafeteria',
                  child: Text('Yemekhaneci'),
                ),
                DropdownMenuItem(
                  value: 'ServiceDriver',
                  child: Text('Servis Şoförü'.tr),
                ),
              ],
              onChanged: (value) {
                if (value == null) return;
                setState(() {
                  _personnelRole = value;
                  _personnelDepartment = value == 'Cafeteria'
                      ? 'Yemekhane'
                      : value == 'ServiceDriver'
                      ? 'Servis Şoförü'
                      : value == 'BranchManager'
                      ? 'Şube Yönetimi'
                      : 'Öğrenci Isleri';
                });
              },
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _field(
                    controller: _personnelTcController,
                    label: 'TC Kimlik No',
                    keyboardType: TextInputType.number,
                    maxLength: 11,
                    inputFormatters: AppInputFormatters.tcKimlik(),
                    validator: AppInputFormatters.validateTcKimlik,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    key: ValueKey(_personnelRole),
                    initialValue: _personnelDepartment,
                    decoration: const InputDecoration(
                      labelText: 'Departman',
                      border: OutlineInputBorder(),
                    ),
                    items: _personnelRole == 'BranchManager'
                        ? [
                            DropdownMenuItem(
                              value: 'Şube Yönetimi',
                              child: Text('Şube Yönetimi'.tr),
                            ),
                          ]
                        : _personnelRole == 'Cafeteria'
                        ? const [
                            DropdownMenuItem(
                              value: 'Yemekhane',
                              child: Text('Yemekhane'),
                            ),
                          ]
                        : _personnelRole == 'ServiceDriver'
                        ? [
                            DropdownMenuItem(
                              value: 'Servis Şoförü',
                              child: Text('Servis Şoförü'.tr),
                            ),
                          ]
                        : [
                            DropdownMenuItem(
                              value: 'Öğrenci Isleri',
                              child: Text('Öğrenci İşleri'.tr),
                            ),
                            DropdownMenuItem(
                              value: 'Muhasebe',
                              child: Text('Muhasebe'),
                            ),
                            DropdownMenuItem(
                              value: 'Destek ve IT',
                              child: Text('Destek ve IT'.tr),
                            ),
                            DropdownMenuItem(
                              value: 'Operasyon',
                              child: Text('Operasyon'),
                            ),
                          ],
                    onChanged: (value) => setState(
                      () =>
                          _personnelDepartment = value ?? _personnelDepartment,
                    ),
                  ),
                ),
              ],
            ),
            if (_branches.isNotEmpty) ...[
              const SizedBox(height: 12),
              _branchDropdown(),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _field(
                    controller: _personnelPhoneController,
                    label: 'Telefon',
                    keyboardType: TextInputType.phone,
                    inputFormatters: AppInputFormatters.phone(),
                    prefixText: '+90 ',
                    validator: AppInputFormatters.validatePhone,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _field(
              controller: _personnelEmailController,
              label: _personnelRole == 'ServiceDriver'
                  ? 'Giriş E-postası'
                  : 'E-posta',
              keyboardType: TextInputType.emailAddress,
              required: _personnelRole == 'ServiceDriver',
              validator: _personnelRole == 'ServiceDriver'
                  ? _validateEmail
                  : _validateOptionalEmail,
            ),
            const SizedBox(height: 12),
            _field(
              controller: _personnelEducationController,
              label: 'Egitim / Uzmanlik',
            ),
            if (_personnelRole == 'ServiceDriver') ...[
              const SizedBox(height: 12),
              _field(
                controller: _driverLicenseController,
                label: 'Ehliyet No / Sınıfı'.tr,
              ),
              const SizedBox(height: 16),
              AdminSectionTitle(title: 'Servis Aracı ve Rota Bilgileri'.tr),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _field(
                      controller: _vehicleNumberController,
                      label: 'Araç No'.tr,
                      required: false,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _field(
                      controller: _vehiclePlateController,
                      label: 'Plaka',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _field(
                      controller: _vehicleBrandController,
                      label: 'Araç Marka'.tr,
                      required: false,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _field(
                      controller: _vehicleModelController,
                      label: 'Araç Model'.tr,
                      required: false,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _field(
                      controller: _vehicleCapacityController,
                      label: 'Kapasite',
                      keyboardType: TextInputType.number,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: _routeType,
                      decoration: const InputDecoration(
                        labelText: 'Rota Tipi',
                        border: OutlineInputBorder(),
                      ),
                      items: [
                        DropdownMenuItem(
                          value: 'Morning',
                          child: Text('Sabah'),
                        ),
                        DropdownMenuItem(
                          value: 'Evening',
                          child: Text('Akşam'.tr),
                        ),
                      ],
                      onChanged: (value) =>
                          setState(() => _routeType = value ?? _routeType),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _field(controller: _routeNameController, label: 'Rota Adı'.tr),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _field(
                      controller: _routeStartController,
                      label: 'Başlangıç Saati'.tr,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _field(
                      controller: _routeEndController,
                      label: 'Bitiş Saati'.tr,
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _field(
                    controller: _personnelStartDateController,
                    label: 'Ise Baslama Tarihi',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _field(
                    controller: _personnelCampusController,
                    label: 'Kampüs'.tr,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _personnelMaritalStatus,
                    decoration: const InputDecoration(
                      labelText: 'Medeni Durum',
                      border: OutlineInputBorder(),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'Bekar', child: Text('Bekar')),
                      DropdownMenuItem(value: 'Evli', child: Text('Evli')),
                    ],
                    onChanged: (value) => setState(
                      () => _personnelMaritalStatus =
                          value ?? _personnelMaritalStatus,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _field(
                    controller: _personnelChildCountController,
                    label: 'Çocuk Sayisi'.tr,
                    keyboardType: TextInputType.number,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _field(
              controller: _personnelNoteController,
              label: _personnelRole == 'Cafeteria'
                  ? 'Yemekhane Notu'
                  : 'İdari Not',
              maxLines: 4,
              required: false,
            ),
            const SizedBox(height: 16),
            AdminSectionTitle(title: 'Kayıt Sonrasi'.tr),
            const SizedBox(height: 10),
            const _InfoRow(
              title: 'Personel Profili',
              value: 'Departman ve kampus kaydı kurumsal listede yer alir',
            ),
            _InfoRow(
              title: 'Erişim'.tr,
              value: _personnelRole == 'ServiceDriver'
                  ? 'Şoför hesabı, aracı ve ilk rotası tek kayıtta oluşturulur'
                  : _personnelRole == 'Cafeteria'
                  ? 'Sadece haftalık yemek programı yönetim paneline erişir'
                  : 'İdari duyurular ve kurum içi görev akışlarıyla eşleşir',
            ),
            const SizedBox(height: 16),
            _submitButton(
              label: 'Personel Kaydini Tamamla',
              onPressed: _submitPersonnel,
            ),
          ],
        ),
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
    String? Function(String?)? validator,
    List<TextInputFormatter>? inputFormatters,
    String? prefixText,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      maxLength: maxLength,
      inputFormatters: inputFormatters,
      validator:
          validator ??
          (required
              ? (value) => value == null || value.trim().isEmpty
                    ? '$label zorunludur'
                    : null
              : null),
      decoration: InputDecoration(
        labelText: label,
        prefixText: prefixText,
        border: const OutlineInputBorder(),
      ),
    );
  }

  String? _validateEmail(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) {
      return 'Giriş e-postası zorunludur';
    }
    return _isValidEmail(text) ? null : 'Geçerli bir e-posta girin';
  }

  String? _validateOptionalEmail(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return null;
    return _isValidEmail(text) ? null : 'Geçerli bir e-posta girin';
  }

  bool _isValidEmail(String value) {
    return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(value);
  }

  Widget _staffByRolePanel(BuildContext context) {
    const roles = [
      ('Teacher', 'Öğretmen'),
      ('Administrative', 'İdari Personel'),
      ('Accounting', 'Muhasebe'),
      ('ServiceDriver', 'Servis Şoförü'),
      ('Cafeteria', 'Yemekhaneci'),
    ];
    final selected = roles.firstWhere((r) => r.$1 == _staffRoleFilter, orElse: () => roles.first);
    String norm(String v) => v.trim().toLowerCase();
    final filtered = _allStaff.where((s) {
      final role = norm(s.role);
      return role == norm(selected.$1) || role == norm(selected.$2);
    }).toList();

    return AdminPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AdminSectionTitle(title: 'Role Göre Personel'.tr),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: roles.map((r) {
              return ChoiceChip(
                label: Text(r.$2),
                selected: r.$1 == _staffRoleFilter,
                onSelected: (_) => setState(() => _staffRoleFilter = r.$1),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
          Text('${selected.$2} • ${filtered.length} kişi', style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          if (filtered.isEmpty)
            Text('Bu rolde kayıtlı personel yok.'.tr)
          else
            ...filtered.map(
              (s) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 16,
                      backgroundColor: const Color(0xFF7C3AED).withValues(alpha: 0.12),
                      child: Text(
                        s.fullName.isEmpty ? '?' : s.fullName.characters.first,
                        style: const TextStyle(color: Color(0xFF7C3AED), fontWeight: FontWeight.w800, fontSize: 13),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(s.fullName, style: const TextStyle(fontWeight: FontWeight.w600)),
                          if (s.departmentOrBranch.isNotEmpty)
                            Text(s.departmentOrBranch, style: Theme.of(context).textTheme.bodySmall),
                        ],
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

  Widget _submitButton({
    required String label,
    required VoidCallback onPressed,
  }) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: _saving ? null : onPressed,
        icon: _saving
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.how_to_reg_outlined),
        label: Text(_saving ? 'Kaydediliyor' : label),
      ),
    );
  }

  Future<void> _submitTeacher() async {
    if (!_teacherFormKey.currentState!.validate()) {
      return;
    }

    setState(() => _saving = true);
    try {
      final credentials = await RegistrationApiService.instance.createStaff(
        fullName: _teacherNameController.text.trim(),
        role: 'Teacher',
        departmentOrBranch: _teacherBranch,
        tcNo: _teacherTcController.text.trim(),
        phone: _teacherPhoneController.text.trim(),
        email: '',
        education: _teacherEducationController.text.trim(),
        startDate: _teacherStartDateController.text.trim(),
        campus: _teacherCampusController.text.trim(),
        homeroomClass: _teacherHomeroomClass,
        assignedClasses: _teacherAssignedClasses.toList()..sort(),
        maritalStatus: _teacherMaritalStatus,
        childCount: int.tryParse(_teacherChildCountController.text.trim()) ?? 0,
        note: _teacherNoteController.text.trim(),
        branchId: (_branchId != null && _branchId!.isNotEmpty) ? _branchId : null,
      );
      if (!mounted) return;
      setState(() => _saving = false);
      await _showResultCard(
        title: 'Öğretmen kaydı tamamlandı'.tr,
        description:
            'Öğretmen paneli için kullanıcı adı ve şifre otomatik oluşturuldu.',
        credentials: credentials,
        withLogin: true,
      );
    } on RegistrationApiException catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _submitPersonnel() async {
    if (!_personnelFormKey.currentState!.validate()) {
      return;
    }
    if (_personnelRole == 'ServiceDriver') {
      final capacity =
          int.tryParse(_vehicleCapacityController.text.trim()) ?? 0;
      if (capacity < 2) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Araç kapasitesi en az 2 olmalı.'.tr)),
        );
        return;
      }
    }
    if (_personnelRole == 'BranchManager' &&
        (_branchId == null || _branchId!.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Şube müdürü için şube seçimi zorunludur.'.tr)),
      );
      return;
    }

    setState(() => _saving = true);
    String? createdStaffUserId;
    String? createdVehicleId;
    String? createdDriverId;
    try {
      final isServiceDriver = _personnelRole == 'ServiceDriver';
      final backendRole = isServiceDriver ? 'Administrative' : _personnelRole;
      final department = isServiceDriver
          ? 'Servis Şoförü'
          : _personnelDepartment;
      final credentials = await RegistrationApiService.instance.createStaff(
        fullName: _personnelNameController.text.trim(),
        role: backendRole,
        departmentOrBranch: department,
        tcNo: _personnelTcController.text.trim(),
        phone: _personnelPhoneController.text.trim(),
        email: _personnelEmailController.text.trim(),
        education: _personnelEducationController.text.trim(),
        startDate: _personnelStartDateController.text.trim(),
        campus: _personnelCampusController.text.trim(),
        homeroomClass: 'Sınıf öğretmenliği yok',
        assignedClasses: const [],
        maritalStatus: _personnelMaritalStatus,
        childCount:
            int.tryParse(_personnelChildCountController.text.trim()) ?? 0,
        note: _personnelNoteController.text.trim(),
        branchId: (_branchId != null && _branchId!.isNotEmpty) ? _branchId : null,
      );
      createdStaffUserId = credentials.userId;
      String serviceSummary = '';
      if (isServiceDriver) {
        if (credentials.userId.isEmpty) {
          throw const RegistrationApiException(
            'Şoför kullanıcısı oluşturuldu fakat kullanıcı ID alınamadı.',
          );
        }
        final capacity =
            int.tryParse(_vehicleCapacityController.text.trim()) ?? 0;
        if (_driverLicenseController.text.trim().isEmpty ||
            _vehiclePlateController.text.trim().isEmpty ||
            capacity < 2 ||
            _routeNameController.text.trim().isEmpty) {
          throw const RegistrationApiException(
            'Servis şoförü için ehliyet, plaka, kapasite ve rota adı zorunludur.',
          );
        }
        final api = ServiceTrackingApiService.instance;
        final vehicle = await api.createVehicle(
          vehicleNumber: _vehicleNumberController.text.trim(),
          plateNumber: _vehiclePlateController.text.trim().toUpperCase(),
          brand: _vehicleBrandController.text.trim(),
          model: _vehicleModelController.text.trim(),
          capacity: capacity,
        );
        createdVehicleId = vehicle.id;
        final driver = await api.createDriver(
          userId: credentials.userId,
          phoneNumber: _personnelPhoneController.text.trim(),
          licenseNumber: _driverLicenseController.text.trim(),
        );
        createdDriverId = driver.id;
        final route = await api.createRoute(
          name: _routeNameController.text.trim(),
          routeType: _routeType,
          vehicleId: vehicle.id,
          driverId: driver.id,
          startTime: _routeStartController.text.trim(),
          endTime: _routeEndController.text.trim(),
          isActive: false,
        );
        serviceSummary =
            'E-posta: ${_personnelEmailController.text.trim()} • ${vehicle.plateNumber}${vehicle.vehicleNumber.isEmpty ? '' : ' / ${vehicle.vehicleNumber}'} • ${route.name}';
      }
      if (!mounted) return;
      setState(() => _saving = false);
      await _showResultCard(
        title: isServiceDriver
            ? 'Servis Şoförü'
            : _personnelRole == 'Cafeteria'
            ? 'Yemekhaneci'
            : 'İdari Personel',
        description: isServiceDriver
            ? 'Şoför hesabı, servis aracı ve ilk rota oluşturuldu. Rota pasif kaydedildi; durak ve öğrenci atamasından sonra aktifleştirebilirsiniz.'
            : _personnelRole == 'Cafeteria'
            ? 'Yemekhaneci hesabı oluşturuldu. Bu hesap haftalık yemek programını doldurabilir; ilk girişte şifre değişimi zorunludur.'
            : 'İdari profil oluşturuldu. Aşağıdaki giriş bilgileriyle kurum sistemine erişebilir; ilk girişte şifre değişimi zorunludur.',
        credentials: credentials,
        withLogin: true,
        serviceSummary: serviceSummary,
      );
    } on RegistrationApiException catch (error) {
      await _rollbackServiceDriverRegistration(
        driverId: createdDriverId,
        vehicleId: createdVehicleId,
        staffUserId: createdStaffUserId,
      );
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } on ServiceTrackingApiException catch (error) {
      await _rollbackServiceDriverRegistration(
        driverId: createdDriverId,
        vehicleId: createdVehicleId,
        staffUserId: createdStaffUserId,
      );
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _rollbackServiceDriverRegistration({
    String? driverId,
    String? vehicleId,
    String? staffUserId,
  }) async {
    if (_personnelRole != 'ServiceDriver') return;
    final serviceApi = ServiceTrackingApiService.instance;
    try {
      if (driverId != null && driverId.isNotEmpty) {
        await serviceApi.deleteDriver(driverId);
      }
    } catch (_) {}
    try {
      if (vehicleId != null && vehicleId.isNotEmpty) {
        await serviceApi.deleteVehicle(vehicleId);
      }
    } catch (_) {}
    try {
      if (staffUserId != null && staffUserId.isNotEmpty) {
        await RegistrationApiService.instance.deleteStaffUser(staffUserId);
      }
    } catch (_) {}
  }

  Future<void> _showResultCard({
    required String title,
    required String description,
    required GeneratedCredentials credentials,
    required bool withLogin,
    String serviceSummary = '',
  }) {
    return showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return Dialog(
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
                    Icons.verified_user_outlined,
                    color: Color(0xFF14532D),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  title,
                  style: Theme.of(
                    dialogContext,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 8),
                Text(
                  description,
                  style: Theme.of(
                    dialogContext,
                  ).textTheme.bodyMedium?.copyWith(height: 1.45),
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Theme.of(dialogContext).cardColor,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: Theme.of(
                        dialogContext,
                      ).dividerColor.withValues(alpha: 0.28),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _resultRow('Kullanıcı Adı', credentials.username),
                      const SizedBox(height: 10),
                      _resultRow('Şifre', credentials.password),
                      if (serviceSummary.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        _resultRow('Servis', serviceSummary),
                      ],
                      if (!withLogin) ...[
                        const SizedBox(height: 10),
                        Text(
                          'Bu kayıt su an kurum içi personel profili olarak tutulur.'.tr,
                          style: Theme.of(dialogContext).textTheme.bodySmall,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                if (withLogin) ...[
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        final session = await AuthSessionStore.instance.load();
                        await CredentialsPdfService.generateAndShare(
                          tenantName: session?.tenantName ?? '',
                          fullName: credentials.fullName,
                          role: title,
                          username: credentials.username,
                          temporaryPassword: credentials.password,
                          extra: serviceSummary.isEmpty ? null : serviceSummary,
                        );
                      },
                      icon: const Icon(Icons.picture_as_pdf_outlined),
                      label: Text('PDF Olarak İndir / Paylaş'.tr),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () async {
                          await Clipboard.setData(
                            ClipboardData(
                              text:
                                  'Kullanıcı Adı: ${credentials.username}${serviceSummary.isEmpty ? '' : '\n$serviceSummary'}\nŞifre: ${credentials.password}',
                            ),
                          );
                          if (!mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                'Kayıt bilgileri panoya kopyalandı.'.tr,
                              ),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        },
                        icon: const Icon(Icons.copy_outlined),
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
                        child: const Text('Merkeze Don'),
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

  Widget _branchDropdown() {
    return DropdownButtonFormField<String>(
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
    );
  }

  Widget _resultRow(String title, String value) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        const SizedBox(width: 12),
        SelectableText(
          value,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ],
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
          const SizedBox(width: 12),
          Flexible(child: Text(value, textAlign: TextAlign.right)),
        ],
      ),
    );
  }
}
