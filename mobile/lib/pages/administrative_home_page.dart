import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../services/staff_registry_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';
import 'accounting_approvals_page.dart';
import 'admin_class_management_page.dart';
import 'admin_announcements_page.dart';
import 'admin_meeting_overview_page.dart';
import 'admin_operations_page.dart';
import 'admin_parent_registration_page.dart';
import 'admin_personnel_approvals_page.dart';
import 'admin_schedule_list_page.dart';
import 'admin_role_management_page.dart';
import 'admin_staff_registration_page.dart';
import 'admin_student_registration_page.dart';
import 'admin_students_page.dart';
import 'attendance_overview_page.dart';
import 'administrative_documents_page.dart';
import 'administrative_notifications_page.dart';

class AdministrativeHomePage extends StatefulWidget {
  const AdministrativeHomePage({super.key});

  @override
  State<AdministrativeHomePage> createState() => _AdministrativeHomePageState();
}

class _AdministrativeHomePageState extends State<AdministrativeHomePage> {
  final _studentStore = StudentRegistryStore.instance;
  final _staffStore = StaffRegistryStore.instance;
  final _financeStore = AccountingFinanceStore.instance;

  @override
  void initState() {
    super.initState();
    _studentStore.addListener(_refresh);
    _staffStore.addListener(_refresh);
    _financeStore.addListener(_refresh);
    _studentStore.ensureLoaded();
    _staffStore.ensureLoaded();
    _financeStore.loadDashboard();
  }

  @override
  void dispose() {
    _studentStore.removeListener(_refresh);
    _staffStore.removeListener(_refresh);
    _financeStore.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final todayStudents = _studentStore.students.take(4).toList();
    final activePersonnel = _staffStore.personnel.length;
    final pendingStudents = _studentStore.students
        .where((item) => item.status != 'Active' && item.status != 'Aktif')
        .length;
    final unreadNotifications = _financeStore.notifications
        .where((item) => item.unread)
        .length;
    final todayTasks = [
      (
        'Kayıt belgelerini tamamla',
        pendingStudents > 0
            ? '$pendingStudents öğrenci için durum ve belge kontrolü bekleniyor.'
            : 'Aktif kayıtların belge akışı sistemde güncel görünüyor.',
      ),
      (
        'Hoş geldinizz duyurusu yayınla',
        '${todayStudents.length} son kayıt için veli ve öğrenci bilgilendirmesi hazır.',
      ),
      (
        'Veli dönüşlerini gözden geçir',
        '$unreadNotifications okunmamis bildirim ve ${_staffStore.staff.length} kadro kaydı izleniyor.',
      ),
    ];

    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'İdari Panel',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'İdari operasyon',
            title:
                'Kayıt, evrak, duyuru ve iletişim akışlarını tek panelden yönetin.',
            description:
                'Öğrenci işleri, kurumsal duyurular, personel kaydı ve veli iletişimi idari birim panelinde aktif olarak yönetilir.',
            colors: const [Color(0xFF0F172A), Color(0xFF0F766E)],
            metrics: [
              AdminHeroMetric(
                label: 'Toplam Öğrenci',
                value: '${_studentStore.students.length}',
              ),
              AdminHeroMetric(
                label: 'Personel',
                value: '$activePersonnel aktif',
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _metricCard(
                  context,
                  icon: Icons.person_add_alt_1_outlined,
                  title: 'Yeni Kayıt',
                  value: 'Öğrenci ekle',
                  color: const Color(0xFF2563EB),
                  onTap: () => _openPage(const AdminStudentRegistrationPage()),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _metricCard(
                  context,
                  icon: Icons.badge_outlined,
                  title: 'Personel',
                  value: 'Kadro işlemleri',
                  color: const Color(0xFF7C3AED),
                  onTap: () => _openPage(const AdminStaffRegistrationPage()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _metricCard(
                  context,
                  icon: Icons.family_restroom_outlined,
                  title: 'Veli Kaydı',
                  value: 'Veli odaklı kayıt oluştur',
                  color: const Color(0xFF7C3AED),
                  onTap: () => _openPage(const AdminParentRegistrationPage()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _metricCard(
                  context,
                  icon: Icons.campaign_outlined,
                  title: 'Duyurular',
                  value: 'Yeni duyuru yayınla',
                  color: const Color(0xFFB45309),
                  onTap: () => _openPage(const AdminAnnouncementsPage()),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _metricCard(
                  context,
                  icon: Icons.admin_panel_settings_outlined,
                  title: 'Rol Yönetimi',
                  value: 'Yetki akışlarını yönet',
                  color: const Color(0xFF4F46E5),
                  onTap: () => _openPage(const AdminRoleManagementPage()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _metricCard(
                  context,
                  icon: Icons.groups_2_outlined,
                  title: 'Kayıt Listesi',
                  value: 'Tüm öğrencileri aç',
                  color: const Color(0xFF0F766E),
                  onTap: () => _openPage(const AdminStudentsPage()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _metricCard(
                  context,
                  icon: Icons.notifications_active_outlined,
                  title: 'Bildirimler',
                  value: 'İdari akışı aç',
                  color: const Color(0xFF0F766E),
                  onTap: () =>
                      _openPage(const AdministrativeNotificationsPage()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _metricCard(
                  context,
                  icon: Icons.folder_open_outlined,
                  title: 'Evrak Takibi',
                  value: 'Eksik dosyaları incele',
                  color: const Color(0xFFB45309),
                  onTap: () => _openPage(const AdministrativeDocumentsPage()),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _metricCard(
                  context,
                  icon: Icons.hub_outlined,
                  title: 'Operasyon',
                  value: 'Görev ve canlı akışı aç',
                  color: const Color(0xFF0F766E),
                  onTap: () => _openPage(const AdminOperationsPage()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _metricCard(
                  context,
                  icon: Icons.class_outlined,
                  title: 'Sınıf Ekle',
                  value: 'Yeni sınıf tanımı oluştur',
                  color: const Color(0xFF1D4ED8),
                  onTap: () => _openPage(const AdminClassManagementPage()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _metricCard(
                  context,
                  icon: Icons.verified_user_outlined,
                  title: 'Personel Onayları',
                  value: 'Bekleyen kadro talepleri',
                  color: const Color(0xFF7C3AED),
                  onTap: () => _openPage(const AdminPersonnelApprovalsPage()),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _metricCard(
                  context,
                  icon: Icons.payments_outlined,
                  title: 'Finans Onayları',
                  value: 'Muhasebe onay akışı',
                  color: const Color(0xFFB45309),
                  onTap: () => _openPage(
                    const AccountingApprovalsPage(
                      canApprove: true,
                      pageTitle: 'Finans Onayları',
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
                child: _metricCard(
                  context,
                  icon: Icons.forum_outlined,
                  title: 'Görüşme Akışı',
                  value: 'Veli talepleri ve onaylar',
                  color: const Color(0xFF2563EB),
                  onTap: () => _openPage(const AdminMeetingOverviewPage()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _metricCard(
                  context,
                  icon: Icons.fact_check_outlined,
                  title: 'Devamsızlık Paneli',
                  value: 'Tüm öğrencilerin günlük yoklamaları',
                  color: const Color(0xFFB42318),
                  onTap: () => _openPage(const AttendanceOverviewPage()),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _metricCard(
                  context,
                  icon: Icons.schedule_rounded,
                  title: 'Ders Programı',
                  value: 'Sınıf programlarını düzenle',
                  color: const Color(0xFF2563EB),
                  onTap: () => _openPage(const AdminScheduleListPage()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AdminSectionTitle(title: 'Bugünün İş Akışı'),
                const SizedBox(height: 12),
                ...todayTasks.map(
                  (item) => _taskTile(context, item.$1, item.$2),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AdminSectionTitle(
                  title: 'Son Öğrenci Kayıtları',
                  actionLabel: 'Tümünü Gör',
                  onAction: () => _openPage(const AdminStudentsPage()),
                ),
                const SizedBox(height: 12),
                ...todayStudents.map(
                  (student) => Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Theme.of(
                        context,
                      ).scaffoldBackgroundColor.withValues(alpha: 0.45),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          backgroundColor: const Color(
                            0xFF0F766E,
                          ).withValues(alpha: 0.12),
                          child: Text(
                            student.fullName.characters.first,
                            style: const TextStyle(
                              color: Color(0xFF0F766E),
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                student.fullName,
                                style: Theme.of(context).textTheme.titleSmall
                                    ?.copyWith(fontWeight: FontWeight.w800),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${student.className} • ${student.currentSchool}',
                              ),
                            ],
                          ),
                        ),
                        AdminAccentBadge(
                          label: student.status,
                          color: const Color(0xFF0F766E),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _metricCard(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String value,
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
            Text(value, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }

  Widget _taskTile(BuildContext context, String title, String detail) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(
          context,
        ).scaffoldBackgroundColor.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          const CircleAvatar(
            backgroundColor: Color(0xFFE0F2F1),
            foregroundColor: Color(0xFF0F766E),
            child: Icon(Icons.task_alt_rounded),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  detail,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _openPage(Widget page) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => page));
  }
}
