import 'package:flutter/material.dart';

import 'admin_branch_comparison_page.dart';
import 'admin_global_search_page.dart';
import 'admin_kpi_dashboard_page.dart';
import 'admin_announcements_page.dart';
import 'admin_messages_page.dart';
import 'admin_meeting_overview_page.dart';
import 'admin_role_management_page.dart';
import 'admin_students_page.dart';
import 'admin_task_center_page.dart';
import 'support_page.dart';
import 'attendance_overview_page.dart';
import 'teacher_exam_results_page.dart';
import 'teacher_reports_page.dart';
import '../pages/accounting_home_page.dart';
import '../pages/accounting_overdue_page.dart';
import '../services/accounting_finance_store.dart';
import '../services/attendance_service.dart';
import '../services/school_feed_api_service.dart';
import '../services/staff_registry_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';
import '../widgets/responsive_layout.dart';

class AdminHomePage extends StatefulWidget {
  const AdminHomePage({super.key});

  @override
  State<AdminHomePage> createState() => _AdminHomePageState();
}

class _AdminHomePageState extends State<AdminHomePage> {
  final _students = StudentRegistryStore.instance;
  final _staff = StaffRegistryStore.instance;
  final _finance = AccountingFinanceStore.instance;
  List<AnnouncementFeedItem> _announcements = const [];

  @override
  void initState() {
    super.initState();
    _students.addListener(_refresh);
    _staff.addListener(_refresh);
    _finance.addListener(_refresh);
    _students.ensureLoaded();
    _staff.ensureLoaded();
    _finance.loadDashboard();
    AttendanceService.instance.refresh();
    _loadAnnouncements();
  }

  @override
  void dispose() {
    _students.removeListener(_refresh);
    _staff.removeListener(_refresh);
    _finance.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  Future<void> _loadAnnouncements() async {
    try {
      final items = await SchoolFeedApiService.instance.fetchAnnouncements(
        audience: 'Tüm Kurum',
        includeAll: true,
      );
      if (!mounted) return;
      setState(() {
        _announcements = items;
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final teacherCount = _staff.teachers
        .where((item) => item.status == 'Active' || item.status == 'Aktif')
        .length;
    final pendingApprovals = _finance.approvals
        .where((item) => item.status == 'Bekliyor')
        .length;
    final criticalAlerts =
        _finance.installments.where((item) => item.status == 'Geciken').length +
        AttendanceService.instance
            .all()
            .where((item) => item.status == 'Devamsiz')
            .length;

    final metrics = [
      _Metric(
        'Toplam Öğrenci',
        '${_students.students.length}',
        const Color(0xFF2563EB),
        Icons.school_outlined,
      ),
      _Metric(
        'Aktif Öğretmen',
        '$teacherCount',
        const Color(0xFF14532D),
        Icons.person_search_outlined,
      ),
      _Metric(
        'Açık Tahsilat',
        _finance.formatAmount(_finance.pendingTotal + _finance.overdueTotal),
        const Color(0xFFB45309),
        Icons.payments_outlined,
      ),
      _Metric(
        'Kritik Uyarı',
        '$criticalAlerts',
        const Color(0xFFB42318),
        Icons.warning_amber_rounded,
      ),
    ];

    final alerts = [
      (
        '${AttendanceService.instance.all().where((item) => item.status == 'Devamsiz').length} devamsızlık kaydı izleniyor',
        'Akademik risk',
        const Color(0xFFB45309),
      ),
      (
        '$pendingApprovals finans onayi bekliyor',
        'Finans akışı',
        const Color(0xFF2563EB),
      ),
      (
        '${_announcements.length} duyuru merkezde görünür',
        'Duyuru akışı',
        const Color(0xFF14532D),
      ),
    ];

    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Yönetici Paneli',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const AdminAnnouncementsPage()),
            ),
            icon: const Icon(Icons.campaign_outlined),
          ),
        ],
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: ResponsiveContent(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AdminHeroCard(
                eyebrow: 'Kurumsal kontrol merkezi',
                title:
                    'Akademik başarı, finans sağlığı ve operasyonel işleyiş tek yönetiçi ekranında.',
                description:
                    'Kurum genelinde riskleri, büyüme alanlarını ve kritik süreçleri aynı panelden yönetin.',
                metrics: [
                  AdminHeroMetric(
                    label: 'Bugün',
                    value: '${_finance.auditLogs.take(5).length} aksiyon',
                  ),
                  AdminHeroMetric(
                    label: 'Onay Bekleyen',
                    value: '$pendingApprovals süreç',
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: metrics
                    .map((metric) => _metricCard(context, metric))
                    .toList(),
              ),
              const SizedBox(height: 18),
              const AdminSectionTitle(title: 'Hızlı Yönetici Erişimleri'),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _quickCard(
                      context,
                      title: 'Akademik Rapor',
                      subtitle: 'Sınıf ve branş trendleri',
                      color: const Color(0xFF2563EB),
                      icon: Icons.bar_chart_rounded,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const TeacherReportsPage(),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _quickCard(
                      context,
                      title: 'Finans Paneli',
                      subtitle: 'Tahsilat ve onay akışı',
                      color: const Color(0xFF14532D),
                      icon: Icons.account_balance_wallet_outlined,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AccountingHomePage(),
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
                    child: _quickCard(
                      context,
                      title: 'Görüşme Akışı',
                      subtitle: 'Veli talepleri ve onaylar',
                      color: const Color(0xFF0F766E),
                      icon: Icons.calendar_month_outlined,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AdminMeetingOverviewPage(),
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
                    child: _quickCard(
                      context,
                      title: 'Sınav Sonuçları',
                      subtitle: 'Kurumsal deneme görünümü',
                      color: const Color(0xFF7C3AED),
                      icon: Icons.fact_check_outlined,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const TeacherExamResultsPage(
                            exam: {
                              'title': 'Genel Deneme Sonuç Özeti',
                              'className': 'Tüm Kurum',
                              'date': 'Mart 2026',
                            },
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _quickCard(
                      context,
                      title: 'Geciken Ödemeler',
                      subtitle: 'Riskli finans kayıtları',
                      color: const Color(0xFFB42318),
                      icon: Icons.warning_amber_rounded,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AccountingOverduePage(),
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
                    child: _quickCard(
                      context,
                      title: 'Mesaj Merkezi',
                      subtitle: 'Tüm birimlerle hızlı iletişim',
                      color: const Color(0xFF14532D),
                      icon: Icons.chat_bubble_outline_rounded,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AdminMessagesPage(),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _quickCard(
                      context,
                      title: 'Duyurular',
                      subtitle: 'Tüm paylaşımları tek merkezde gör',
                      color: const Color(0xFFB45309),
                      icon: Icons.campaign_outlined,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AdminAnnouncementsPage(),
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
                    child: _quickCard(
                      context,
                      title: 'Devamsızlık',
                      subtitle: 'Tüm şube yoklama akışı',
                      color: const Color(0xFFB42318),
                      icon: Icons.fact_check_outlined,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AttendanceOverviewPage(),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _quickCard(
                      context,
                      title: 'Global Arama',
                      subtitle: 'Öğrenci, veli ve kadro arama',
                      color: const Color(0xFF2563EB),
                      icon: Icons.manage_search_rounded,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AdminGlobalSearchPage(),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _quickCard(
                      context,
                      title: 'Şube Karşılaştırma',
                      subtitle: 'Kampüs performans özeti',
                      color: const Color(0xFF14532D),
                      icon: Icons.apartment_outlined,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AdminBranchComparisonPage(),
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
                    child: _quickCard(
                      context,
                      title: 'Rol Yönetimi',
                      subtitle: 'Yetki ve erişim kontrolü',
                      color: const Color(0xFF7C3AED),
                      icon: Icons.admin_panel_settings_outlined,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AdminRoleManagementPage(),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _quickCard(
                      context,
                      title: 'Canlı Görev',
                      subtitle: 'Bekleyen süreçler ve aksiyonlar',
                      color: const Color(0xFFB45309),
                      icon: Icons.playlist_add_check_circle_outlined,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AdminTaskCenterPage(),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _quickCard(
                context,
                title: 'KPI Dashboard',
                subtitle:
                    'Doluluk, tahsilat, devamsızlık ve başarı göstergeleri',
                color: const Color(0xFF0F766E),
                icon: Icons.insights_outlined,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const AdminKpiDashboardPage(),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              _quickCard(
                context,
                title: 'Destek',
                subtitle: 'CourseIntellect ekibine talep aç',
                color: const Color(0xFFD9790B),
                icon: Icons.support_agent_outlined,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const SupportPage(),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              const AdminSectionTitle(title: 'Öncelikli Uyarılar'),
              const SizedBox(height: 12),
              ...alerts.map(
                (item) => AdminPanel(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: item.$3.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Icon(
                          Icons.priority_high_rounded,
                          color: item.$3,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.$1,
                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item.$2,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _metricCard(BuildContext context, _Metric metric) {
    final width = ResponsiveLayout.itemWidth(
      context,
      spacing: 12,
      phone: 1,
      tablet: 2,
      largeTablet: 4,
    );
    return SizedBox(
      width: width,
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: () {
          if (metric.title == 'Toplam Öğrenci') {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const AdminStudentsPage()),
            );
            return;
          }

          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('${metric.title} detay görünümü hazırlanıyor.'),
              behavior: SnackBarBehavior.floating,
            ),
          );
        },
        child: AdminPanel(
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: metric.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(metric.icon, color: metric.color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      metric.title,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: metric.color,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      metric.value,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _quickCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required Color color,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: onTap,
      child: AdminPanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(height: 1.35),
            ),
          ],
        ),
      ),
    );
  }
}

class _Metric {
  final String title;
  final String value;
  final Color color;
  final IconData icon;

  _Metric(this.title, this.value, this.color, this.icon);
}
