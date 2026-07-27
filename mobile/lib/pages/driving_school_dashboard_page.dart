import 'package:flutter/material.dart';
import '../i18n/app_locale.dart';
import '../services/driving_school_api_service.dart';
import '../widgets/driving_ui.dart';
import 'admin_finance_page.dart';
import 'admin_profile_page.dart';
import 'driving_collection_page.dart';
import 'driving_expenses_page.dart';
import 'driving_document_review_queue_page.dart';
import 'driving_education_page.dart';
import 'driving_graduation_page.dart';
import 'driving_mobile_planning_page.dart';
import 'driving_mebbis_work_center_page.dart';
import 'driving_mebbis_exam_results_page.dart';
import 'driving_mebbis_certificate_numbers_page.dart';
import 'driving_school_operations_page.dart';
import 'driving_term_opening_wizard_page.dart';
import 'driving_school_students_page.dart';
import 'driving_school_vehicles_page.dart';
import 'teacher_content_page.dart';
import 'teacher_question_bank_page.dart';

class DrivingSchoolDashboardPage extends StatefulWidget {
  const DrivingSchoolDashboardPage({super.key});
  @override
  State<DrivingSchoolDashboardPage> createState() =>
      _DrivingSchoolDashboardPageState();
}

class _DrivingSchoolDashboardPageState
    extends State<DrivingSchoolDashboardPage> {
  late Future<Map<String, dynamic>> _future;
  // Peşinatı beklenen sözleşmeler (dashboard payload'ında yok, ayrı finans ucu).
  List<Map<String, dynamic>> _pending = [];

  @override
  void initState() {
    super.initState();
    _future = DrivingSchoolApiService.instance.dashboard();
    _loadPending();
  }

  Future<void> _loadPending() async {
    try {
      final pending = await DrivingSchoolApiService.instance
          .pendingDownPayments();
      if (mounted) setState(() => _pending = pending);
    } catch (_) {
      if (mounted) setState(() => _pending = []);
    }
  }

  void _reload() {
    setState(() => _future = DrivingSchoolApiService.instance.dashboard());
    _loadPending();
  }

  String _pesinatTotal() {
    final total = _pending.fold<double>(
      0,
      (sum, r) => sum + ((r['downPayment'] as num?)?.toDouble() ?? 0),
    );
    return '₺${total.toStringAsFixed(0)}';
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<Map<String, dynamic>>(
    future: _future,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const Center(child: CircularProgressIndicator());
      }
      if (snapshot.hasError) {
        return DrivingErrorState(error: snapshot.error!, onRetry: _reload);
      }

      final data = snapshot.data!;
      final kpis = Map<String, dynamic>.from(data['kpis'] as Map? ?? const {});
      final charts = Map<String, dynamic>.from(
        data['charts'] as Map? ?? const {},
      );
      final series = (charts['monthlyRegistrations'] as List? ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      final alerts = (data['alerts'] as List? ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      final termAlerts = Map<String, dynamic>.from(
        data['termAlerts'] as Map? ?? const {},
      );
      final managerSummary = data['managerMebbisSummary'] == null
          ? null
          : Map<String, dynamic>.from(data['managerMebbisSummary'] as Map);
      final terms = (termAlerts['terms'] as List? ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      final accent = Theme.of(context).colorScheme.primary;

      return RefreshIndicator(
        onRefresh: () async => _reload(),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 18, 16, 6),
                child: DrivingHero(
                  eyebrow: 'Sürücü Kursu',
                  title: 'Operasyon Merkezi',
                  description:
                      'Kursiyer, ders, eğitmen ve filo operasyonlarının canlı özeti.',
                  metrics: [
                    DrivingHeroMetric(
                      label: 'Aktif Kursiyer',
                      value: '${kpis['activeStudents'] ?? 0}',
                    ),
                    DrivingHeroMetric(
                      label: 'Bugünkü Ders',
                      value: '${kpis['todayDrivingLessons'] ?? 0}',
                    ),
                  ],
                ),
              ),
            ),
            if (_pending.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
                  child: InkWell(
                    onTap: () => _openDashboardMetric(context, 'collections'),
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: Colors.amber.withValues(alpha: 0.45),
                        ),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.warning_amber_rounded,
                            color: Colors.orange,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${'Peşinat Bekleyenler'.tr} · ${_pending.length}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                Text(
                                  'Kayıtta peşinatı tahsil edilmemiş kursiyerler.'
                                      .tr,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey.shade600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            _pesinatTotal(),
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              color: Colors.orange,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.chevron_right_rounded,
                            color: Colors.orange,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            SliverToBoxAdapter(child: _quickActions(context)),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
              sliver: SliverGrid.count(
                crossAxisCount: drivingGridColumns(context),
                childAspectRatio: 1.25,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                children: [
                  DrivingKpiCard(
                    label: 'Aktif Kursiyer',
                    value: '${kpis['activeStudents'] ?? 0}',
                    icon: Icons.groups_rounded,
                    color: accent,
                    onTap: () => _openDashboardMetric(context, 'students'),
                  ),
                  DrivingKpiCard(
                    label: 'Mezun Kursiyer',
                    value: '${kpis['graduatedStudents'] ?? 0}',
                    icon: Icons.workspace_premium_rounded,
                    color: const Color(0xFF059669),
                    onTap: () => _openDashboardMetric(context, 'graduation'),
                  ),
                  DrivingKpiCard(
                    label: 'Direksiyon Dersi',
                    value: '${kpis['todayDrivingLessons'] ?? 0}',
                    icon: Icons.route_rounded,
                    color: const Color(0xFFF97316),
                    onTap: () => _openDashboardMetric(context, 'planning'),
                  ),
                  DrivingKpiCard(
                    label: 'Aktif Eğitmen',
                    value: '${kpis['activeInstructors'] ?? 0}',
                    icon: Icons.school_rounded,
                    color: const Color(0xFF10B981),
                    onTap: () => _openDashboardMetric(context, 'planning'),
                  ),
                  DrivingKpiCard(
                    label: 'Aktif Araç',
                    value: '${kpis['activeVehicles'] ?? 0}',
                    icon: Icons.directions_car_rounded,
                    color: const Color(0xFF06B6D4),
                    onTap: () => _openDashboardMetric(context, 'vehicles'),
                  ),
                  // "Eksik Evrak" kursiyer dosyasını, diğer ikisi ARAÇ evrakını ölçer.
                  // Önce her ikisi de araç sayısını gösteriyordu ve kursiyer dosyası
                  // eksik olsa bile 0 görünüyordu.
                  DrivingKpiCard(
                    label: 'Eksik Evrak',
                    value: '${kpis['studentsMissingDocuments'] ?? 0}',
                    icon: Icons.warning_amber_rounded,
                    color: const Color(0xFFF59E0B),
                    onTap: () => _openDashboardMetric(context, 'documents'),
                  ),
                  DrivingKpiCard(
                    label: 'Araç Evrakı Eksik',
                    value: '${kpis['missingDocuments'] ?? 0}',
                    icon: Icons.no_crash_rounded,
                    color: const Color(0xFFEF4444),
                    onTap: () => _openDashboardMetric(context, 'vehicles'),
                  ),
                  DrivingKpiCard(
                    label: 'Araç Evrakı Doluyor',
                    value: '${kpis['expiringDocuments'] ?? 0}',
                    icon: Icons.event_busy_rounded,
                    color: const Color(0xFFEAB308),
                    onTap: () => _openDashboardMetric(context, 'vehicles'),
                  ),
                  DrivingKpiCard(
                    label: 'Bugünkü Tahsilat',
                    value: '₺${kpis['todayCollections'] ?? 0}',
                    icon: Icons.payments_rounded,
                    color: const Color(0xFF16A34A),
                    onTap: () => _openDashboardMetric(context, 'collections'),
                  ),
                  DrivingKpiCard(
                    label:
                        'Bekleyen Taksitler · ${kpis['pendingInstallments'] ?? 0}',
                    value: '₺${kpis['pendingInstallmentAmount'] ?? 0}',
                    icon: Icons.pending_actions_rounded,
                    color: const Color(0xFFF59E0B),
                    onTap: () => _openDashboardMetric(context, 'finance'),
                  ),
                  DrivingKpiCard(
                    label: 'Bugünkü Gider',
                    value: '₺${kpis['todayExpenses'] ?? 0}',
                    icon: Icons.trending_down_rounded,
                    color: const Color(0xFFE11D48),
                    onTap: () => _openDashboardMetric(context, 'expenses'),
                  ),
                  DrivingKpiCard(
                    label: 'Net (Tahsilat − Gider)',
                    value: '₺${kpis['todayNet'] ?? 0}',
                    icon: Icons.account_balance_wallet_rounded,
                    color: const Color(0xFF2563EB),
                    onTap: () => _openDashboardMetric(context, 'expenses'),
                  ),
                  DrivingKpiCard(
                    label: 'Bakımdaki Araç',
                    value: '${kpis['vehiclesInMaintenance'] ?? 0}',
                    icon: Icons.build_rounded,
                    color: const Color(0xFFEF4444),
                    onTap: () => _openDashboardMetric(context, 'vehicles'),
                  ),
                  DrivingKpiCard(
                    label: 'Kritik Dönem',
                    value: '${kpis['termCriticalAlerts'] ?? 0}',
                    icon: Icons.crisis_alert_rounded,
                    color: const Color(0xFFDC2626),
                    onTap: () => _openDashboardMetric(context, 'terms'),
                  ),
                  DrivingKpiCard(
                    label: 'MEBBİS Girişi Bekleyen',
                    value: '${kpis['mebbisReadyNotEntered'] ?? 0}',
                    icon: Icons.pending_actions_rounded,
                    color: const Color(0xFFF59E0B),
                    onTap: () => _openDashboardMetric(context, 'mebbis'),
                  ),
                ],
              ),
            ),
            SliverToBoxAdapter(
              child: managerSummary == null
                  ? const SizedBox.shrink()
                  : DrivingPanel(
                      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                      padding: const EdgeInsets.all(18),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const DrivingSectionTitle(
                            title: 'Kurum Yöneticisi MEBBİS Özeti',
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Günlük operasyon ve son 7 günlük hata görünümü',
                            style: TextStyle(color: Colors.grey, fontSize: 12),
                          ),
                          const SizedBox(height: 14),
                          GridView.count(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            crossAxisCount: drivingGridColumns(context),
                            childAspectRatio: 1.2,
                            mainAxisSpacing: 10,
                            crossAxisSpacing: 10,
                            children: [
                              _managerCard(
                                context,
                                'Aktif dönem',
                                managerSummary['activeTermCount'],
                                Icons.calendar_month_rounded,
                                Colors.indigo,
                                'terms',
                              ),
                              _managerCard(
                                context,
                                'MEBBİS’e hazır',
                                managerSummary['mebbisReadyStudents'],
                                Icons.verified_rounded,
                                Colors.green,
                                'work',
                              ),
                              _managerCard(
                                context,
                                'Girişi bekleyen',
                                managerSummary['entryPendingCount'],
                                Icons.pending_actions_rounded,
                                Colors.blue,
                                'work',
                              ),
                              _managerCard(
                                context,
                                'Eksik evraklı',
                                managerSummary['missingDocumentStudents'],
                                Icons.folder_off_rounded,
                                Colors.orange,
                                'documents',
                              ),
                              _managerCard(
                                context,
                                'Son tarihi yaklaşan',
                                managerSummary['approachingDeadlineTerms'],
                                Icons.timer_rounded,
                                Colors.red,
                                'terms',
                              ),
                              _managerCard(
                                context,
                                'Sınav sonucu bekleyen',
                                managerSummary['pendingExamResults'],
                                Icons.fact_check_rounded,
                                Colors.purple,
                                'exams',
                              ),
                              _managerCard(
                                context,
                                'Sertifika no bekleyen',
                                managerSummary['certificatesWaiting'],
                                Icons.workspace_premium_rounded,
                                Colors.teal,
                                'certificates',
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'Bugün personel bazlı tamamlanan işlemler',
                            style: TextStyle(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 6),
                          if ((managerSummary['personnelCompletions']
                                      as List? ??
                                  const [])
                              .isEmpty)
                            const Text(
                              'Bugün tamamlanmış MEBBİS girişi veya doğrulaması yok.',
                              style: TextStyle(
                                color: Colors.grey,
                                fontSize: 13,
                              ),
                            )
                          else
                            ...(managerSummary['personnelCompletions'] as List)
                                .map((raw) {
                                  final person = Map<String, dynamic>.from(
                                    raw as Map,
                                  );
                                  return DrivingListRow(
                                    icon: Icons.person_outline_rounded,
                                    iconColor: Colors.green,
                                    title: '${person['name'] ?? 'Personel'}',
                                    subtitle:
                                        '${person['completedCount'] ?? 0} tamamlanan işlem',
                                    trailing: DrivingStatusPill(
                                      label: '${person['completedCount'] ?? 0}',
                                      tone: DrivingTone.success,
                                    ),
                                  );
                                }),
                        ],
                      ),
                    ),
            ),
            SliverToBoxAdapter(
              child: DrivingPanel(
                margin: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const DrivingSectionTitle(title: 'Operasyon Uyarıları'),
                    const SizedBox(height: 10),
                    if (alerts.isEmpty)
                      const DrivingEmptyState(
                        icon: Icons.verified_user_rounded,
                        title: 'Kritik uyarı yok',
                        message: 'Evrak, bakım ve çakışma kontrolleri güncel.',
                      )
                    else
                      ...alerts.map((alert) {
                        final critical = alert['severity'] == 'Critical';
                        return DrivingListRow(
                          icon: critical
                              ? Icons.error_rounded
                              : Icons.warning_amber_rounded,
                          iconColor: DrivingStatusPill.colorOf(
                            context,
                            critical ? DrivingTone.danger : DrivingTone.warning,
                          ),
                          title: '${alert['title']}',
                          subtitle: '${alert['message']}',
                          onTap: () =>
                              _openAlert(context, '${alert['actionPath']}'),
                          trailing: DrivingStatusPill(
                            label: critical ? 'Kritik' : 'Uyarı',
                            tone: critical
                                ? DrivingTone.danger
                                : DrivingTone.warning,
                          ),
                        );
                      }),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: DrivingPanel(
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const DrivingSectionTitle(title: 'Dönem ve MEBBİS Sağlığı'),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _summaryChip(
                          'MEBBİS eksiği',
                          termAlerts['missingMebbisCount'],
                          Colors.orange,
                        ),
                        _summaryChip(
                          'Sağlık raporu',
                          termAlerts['healthReportPendingCount'],
                          Colors.deepOrange,
                        ),
                        _summaryChip(
                          'Giriş bekleyen',
                          termAlerts['readyNotEnteredCount'],
                          Colors.blue,
                        ),
                        _summaryChip(
                          'Mutabakat farkı',
                          termAlerts['reconciliationMismatchCount'],
                          Colors.red,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    if (terms.isEmpty)
                      const DrivingEmptyState(
                        icon: Icons.event_available_rounded,
                        title: 'Aktif dönem bulunmuyor',
                        message:
                            'Dönem açma sihirbazından yeni dönem oluşturabilirsiniz.',
                      )
                    else
                      ...terms.map((term) {
                        final exceeded = term['capacityExceeded'] == true;
                        final remaining =
                            (term['remainingCapacity'] as num?)?.toInt() ?? 0;
                        final days = (term['daysToDeadline'] as num?)?.toInt();
                        return DrivingListRow(
                          icon: exceeded
                              ? Icons.group_off_rounded
                              : Icons.calendar_month_rounded,
                          iconColor: exceeded
                              ? Colors.red
                              : remaining <= 5
                              ? Colors.orange
                              : Colors.green,
                          title: '${term['name']}',
                          subtitle:
                              '${term['studentCount']}/${term['quota'] == 0 ? '∞' : term['quota']} kursiyer · ${days == null
                                  ? 'Son tarih yok'
                                  : days < 0
                                  ? 'Son tarih ${days.abs()} gün geçti'
                                  : 'Son tarihe $days gün'}\n${term['missingMebbisCount']} MEBBİS eksiği · ${term['readyNotEnteredCount']} giriş bekliyor',
                          trailing: const Icon(Icons.chevron_right_rounded),
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => DrivingSchoolStudentsPage(
                                initialGroupId: '${term['groupId']}',
                              ),
                            ),
                          ),
                        );
                      }),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: DrivingPanel(
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const DrivingSectionTitle(title: 'Aylık Yeni Kayıtlar'),
                    const SizedBox(height: 18),
                    DrivingBarChart(series: series),
                  ],
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      );
    },
  );

  // Alt menüde olmayan tüm ekranlara buradan tek dokunuşla gidilir. Alt menü
  // yalnız 4 günlük işlemi taşır; gerisi bu hızlı geçiş kartlarındadır.
  static Widget _quickActions(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final cols = width > 700
        ? 5
        : width > 480
        ? 4
        : 3;
    final actions = <Widget>[
      _quickAction(
        context,
        Icons.inventory_2_rounded,
        'Paketler',
        const Color(0xFF14B8A6),
        const DrivingSchoolOperationsPage(),
      ),
      _quickAction(
        context,
        Icons.directions_car_filled_rounded,
        'Araçlar',
        const Color(0xFFEA580C),
        const DrivingSchoolVehiclesPage(),
      ),
      _quickAction(
        context,
        Icons.school_rounded,
        'Eğitim & Sınav',
        const Color(0xFF7C3AED),
        const DrivingEducationPage(),
      ),
      _quickAction(
        context,
        Icons.workspace_premium_rounded,
        'Mezuniyet',
        const Color(0xFF16A34A),
        const DrivingGraduationPage(),
      ),
      _quickAction(
        context,
        Icons.fact_check_rounded,
        'MEBBİS',
        const Color(0xFF0284C7),
        const DrivingMebbisWorkCenterPage(),
      ),
      _quickAction(
        context,
        Icons.receipt_long_rounded,
        'Giderler',
        const Color(0xFFE11D48),
        const DrivingExpensesPage(),
      ),
      _quickAction(
        context,
        Icons.account_balance_wallet_rounded,
        'Finans',
        const Color(0xFF10B981),
        const AdminFinancePage(),
      ),
      _quickAction(
        context,
        Icons.menu_book_rounded,
        'Konu Anlatımı',
        const Color(0xFF8B5CF6),
        const TeacherContentPage(),
      ),
      _quickAction(
        context,
        Icons.quiz_rounded,
        'Soru Bankası',
        const Color(0xFF2563EB),
        const TeacherQuestionBankPage(),
      ),
      _quickAction(
        context,
        Icons.person_outline_rounded,
        'Profil',
        const Color(0xFF64748B),
        const AdminProfilePage(),
      ),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const DrivingSectionTitle(title: 'Hızlı İşlemler'),
          const SizedBox(height: 10),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: cols,
            childAspectRatio: 0.92,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            children: actions,
          ),
        ],
      ),
    );
  }

  static Widget _quickAction(
    BuildContext context,
    IconData icon,
    String label,
    Color color,
    Widget page,
  ) => InkWell(
    onTap: () => Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => page)),
    borderRadius: BorderRadius.circular(18),
    child: DrivingPanel(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(11),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    ),
  );

  static Widget _summaryChip(String label, dynamic raw, Color color) => Chip(
    avatar: CircleAvatar(
      backgroundColor: color.withValues(alpha: .14),
      child: Text(
        '${raw ?? 0}',
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w900,
        ),
      ),
    ),
    label: Text(label),
  );

  static Widget _managerCard(
    BuildContext context,
    String label,
    dynamic value,
    IconData icon,
    Color color,
    String destination,
  ) => DrivingKpiCard(
    label: label,
    value: '${value ?? 0}',
    icon: icon,
    color: color,
    onTap: () => _openManagerMetric(context, destination),
  );

  static void _openManagerMetric(BuildContext context, String destination) {
    final Widget page = switch (destination) {
      'terms' => const DrivingTermOpeningWizardPage(),
      'documents' => const DrivingDocumentReviewQueuePage(),
      'exams' => const DrivingMebbisExamResultsPage(),
      'certificates' => const DrivingMebbisCertificateNumbersPage(),
      _ => const DrivingMebbisWorkCenterPage(),
    };
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));
  }

  static void _openDashboardMetric(BuildContext context, String destination) {
    final Widget page = switch (destination) {
      'students' => const DrivingSchoolStudentsPage(),
      'planning' => const DrivingMobilePlanningPage(),
      'vehicles' => const DrivingSchoolVehiclesPage(),
      'documents' => const DrivingDocumentReviewQueuePage(),
      'collections' => const DrivingCollectionPage(),
      'finance' => const AdminFinancePage(),
      'expenses' => const DrivingExpensesPage(),
      'terms' => const DrivingTermOpeningWizardPage(),
      'education' => const DrivingEducationPage(),
      'graduation' => const DrivingGraduationPage(),
      _ => const DrivingMebbisWorkCenterPage(),
    };
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));
  }

  static void _openAlert(BuildContext context, String path) {
    final Widget? page = path.contains('/documents')
        ? const DrivingDocumentReviewQueuePage()
        : path.contains('/mebbis')
        ? const DrivingMebbisWorkCenterPage()
        : path.contains('/students')
        ? const DrivingSchoolStudentsPage()
        : null;
    if (page != null) {
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));
    }
  }
}
