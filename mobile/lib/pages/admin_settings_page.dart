import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:provider/provider.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/app_settings_api_service.dart';
import '../services/auth_session_store.dart';
import '../services/branding_service.dart';
import '../services/institution_profile_api_service.dart';
import '../theme_provider.dart';
import '../widgets/admin_ui.dart';
import 'consent_station_page.dart';
import 'school_contract_forms_page.dart';

class AdminSettingsPage extends StatefulWidget {
  const AdminSettingsPage({super.key});

  @override
  State<AdminSettingsPage> createState() => _AdminSettingsPageState();
}

class _AdminSettingsPageState extends State<AdminSettingsPage> {
  // Kurum künyesi belgelerde kullanıldığı için kuruma özel uçta tutulur;
  // kapasite ve otomasyon tercihleri genel ayarlarda kalır.
  final _schoolNameController = TextEditingController();
  final _mailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();
  final _districtController = TextEditingController();
  final _cityController = TextEditingController();
  final _websiteController = TextEditingController();
  final _taxOfficeController = TextEditingController();
  final _taxNumberController = TextEditingController();
  final _footerNoteController = TextEditingController();
  final _quotaController = TextEditingController();

  bool autoReports = true;
  bool parentNotifications = true;
  bool financeApprovals = true;

  bool _loading = true;
  bool _saving = false;
  bool _logoBusy = false;
  bool _canManageLogo = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  @override
  void dispose() {
    _schoolNameController.dispose();
    _mailController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _districtController.dispose();
    _cityController.dispose();
    _websiteController.dispose();
    _taxOfficeController.dispose();
    _taxNumberController.dispose();
    _footerNoteController.dispose();
    _quotaController.dispose();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await AppSettingsApiService.instance.fetchAll(
        category: 'institution',
      );
      final profile = await InstitutionProfileApiService.instance.fetch();
      final session = await AuthSessionStore.instance.load();
      if (!mounted) return;
      final map = {for (final item in items) item.key: item.value};
      _schoolNameController.text = '${profile['name'] ?? ''}';
      _mailController.text = '${profile['email'] ?? ''}';
      _phoneController.text = '${profile['phone'] ?? ''}';
      _addressController.text = '${profile['address'] ?? ''}';
      _districtController.text = '${profile['district'] ?? ''}';
      _cityController.text = '${profile['city'] ?? ''}';
      _websiteController.text = '${profile['website'] ?? ''}';
      _taxOfficeController.text = '${profile['taxOffice'] ?? ''}';
      _taxNumberController.text = '${profile['taxNumber'] ?? ''}';
      _footerNoteController.text = '${profile['documentFooterNote'] ?? ''}';
      _quotaController.text = map['institution_quota'] ?? '';
      autoReports = map['auto_reports'] != 'false';
      parentNotifications = map['parent_notifications'] != 'false';
      financeApprovals = map['finance_approvals'] != 'false';
      final role = session?.primaryRole.trim().toLowerCase() ?? '';
      _canManageLogo =
          role == 'admin' ||
          role == 'institutionadmin' ||
          role == 'institutionadministrator';
      setState(() => _loading = false);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.toString();
      });
    }
  }

  Future<void> _saveSettings() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await InstitutionProfileApiService.instance.save({
        'name': _schoolNameController.text.trim(),
        'address': _addressController.text.trim(),
        'district': _districtController.text.trim(),
        'city': _cityController.text.trim(),
        'phone': _phoneController.text.trim(),
        'email': _mailController.text.trim(),
        'website': _websiteController.text.trim(),
        'taxOffice': _taxOfficeController.text.trim(),
        'taxNumber': _taxNumberController.text.trim(),
        'documentFooterNote': _footerNoteController.text.trim(),
      });
      await AppSettingsApiService.instance.upsert([
        {
          'key': 'institution_quota',
          'value': _quotaController.text.trim(),
          'type': 'string',
          'category': 'institution',
          'description': 'Öğrenci kapasitesi',
        },
        {
          'key': 'auto_reports',
          'value': autoReports.toString(),
          'type': 'bool',
          'category': 'institution',
          'description': 'Otomatik rapor',
        },
        {
          'key': 'parent_notifications',
          'value': parentNotifications.toString(),
          'type': 'bool',
          'category': 'institution',
          'description': 'Veli bildirim',
        },
        {
          'key': 'finance_approvals',
          'value': financeApprovals.toString(),
          'type': 'bool',
          'category': 'institution',
          'description': 'Finans onay',
        },
      ]);
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Kurum künyesi kaydedildi; belgelerde bu bilgiler görünecek.'.tr,
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = error.toString();
      });
    }
  }

  Future<void> _pickLogo() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['png', 'jpg', 'jpeg', 'webp'],
      withData: true,
      allowMultiple: false,
    );
    final file = result?.files.singleOrNull;
    if (file == null) return;
    if (file.bytes == null) {
      _showMessage('Logo dosyası okunamadı.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      _showMessage('Logo dosyası en fazla 2 MB olabilir.');
      return;
    }

    setState(() => _logoBusy = true);
    try {
      await BrandingService.instance.uploadLogo(file);
      if (!mounted) return;
      await BrandingService.instance.applyBranding(
        context.read<ThemeProvider>(),
      );
      if (!mounted) return;
      _showMessage('Kurum logosu öğrenci ve personel ekranlarına uygulandı.');
    } catch (error) {
      if (mounted) _showMessage(error.toString());
    } finally {
      if (mounted) setState(() => _logoBusy = false);
    }
  }

  Future<void> _removeLogo() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Kurum logosunu kaldır'),
        content: const Text(
          'Logo kurumunuzdaki öğrenci ve personel ekranlarından kaldırılacak.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Kaldır'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _logoBusy = true);
    try {
      await BrandingService.instance.removeLogo();
      if (!mounted) return;
      await BrandingService.instance.applyBranding(
        context.read<ThemeProvider>(),
      );
      if (mounted) _showMessage('Kurum logosu kaldırıldı.');
    } catch (error) {
      if (mounted) _showMessage(error.toString());
    } finally {
      if (mounted) setState(() => _logoBusy = false);
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(
        title: Text(
          'Kurum Ayarları'.tr,
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            tooltip: 'Yenile',
            onPressed: _loading ? null : _loadSettings,
            icon: _loading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh),
          ),
        ],
      ),
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                AdminHeroCard(
                  eyebrow: 'Kurumsal yapı',
                  title:
                      'Kurum bilgileri, otomasyon tercihleri ve genel yönetim ayarları tek sayfada.'
                          .tr,
                  description:
                      'Yönetici tarafında rapor, iletişim ve kapasite ayarları merkezi olarak güncellenir.',
                  metrics: [
                    AdminHeroMetric(label: 'Aktif Şube'.tr, value: '4'),
                    AdminHeroMetric(
                      label: 'Kapasite',
                      value: _quotaController.text.isEmpty
                          ? '-'
                          : _quotaController.text,
                    ),
                  ],
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                if (_canManageLogo)
                  Consumer<ThemeProvider>(
                    builder: (context, themeProvider, _) => AdminPanel(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Kurum Logosu'.tr,
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Okul ve sürücü kursu ekranlarında tüm öğrenci ve personelin göreceği logo.'
                                .tr,
                          ),
                          const SizedBox(height: 16),
                          Container(
                            width: double.infinity,
                            height: 150,
                            padding: const EdgeInsets.all(18),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                color: Colors.blueGrey.withValues(alpha: 0.24),
                              ),
                            ),
                            child: themeProvider.tenantLogo != null
                                ? Image.network(
                                    themeProvider.tenantLogo!,
                                    fit: BoxFit.contain,
                                    errorBuilder: (_, _, _) => const Icon(
                                      Icons.broken_image_outlined,
                                      color: Colors.blueGrey,
                                      size: 44,
                                    ),
                                  )
                                : const Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.apartment_rounded,
                                        color: Colors.blueGrey,
                                        size: 42,
                                      ),
                                      SizedBox(height: 8),
                                      Text(
                                        'Henüz logo yüklenmedi',
                                        style: TextStyle(
                                          color: Colors.blueGrey,
                                        ),
                                      ),
                                    ],
                                  ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Kare, yatay, dikey ve yuvarlak logolar kırpılmadan gösterilir. PNG, JPEG veya WebP; en fazla 2 MB.'
                                .tr,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          const SizedBox(height: 14),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              FilledButton.icon(
                                onPressed: _logoBusy ? null : _pickLogo,
                                icon: _logoBusy
                                    ? const SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                        ),
                                      )
                                    : const Icon(Icons.upload_rounded),
                                label: Text(
                                  themeProvider.tenantLogo == null
                                      ? 'Logo Yükle'.tr
                                      : 'Logoyu Değiştir'.tr,
                                ),
                              ),
                              if (themeProvider.tenantLogo != null)
                                OutlinedButton.icon(
                                  onPressed: _logoBusy ? null : _removeLogo,
                                  icon: const Icon(
                                    Icons.delete_outline_rounded,
                                  ),
                                  label: Text('Logoyu kaldır'.tr),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                if (_canManageLogo) const SizedBox(height: 16),
                AdminPanel(
                  child: Column(
                    children: [
                      // Belgelerin (ekstre/makbuz) başlığında görünen künye.
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          'Kurum Künyesi — belge başlığı'.tr,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                      const SizedBox(height: 12),
                      _field('Kurum Adi', _schoolNameController),
                      const SizedBox(height: 12),
                      _field('Adres', _addressController),
                      const SizedBox(height: 12),
                      _field('İlçe', _districtController),
                      const SizedBox(height: 12),
                      _field('İl', _cityController),
                      const SizedBox(height: 12),
                      _field('Telefon', _phoneController),
                      const SizedBox(height: 12),
                      _field('Kurumsal E-posta', _mailController),
                      const SizedBox(height: 12),
                      _field('Web sitesi', _websiteController),
                      const SizedBox(height: 12),
                      _field('Vergi dairesi', _taxOfficeController),
                      const SizedBox(height: 12),
                      _field('Vergi / TC kimlik no', _taxNumberController),
                      const SizedBox(height: 12),
                      _field('Belge alt notu', _footerNoteController),
                      const SizedBox(height: 12),
                      _field('Öğrenci Kapasitesi', _quotaController),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: _saving ? null : _saveSettings,
                          child: _saving
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : Text('Ayarları Kaydet'.tr),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                AdminPanel(
                  child: Column(
                    children: [
                      SwitchListTile(
                        value: autoReports,
                        onChanged: (value) =>
                            setState(() => autoReports = value),
                        title: Text('Haftalık raporları otomatik uret'.tr),
                      ),
                      SwitchListTile(
                        value: parentNotifications,
                        onChanged: (value) =>
                            setState(() => parentNotifications = value),
                        title: Text('Velilere toplu bildirim akışı'.tr),
                      ),
                      SwitchListTile(
                        value: financeApprovals,
                        onChanged: (value) =>
                            setState(() => financeApprovals = value),
                        title: Text('Finans onaylari için ikinci kontrol'.tr),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                // Sözleşme & Formlar: kurumun PDF belgeleri yüklenir ve
                // öğrenci seçilip imza tabletine gönderilir.
                AdminPanel(
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.assignment_outlined),
                    title: Text('Sözleşme & Formlar'.tr),
                    subtitle: Text(
                      'Sözleşme/izin PDF\'i yükleyin, öğrenci seçip tablette '
                              'imzalatın.'
                          .tr,
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => const SchoolContractFormsPage(),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                // İmza istasyonu: tablet bu ekranda bırakılır (rehberli erişim /
                // kiosk modu önerilir) ve personelin gönderdiği formları alır.
                AdminPanel(
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.draw_outlined),
                    title: Text('İmza İstasyonu'.tr),
                    subtitle: Text(
                      'Bu cihazı imza tableti yap: personelin gönderdiği onam '
                              'formları burada imzalanır.'
                          .tr,
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => const ConsentStationPage(),
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _field(String label, TextEditingController controller) {
    return TextField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
    );
  }
}
