import 'package:flutter/material.dart';

import 'package:student/i18n/app_locale.dart';
import 'admin_branch_comparison_page.dart';
import 'admin_class_management_page.dart';
import 'admin_exam_results_page.dart';
import 'admin_finance_page.dart';
import 'admin_personnel_approvals_page.dart';
import 'admin_schedule_list_page.dart';
import 'admin_staff_list_page.dart';
import 'admin_workflow_hub_page.dart';
import 'administrative_documents_page.dart';
import 'counselor_appointments_page.dart';
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
import 'library_manage_page.dart';
import 'password_reset_requests_page.dart';
import 'service_routes_page.dart';
import 'admin_passive_records_page.dart';
import 'support_page.dart';
import 'attendance_overview_page.dart';
import 'teacher_exam_results_page.dart';
import 'teacher_question_box_page.dart';
import 'teacher_reports_page.dart';
import '../pages/accounting_home_page.dart';
import '../pages/accounting_installments_page.dart';
import '../pages/accounting_overdue_page.dart';
import '../services/accounting_finance_store.dart';
import '../services/admin_workflow_api_service.dart';
import '../widgets/admin_ui.dart';
import '../widgets/responsive_layout.dart';

class AdminHomePage extends StatefulWidget {
  const AdminHomePage({super.key});

  @override
  State<AdminHomePage> createState() => _AdminHomePageState();
}

class _AdminHomePageState extends State<AdminHomePage> {
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

  // Kurum sahibi KPI'ları: masaüstü paneliyle AYNI uçtan gelir; kurumun
  // paketinde/rolde olmayan sayaç null döner ve kartı hiç çizilmez.
  Map<String, dynamic> _kpis = const {};
  List<Map<String, dynamic>> _dashboardAlerts = const [];

  @override
  void initState() {
    super.initState();
    // Öğrenci/personel/yoklama listeleri artık burada ÇEKİLMEZ: sayaçlar tek
    // uçtan (getDashboard) sunucuda hesaplanır, listeler açılan sayfada yüklenir.
    _finance.addListener(_refresh);
    _finance.loadDashboard();
    _loadAnalytics();
    _loadDashboard();
  }

  /// Seçili dönemi [from, to) aralığına çevirir (bitiş HARİÇ — backend böyle bekler).
  (String, String) _range() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final start = switch (_period) {
      'week' => today.subtract(const Duration(days: 6)),
      'month' => DateTime(today.year, today.month - 1, today.day),
      'year' => DateTime(today.year - 1, today.month, today.day),
      _ => today,
    };
    final end = today.add(const Duration(days: 1));
    return (start.toUtc().toIso8601String(), end.toUtc().toIso8601String());
  }

  Future<void> _loadDashboard() async {
    try {
      final (from, to) = _range();
      final result = await AdminWorkflowApiService.instance.getDashboard(
        from: from,
        to: to,
      );
      if (!mounted) return;
      setState(() {
        _kpis = Map<String, dynamic>.from(result['kpis'] as Map? ?? const {});
        _dashboardAlerts = (result['alerts'] as List<dynamic>? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _kpis = const {};
        _dashboardAlerts = const [];
      });
    }
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
    _finance.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  String _periodCaption() => switch (_period) {
    'week' => 'Son 7 gün',
    'month' => 'Son 1 ay',
    'year' => 'Son 1 yıl',
    _ => 'Bugün',
  };

  String _money(num value) => '₺${value.round()}';

  /// Kurum sahibinin görmesi gereken tüm sayaçlar — masaüstü panosuyla aynı sıra.
  /// Değeri null gelen (modül kapalı / yetki yok) kart listeye hiç girmez.
  List<_Kpi> _buildKpis(BuildContext context) {
    final period = _periodCaption();
    final items = <_Kpi>[];

    void add(
      String key,
      String label,
      IconData icon,
      Color color,
      String caption,
      Widget Function() page, {
      bool money = false,
      bool percent = false,
    }) {
      final raw = _kpis[key];
      if (raw == null) return;
      final value = money
          ? _money(raw as num)
          : percent
          ? '%${(raw as num).round()}'
          : '$raw';
      items.add(
        _Kpi(label, value, caption, icon, color, () {
          Navigator.push(context, MaterialPageRoute(builder: (_) => page()));
        }),
      );
    }

    const brand = Color(0xFF2563EB);
    const green = Color(0xFF059669);
    const teal = Color(0xFF0F766E);
    const violet = Color(0xFF7C3AED);
    const amber = Color(0xFFB45309);
    const red = Color(0xFFB42318);

    add('activeStudents', 'Aktif Öğrenci', Icons.school_outlined, brand,
        'Kayıtlı ve aktif öğrenci', () => const AdminStudentsPage());
    add('activeTeachers', 'Öğretmen', Icons.person_search_outlined, green,
        'Derse giren öğretmen', () => const AdminStaffListPage());
    add('activeStaff', 'Toplam Personel', Icons.badge_outlined, teal,
        'Aktif kadro', () => const AdminStaffListPage());
    add('activeClasses', 'Aktif Sınıf', Icons.meeting_room_outlined, violet,
        'Öğrencisi olan sınıf', () => const AdminClassManagementPage());
    add('todayLessons', 'Bugünkü Ders', Icons.calendar_today_outlined, brand,
        'Programdaki ders saati', () => const AdminScheduleListPage());
    add('newRegistrations', 'Yeni Kayıt', Icons.person_add_alt_1_outlined, green,
        period, () => const AdminStudentsPage());
    add('todayAbsent', 'Bugün Devamsız', Icons.warning_amber_rounded, red,
        'Derse gelmeyen öğrenci', () => const AttendanceOverviewPage());
    add('attendanceRate', 'Devam Oranı', Icons.fact_check_outlined, green,
        period, () => const AttendanceOverviewPage(), percent: true);
    add('upcomingExams', 'Yaklaşan Sınav', Icons.event_available_outlined, brand,
        '30 gün içinde planlı', () => const AdminExamResultsPage());
    add('pendingQuestions', 'Cevap Bekleyen Soru', Icons.help_outline_rounded,
        amber, 'Öğretmen yanıtı bekliyor', () => const QuestionBoxPage());
    add('unreadMessages', 'Okunmamış Mesaj', Icons.chat_bubble_outline_rounded,
        violet, 'Size gelen yanıtsız mesaj', () => const AdminMessagesPage());
    add('pendingMeetings', 'Görüşme Talebi', Icons.calendar_month_outlined,
        amber, 'Veli görüşmesi bekliyor', () => const AdminMeetingOverviewPage());
    add('pendingApprovals', 'Bekleyen Onay', Icons.verified_user_outlined, amber,
        'Yönetici kararı bekliyor', () => const AdminPersonnelApprovalsPage());
    add('pendingLeaves', 'Bekleyen İzin', Icons.event_busy_outlined, amber,
        'Personel izin talebi', () => const AdminWorkflowHubPage());
    add('todayOnLeave', 'Bugün İzinli', Icons.person_off_outlined, teal,
        'İzindeki personel', () => const AdminWorkflowHubPage());
    add('overdueTasks', 'Geciken Görev', Icons.assignment_late_outlined, red,
        'Teslim tarihi geçti', () => const AdminTaskCenterPage());
    add('openTasks', 'Açık Görev', Icons.playlist_add_check_circle_outlined,
        brand, 'Devam eden görev', () => const AdminTaskCenterPage());
    add('expiringDocuments', 'Süresi Dolan Belge', Icons.description_outlined,
        amber, '30 gün içinde geçersiz', () => const AdministrativeDocumentsPage());
    add('passwordResetRequests', 'Şifre Talebi', Icons.key_outlined, amber,
        'Sıfırlama onayı bekliyor', () => const PasswordResetRequestsPage());
    add('collections', 'Tahsilat', Icons.payments_outlined, green, period,
        () => const AccountingHomePage(), money: true);
    add('expenses', 'Gider', Icons.trending_down_rounded, red, period,
        () => const AdminFinancePage(), money: true);
    add('net', 'Net (Tahsilat − Gider)', Icons.account_balance_wallet_outlined,
        brand, period, () => const AccountingHomePage(), money: true);
    add('overdueInstallmentAmount', 'Geciken Ödeme', Icons.report_gmailerrorred_outlined,
        red, '${_kpis['overdueInstallments'] ?? 0} vadesi geçmiş taksit',
        () => const AccountingOverduePage(), money: true);
    add('pendingInstallmentAmount', 'Bekleyen Taksit', Icons.pending_actions_rounded,
        amber, '${_kpis['pendingInstallments'] ?? 0} ödenmemiş taksit',
        () => const AccountingInstallmentsPage(), money: true);
    add('overdueLoans', 'Gecikmiş Kitap', Icons.menu_book_outlined, amber,
        'İade tarihi geçti', () => const LibraryManagePage());
    add('pendingGuidance', 'Rehberlik Talebi', Icons.psychology_outlined, violet,
        'Randevu onayı bekliyor', () => const CounselorAppointmentsPage());
    add('activeServiceRoutes', 'Aktif Servis Rotası',
        Icons.directions_bus_filled_outlined, teal, 'Kullanımdaki rota',
        () => const ServiceRoutesPage());
    add('activeAnnouncements', 'Duyuru', Icons.campaign_outlined, brand,
        'Yayındaki duyuru', () => const AdminAnnouncementsPage());
    add('passiveAccounts', 'Pasif Kayıt', Icons.inventory_2_outlined, red,
        'Arşivdeki hesap', () => const AdminPassiveRecordsPage());

    return items;
  }

  @override
  Widget build(BuildContext context) {
    final pendingApprovals = _finance.approvals
        .where((item) => item.status == 'Bekliyor')
        .length;
    final kpis = _buildKpis(context);

    return AdminScaffold(
      appBar: AppBar(
        title: Text(
          'Yönetici Paneli'.tr,
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
              if (kpis.isEmpty)
                AdminPanel(
                  child: Text(
                    'Kurum özeti yüklenemedi.'.tr,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                )
              else
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: kpis.map((kpi) => _kpiCard(context, kpi)).toList(),
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
              if (_dashboardAlerts.isEmpty)
                AdminPanel(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: const Color(0xFF059669).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(
                          Icons.verified_rounded,
                          color: Color(0xFF059669),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Müdahale gerektiren bir durum yok'.tr,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                    ],
                  ),
                )
              else
                ..._dashboardAlerts.map((item) {
                  final critical = item['severity'] == 'Critical';
                  final color = critical
                      ? const Color(0xFFB42318)
                      : const Color(0xFFB45309);
                  return AdminPanel(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Icon(
                            Icons.priority_high_rounded,
                            color: color,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${item['title'] ?? ''}',
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(fontWeight: FontWeight.w800),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${item['message'] ?? ''}',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                }),
            ],
          ),
        ),
      ),
    );
  }

  // Masaüstü panosundaki KPI kartının mobil karşılığı: her kart tıklanabilir ve
  // ilgili yönetim sayfasını açar.
  Widget _kpiCard(BuildContext context, _Kpi kpi) {
    final width = ResponsiveLayout.itemWidth(
      context,
      spacing: 12,
      phone: 2,
      tablet: 3,
      largeTablet: 5,
    );
    return SizedBox(
      width: width,
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: kpi.onTap,
        child: AdminPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      kpi.label.tr,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: kpi.color,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: kpi.color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(kpi.icon, color: kpi.color, size: 18),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                kpi.value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                kpi.caption.tr,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
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
                  // Dönemsel KPI'lar (yeni kayıt, devam oranı, tahsilat, gider)
                  // aynı seçime bağlıdır; grafikle birlikte tazelenir.
                  _loadDashboard();
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

class _Kpi {
  final String label;
  final String value;
  final String caption;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  _Kpi(this.label, this.value, this.caption, this.icon, this.color, this.onTap);
}
