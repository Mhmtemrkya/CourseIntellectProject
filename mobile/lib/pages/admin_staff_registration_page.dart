import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/auth_session_store.dart';
import '../services/credentials_pdf_service.dart';
import '../services/registration_api_service.dart';
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
  final _personnelEducationController = TextEditingController();
  final _personnelStartDateController = TextEditingController();
  final _personnelCampusController = TextEditingController(
    text: 'Merkez Kampüs',
  );
  final _personnelChildCountController = TextEditingController(text: '0');
  final _personnelNoteController = TextEditingController();

  String _teacherBranch = 'Matematik';
  String _personnelDepartment = 'Öğrenci Isleri';
  String _teacherHomeroomClass = 'Sınıf öğretmenliği yok';
  final Set<String> _teacherAssignedClasses = {};
  List<String> _classOptions = const [];
  String _teacherMaritalStatus = 'Bekar';
  String _personnelMaritalStatus = 'Bekar';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadClassOptions();
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
    _personnelEducationController.dispose();
    _personnelStartDateController.dispose();
    _personnelCampusController.dispose();
    _personnelChildCountController.dispose();
    _personnelNoteController.dispose();
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
        title: const Text(
          'Öğretmen ve Personel Kaydı',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const AdminHeroCard(
            eyebrow: 'İnsan kaynağı kayıt merkezi',
            title:
                'Öğretmen ve idari personel profillerini kurumsal standartta oluşturun.',
            description:
                'Branş, departman, kampüs ve iletişim bilgileri tek akışta toplanır. Öğretmen hesapları için sistem giriş bilgisi otomatik üretilir.',
            colors: [Color(0xFF0F172A), Color(0xFF7C3AED)],
            metrics: [
              AdminHeroMetric(label: 'Öğretmen', value: 'Hesap oluşur'),
              AdminHeroMetric(label: 'Personel', value: 'Profil kaydı'),
            ],
          ),
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
                  height: ResponsiveLayout.isTablet(context) ? 1100 : 840,
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
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _teacherBranch,
                    decoration: const InputDecoration(
                      labelText: 'Branş',
                      border: OutlineInputBorder(),
                    ),
                    items: const [
                      DropdownMenuItem(
                        value: 'Matematik',
                        child: Text('Matematik'),
                      ),
                      DropdownMenuItem(
                        value: 'Fen Bilimleri',
                        child: Text('Fen Bilimleri'),
                      ),
                      DropdownMenuItem(value: 'Türkçe', child: Text('Türkçe')),
                      DropdownMenuItem(
                        value: 'İngilizce',
                        child: Text('İngilizce'),
                      ),
                    ],
                    onChanged: (value) => setState(
                      () => _teacherBranch = value ?? _teacherBranch,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _field(
                    controller: _teacherPhoneController,
                    label: 'Telefon',
                    keyboardType: TextInputType.phone,
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
                    label: 'Kampüs',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _teacherHomeroomClass,
              decoration: const InputDecoration(
                labelText: 'Sınıf Öğretmenliği',
                border: OutlineInputBorder(),
              ),
              items: [
                const DropdownMenuItem(
                  value: 'Sınıf öğretmenliği yok',
                  child: Text('Sınıf öğretmenliği yok'),
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
              'Ders Girdiği Sınıflar',
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
                    label: 'Çocuk Sayisi',
                    keyboardType: TextInputType.number,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _field(
              controller: _teacherNoteController,
              label: 'Görev Notu',
              maxLines: 4,
              required: false,
            ),
            const SizedBox(height: 16),
            const AdminSectionTitle(title: 'Kayıt Sonrasi'),
            const SizedBox(height: 10),
            const _InfoRow(
              title: 'Sistem Hesabı',
              value: 'Otomatik kullanıcı adı ve şifre üretilir',
            ),
            const _InfoRow(
              title: 'Rol',
              value: 'Öğretmen paneline giriş hazır olur',
            ),
            _InfoRow(
              title: 'Öğretmen Ataması',
              value: _teacherAssignedClasses.isEmpty
                  ? 'Sınıf seçilmedi'
                  : (_teacherHomeroomClass == 'Sınıf öğretmenliği yok'
                        ? 'Branş öğretmeni'
                        : 'Sınıf öğretmeni: $_teacherHomeroomClass'),
            ),
            const SizedBox(height: 16),
            _submitButton(
              label: 'Öğretmen Kaydını Tamamla',
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
            Row(
              children: [
                Expanded(
                  child: _field(
                    controller: _personnelTcController,
                    label: 'TC Kimlik No',
                    keyboardType: TextInputType.number,
                    maxLength: 11,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _personnelDepartment,
                    decoration: const InputDecoration(
                      labelText: 'Departman',
                      border: OutlineInputBorder(),
                    ),
                    items: const [
                      DropdownMenuItem(
                        value: 'Öğrenci Isleri',
                        child: Text('Öğrenci İşleri'),
                      ),
                      DropdownMenuItem(
                        value: 'Muhasebe',
                        child: Text('Muhasebe'),
                      ),
                      DropdownMenuItem(
                        value: 'Destek ve IT',
                        child: Text('Destek ve IT'),
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
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _field(
                    controller: _personnelPhoneController,
                    label: 'Telefon',
                    keyboardType: TextInputType.phone,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _field(
              controller: _personnelEducationController,
              label: 'Egitim / Uzmanlik',
            ),
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
                    label: 'Çocuk Sayisi',
                    keyboardType: TextInputType.number,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _field(
              controller: _personnelNoteController,
              label: 'İdari Not',
              maxLines: 4,
              required: false,
            ),
            const SizedBox(height: 16),
            const AdminSectionTitle(title: 'Kayıt Sonrasi'),
            const SizedBox(height: 10),
            const _InfoRow(
              title: 'Personel Profili',
              value: 'Departman ve kampus kaydı kurumsal listede yer alir',
            ),
            const _InfoRow(
              title: 'Duyuru Akışı',
              value: 'İdari duyurular ve kurum içi görev akışlarıyla eşleşir',
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
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      maxLength: maxLength,
      validator: required
          ? (value) => value == null || value.trim().isEmpty
                ? '$label zorunludur'
                : null
          : null,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
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
      );
      if (!mounted) return;
      setState(() => _saving = false);
      await _showResultCard(
        title: 'Öğretmen kaydı tamamlandı',
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

    setState(() => _saving = true);
    try {
      final credentials = await RegistrationApiService.instance.createStaff(
        fullName: _personnelNameController.text.trim(),
        role: 'Administrative',
        departmentOrBranch: _personnelDepartment,
        tcNo: _personnelTcController.text.trim(),
        phone: _personnelPhoneController.text.trim(),
        email: '',
        education: _personnelEducationController.text.trim(),
        startDate: _personnelStartDateController.text.trim(),
        campus: _personnelCampusController.text.trim(),
        homeroomClass: 'Sınıf öğretmenliği yok',
        assignedClasses: const [],
        maritalStatus: _personnelMaritalStatus,
        childCount:
            int.tryParse(_personnelChildCountController.text.trim()) ?? 0,
        note: _personnelNoteController.text.trim(),
      );
      if (!mounted) return;
      setState(() => _saving = false);
      await _showResultCard(
        title: 'İdari Personel',
        description:
            'İdari profil oluşturuldu. Aşağıdaki giriş bilgileriyle kurum sistemine erişebilir; ilk girişte şifre değişimi zorunludur.',
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

  Future<void> _showResultCard({
    required String title,
    required String description,
    required GeneratedCredentials credentials,
    required bool withLogin,
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
                      if (!withLogin) ...[
                        const SizedBox(height: 10),
                        Text(
                          'Bu kayıt su an kurum içi personel profili olarak tutulur.',
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
                        );
                      },
                      icon: const Icon(Icons.picture_as_pdf_outlined),
                      label: const Text('PDF Olarak Indir / Paylas'),
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
                                  'Kullanıcı Adı: ${credentials.username}\nŞifre: ${credentials.password}',
                            ),
                          );
                          if (!mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'Kayıt bilgileri panoya kopyalandı.',
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
