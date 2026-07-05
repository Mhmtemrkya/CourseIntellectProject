import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import '../services/admin_workflow_api_service.dart';
import '../services/school_feed_api_service.dart';
import '../services/staff_registry_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';
import 'admin_announcements_page.dart';
import 'admin_staff_registration_page.dart';
import 'admin_student_registration_page.dart';

class AdminAdministrativeUnitsPage extends StatefulWidget {
  const AdminAdministrativeUnitsPage({super.key});

  @override
  State<AdminAdministrativeUnitsPage> createState() =>
      _AdminAdministrativeUnitsPageState();
}

class _AdminAdministrativeUnitsPageState
    extends State<AdminAdministrativeUnitsPage> {
  final _store = StudentRegistryStore.instance;
  final _staffStore = StaffRegistryStore.instance;

  List<Map<String, dynamic>> _documents = const [];
  Map<String, dynamic> _overview = const {};
  List<AnnouncementFeedItem> _announcements = const [];

  @override
  void initState() {
    super.initState();
    _store.addListener(_refresh);
    _staffStore.addListener(_refresh);
    _store.ensureLoaded();
    _staffStore.ensureLoaded();
    _loadAdministrative();
  }

  @override
  void dispose() {
    _store.removeListener(_refresh);
    _staffStore.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) {
      setState(() {});
    }
  }

  Future<void> _loadAdministrative() async {
    final results = await Future.wait([
      AdminWorkflowApiService.instance.getDocuments().catchError((_) => <Map<String, dynamic>>[]),
      AdminWorkflowApiService.instance.getOverview().catchError((_) => <String, dynamic>{}),
      SchoolFeedApiService.instance.fetchAnnouncements(audience: 'Tüm Kurum', includeAll: true).catchError((_) => <AnnouncementFeedItem>[]),
    ]);
    if (!mounted) return;
    setState(() {
      _documents = results[0] as List<Map<String, dynamic>>;
      _overview = results[1] as Map<String, dynamic>;
      _announcements = results[2] as List<AnnouncementFeedItem>;
    });
  }

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      appBar: AppBar(
        title: Text(
          'İdari Birimler'.tr,
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'İdari operasyon',
            title:
                'Kayıt, duyuru ve öğrenci evrak akışlarını tek merkezden yönetin.'.tr,
            description:
                'Yönetici birimi yeni öğrenci kaydı açabilir, kurumsal duyuru yayına alabilir ve son kayıtları anında izleyebilir.',
            colors: const [Color(0xFF0F172A), Color(0xFF0F766E)],
            metrics: [
              AdminHeroMetric(
                label: 'Kayıtlı Öğrenci'.tr,
                value: '${_store.students.length}',
              ),
              AdminHeroMetric(
                label: 'Kadro',
                value: '${_staffStore.staff.length} aktif profil',
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _actionCard(
                  context,
                  title: 'Yeni Öğrenci Kaydı'.tr,
                  subtitle: 'Tüm alanlarıyla kapsamlı kayıt aç'.tr,
                  icon: Icons.person_add_alt_1_outlined,
                  color: const Color(0xFF2563EB),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const AdminStudentRegistrationPage(),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionCard(
                  context,
                  title: 'Öğretmen / Personel'.tr,
                  subtitle: 'Kadro kaydı ve profil oluşturma'.tr,
                  icon: Icons.groups_2_outlined,
                  color: const Color(0xFF7C3AED),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const AdminStaffRegistrationPage(),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _actionCard(
                  context,
                  title: 'Duyuru Oluştur'.tr,
                  subtitle: 'Öğrenci, veli ve öğretmene yayınla'.tr,
                  icon: Icons.campaign_outlined,
                  color: const Color(0xFFB45309),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const AdminAnnouncementsPage(),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _actionCard(
                  context,
                  title: 'Şube Kaydı'.tr,
                  subtitle: 'Yeni şube/kampüs oluştur'.tr,
                  icon: Icons.apartment_outlined,
                  color: const Color(0xFF0EA5E9),
                  onTap: _openBranchDialog,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Belgeler'),
                const SizedBox(height: 12),
                if (_documents.isEmpty)
                  Text('Kayıtlı belge bulunamadı.'.tr)
                else
                  ..._documents.take(5).map(
                    (doc) => _infoRow(
                      context,
                      icon: Icons.description_outlined,
                      title: (doc['title'] ?? 'Belge').toString(),
                      detail: '${doc['category'] ?? 'Kategori yok'}${(doc['status'] ?? '').toString().isNotEmpty ? ' • ${doc['status']}' : ''}',
                      color: const Color(0xFF14532D),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AdminSectionTitle(title: 'İdari Özet'.tr),
                const SizedBox(height: 12),
                _infoRow(context, icon: Icons.verified_user_outlined, title: 'Bekleyen Onay', detail: '${_overview['pendingApprovals'] ?? 0} kayıt', color: const Color(0xFF2563EB)),
                _infoRow(context, icon: Icons.checklist_rtl_outlined, title: 'Açık Görev'.tr, detail: '${_overview['openTasks'] ?? 0} görev', color: const Color(0xFF7C3AED)),
                _infoRow(context, icon: Icons.warning_amber_rounded, title: 'Süresi Dolan Evrak'.tr, detail: '${_overview['expiringDocuments'] ?? 0} belge', color: const Color(0xFFB45309)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Son Duyurular'),
                const SizedBox(height: 12),
                if (_announcements.isEmpty)
                  Text('Yayınlanmış duyuru bulunamadı.'.tr)
                else
                  ..._announcements.take(5).map(
                    (item) => _infoRow(
                      context,
                      icon: Icons.campaign_outlined,
                      title: item.title,
                      detail: '${item.audience}${item.date.isNotEmpty ? ' • ${item.date}' : ''}',
                      color: const Color(0xFFB45309),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openBranchDialog() async {
    final nameController = TextEditingController();
    final managerController = TextEditingController();
    String unitType = 'Şube';
    final created = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: Text('Şube Kaydı'.tr),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController,
                  decoration: InputDecoration(labelText: 'Şube Adı'.tr, hintText: 'Örn: Merkez Şube'.tr),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: unitType,
                  decoration: InputDecoration(labelText: 'Tür'.tr),
                  items: [
                    DropdownMenuItem(value: 'Şube', child: Text('Şube'.tr)),
                    DropdownMenuItem(value: 'Kampüs', child: Text('Kampüs'.tr)),
                  ],
                  onChanged: (v) => setDialogState(() => unitType = v ?? 'Şube'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: managerController,
                  decoration: const InputDecoration(labelText: 'Sorumlu (opsiyonel)'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: Text('Vazgeç'.tr)),
            FilledButton(
              onPressed: () async {
                if (nameController.text.trim().isEmpty) return;
                try {
                  await AdminWorkflowApiService.instance.createOrgUnit(
                    name: nameController.text.trim(),
                    unitType: unitType,
                    managerName: managerController.text.trim().isEmpty ? null : managerController.text.trim(),
                  );
                  if (dialogContext.mounted) Navigator.pop(dialogContext, true);
                } catch (error) {
                  if (dialogContext.mounted) {
                    ScaffoldMessenger.of(dialogContext).showSnackBar(
                      SnackBar(content: Text('Şube oluşturulamadı: $error')),
                    );
                  }
                }
              },
              child: const Text('Kaydet'),
            ),
          ],
        ),
      ),
    );
    if (created == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Şube oluşturuldu.'.tr)),
      );
    }
  }

  Widget _infoRow(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String detail,
    required Color color,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: color.withValues(alpha: 0.12),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 2),
                Text(detail, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(24),
      onTap: onTap,
      child: AdminPanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(height: 1.4),
            ),
          ],
        ),
      ),
    );
  }

}
