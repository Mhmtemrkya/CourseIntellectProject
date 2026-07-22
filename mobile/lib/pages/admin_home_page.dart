import 'package:flutter/material.dart';
import '../features/assistant/presentation/assistant_page.dart';

import 'package:student/i18n/app_locale.dart';
import 'admin_branch_comparison_page.dart';
import 'admin_workflow_hub_page.dart';
import 'duties_board_page.dart';
import 'duty_create_page.dart';
import 'admin_global_search_page.dart';
import 'admin_kpi_dashboard_page.dart';
import 'admin_announcements_page.dart';
import 'admin_messages_page.dart';
import 'admin_meeting_overview_page.dart';
import 'admin_role_management_page.dart';
import 'admin_students_page.dart';
import 'admin_task_center_page.dart';
import 'service_routes_page.dart';
import 'admin_passive_records_page.dart';
import 'support_page.dart';
import 'attendance_overview_page.dart';
import 'teacher_exam_results_page.dart';
import 'teacher_reports_page.dart';
import '../pages/accounting_home_page.dart';
import '../pages/accounting_overdue_page.dart';
import '../services/accounting_finance_store.dart';
import '../services/admin_workflow_api_service.dart';
import '../services/attendance_service.dart';
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

  static const _periods = [
    ('day', 'Günlük'),
    ('week', 'Haftalık'),
    ('month', 'Aylık'),
    ('year', 'Yıllık'),
  ];
  String _period = 'week';
  List<Map<String, dynamic>> _buckets = const [];
  Map<String, dynamic> _totals = const {};
  int? _selectedBucket;

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
    _loadAnalytics();
  }

  Future<void> _loadAnalytics() async {
    try {
      final result = await AdminWorkflowApiService.instance.getAnalytics(period: _period);
      if (!mounted) return;
      setState(() {
        _buckets = (result['buckets'] as List<dynamic>? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _totals = Map<String, dynamic>.from(result['totals'] as Map? ?? const {});
        _selectedBucket = _buckets.isEmpty ? null : _buckets.length - 1;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _buckets = const [];
        _totals = const {};
      });
    }
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
        '$pendingApprovals finans onayi bekliyor',
        'Finans akışı',
        const Color(0xFF2563EB),
      ),
    ];

    return AdminScaffold(
      appBar: AppBar(
        title: Text(
          'Yönetici Paneli'.tr,
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            tooltip: 'SchoolAsist Asistan',
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AssistantPage())),
            icon: const Icon(Icons.auto_awesome_rounded),
          ),
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
                    'Akademik başarı, finans sağlığı ve operasyonel işleyiş tek yönetiçi ekranında.'.tr,
                description:
                    'Kurum genelinde riskleri, büyüme alanlarını ve kritik süreçleri aynı panelden yönetin.',
                metrics: [
                  AdminHeroMetric(
                    label: 'Bugün'.tr,
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
              AdminSectionTitle(title: 'Kazanç & Gider Eğrisi'.tr),
              const SizedBox(height: 12),
              _analyticsCard(context),
              const SizedBox(height: 18),
              AdminSectionTitle(title: 'Hızlı Yönetici Erişimleri'.tr),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _quickCard(
                      context,
                      title: 'Nöbet Oluştur'.tr,
                      subtitle: 'Öğretmenlere nöbet ata'.tr,
                      color: const Color(0xFFF97316),
                      icon: Icons.add_alarm_rounded,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const DutyCreatePage(),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _quickCard(
                      context,
                      title: 'Tüm Nöbetler'.tr,
                      subtitle: 'Çizelge, denge, boş günler'.tr,
                      color: const Color(0xFFF59E0B),
                      icon: Icons.shield_outlined,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const DutiesBoardPage(),
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
                      title: 'İdari Yönetim'.tr,
                      subtitle: 'Onay, izin, görev, evrak ve denetim'.tr,
                      color: const Color(0xFF7C3AED),
                      icon: Icons.verified_user_outlined,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AdminWorkflowHubPage(),
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
                      title: 'Servis Takip',
                      subtitle: 'Araç, rota, durak ve öğrenci atama'.tr,
                      color: const Color(0xFF0F766E),
                      icon: Icons.directions_bus_filled_outlined,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const ServiceRoutesPage(),
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
                      title: 'Pasif Kayıtlar'.tr,
                      subtitle: 'Pasif kişiler; buradan aktifleştir'.tr,
                      color: const Color(0xFF64748B),
                      icon: Icons.person_off_outlined,
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const AdminPassiveRecordsPage(),
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
                      title: 'Akademik Rapor',
                      subtitle: 'Sınıf ve branş trendleri'.tr,
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
                      subtitle: 'Tahsilat ve onay akışı'.tr,
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
                      title: 'Görüşme Akışı'.tr,
                      subtitle: 'Veli talepleri ve onaylar'.tr,
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
                      title: 'Sınav Sonuçları'.tr,
                      subtitle: 'Kurumsal deneme görünümü'.tr,
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
                      title: 'Geciken Ödemeler'.tr,
                      subtitle: 'Riskli finans kayıtları'.tr,
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
                      subtitle: 'Tüm birimlerle hızlı iletişim'.tr,
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
                      subtitle: 'Tüm paylaşımları tek merkezde gör'.tr,
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
                      title: 'Devamsızlık'.tr,
                      subtitle: 'Tüm şube yoklama akışı'.tr,
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
                      title: 'Kurum İçi Arama'.tr,
                      subtitle: 'Öğrenci, veli ve kadro arama'.tr,
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
                      title: 'Şube Karşılaştırma'.tr,
                      subtitle: 'Kampüs performans özeti'.tr,
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
                      title: 'Rol Yönetimi'.tr,
                      subtitle: 'Yetki ve erişim kontrolü'.tr,
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
                      title: 'Canlı Görev'.tr,
                      subtitle: 'Bekleyen süreçler ve aksiyonlar'.tr,
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
                title: 'Kurum Özeti'.tr,
                subtitle:
                    'Doluluk, tahsilat, devamsızlık ve başarı göstergeleri'.tr,
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
                subtitle: 'SchoolAsist ekibine talep aç'.tr,
                color: const Color(0xFFFF7A1A),
                icon: Icons.support_agent_outlined,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SupportPage()),
                ),
              ),
              const SizedBox(height: 18),
              AdminSectionTitle(title: 'Öncelikli Uyarılar'.tr),
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

  Widget _analyticsCard(BuildContext context) {
    final selected = (_selectedBucket != null && _selectedBucket! < _buckets.length)
        ? _buckets[_selectedBucket!]
        : (_buckets.isNotEmpty ? _buckets.last : null);
    num maxMoney = 1;
    for (final bucket in _buckets) {
      final r = (bucket['revenue'] as num?) ?? 0;
      final e = (bucket['expense'] as num?) ?? 0;
      if (r > maxMoney) maxMoney = r;
      if (e > maxMoney) maxMoney = e;
    }

    return AdminPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            children: _periods.map((p) {
              return ChoiceChip(
                label: Text(p.$2),
                selected: p.$1 == _period,
                onSelected: (_) {
                  setState(() => _period = p.$1);
                  _loadAnalytics();
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
          if (_buckets.isEmpty)
            Padding(
              padding: EdgeInsets.symmetric(vertical: 28),
              child: Center(child: Text('Seçilen dönem için veri bulunmuyor.'.tr)),
            )
          else ...[
            if (selected != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A).withValues(alpha: 0.04),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${selected['label']}',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 6),
                    _legendRow(const Color(0xFF16A34A), 'Kazanç', _finance.formatAmount(((selected['revenue'] as num?) ?? 0).round())),
                    _legendRow(const Color(0xFFDC2626), 'Gider', _finance.formatAmount(((selected['expense'] as num?) ?? 0).round())),
                    _legendRow(const Color(0xFF0EA5E9), 'Kayıt', '${selected['registrations'] ?? 0} öğrenci'),
                  ],
                ),
              ),
            const SizedBox(height: 12),
            SizedBox(
              height: 150,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: List.generate(_buckets.length, (index) {
                  final bucket = _buckets[index];
                  final revenue = ((bucket['revenue'] as num?) ?? 0).toDouble();
                  final expense = ((bucket['expense'] as num?) ?? 0).toDouble();
                  final active = (_selectedBucket ?? _buckets.length - 1) == index;
                  return Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _selectedBucket = index),
                      behavior: HitTestBehavior.opaque,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 1),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            Expanded(
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Expanded(child: _bar(revenue / maxMoney, const Color(0xFF16A34A), active)),
                                  const SizedBox(width: 2),
                                  Expanded(child: _bar(expense / maxMoney, const Color(0xFFDC2626), active)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _totalChip('Kazanç', _finance.formatAmount(((_totals['revenue'] as num?) ?? 0).round()), const Color(0xFF16A34A)),
                const SizedBox(width: 8),
                _totalChip('Gider', _finance.formatAmount(((_totals['expense'] as num?) ?? 0).round()), const Color(0xFFDC2626)),
                const SizedBox(width: 8),
                _totalChip('Kayıt', '${_totals['registrations'] ?? 0}', const Color(0xFF0EA5E9)),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _bar(double ratio, Color color, bool active) {
    final clamped = ratio.isFinite ? ratio.clamp(0.02, 1.0) : 0.02;
    return FractionallySizedBox(
      heightFactor: clamped,
      child: Container(
        decoration: BoxDecoration(
          color: color.withValues(alpha: active ? 1 : 0.55),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
        ),
      ),
    );
  }

  Widget _legendRow(Color color, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Row(
        children: [
          Container(width: 10, height: 10, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
          const SizedBox(width: 8),
          Text(label),
          const Spacer(),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _totalChip(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12)),
            const SizedBox(height: 2),
            Text(value, style: const TextStyle(fontWeight: FontWeight.w900), overflow: TextOverflow.ellipsis),
          ],
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
