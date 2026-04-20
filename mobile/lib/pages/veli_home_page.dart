import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../services/attendance_service.dart';
import '../services/linked_children_service.dart';
import '../services/meeting_request_store.dart';
import '../services/smart_insight_service.dart';
import '../services/teacher_weekly_report_api_service.dart';
import '../widgets/veli_header.dart';
import 'veli_children_dashboard_page.dart';
import 'veli_devamsizlik_page.dart';
import 'veli_duyurular_page.dart';
import 'veli_excuse_request_page.dart';
import 'veli_exam_results_page.dart';
import 'exam_analysis_page.dart';
import 'veli_mesajlar_page.dart';
import 'veli_meeting_request_page.dart';
import 'veli_odeme_page.dart';
import 'veli_online_odeme_page.dart';
import 'veli_receipt_archive_page.dart';
import 'veli_support_plan_page.dart';
import 'veli_teacher_feedback_page.dart';
import 'veli_weekly_report_page.dart';
import '../widgets/responsive_layout.dart';

class VeliHomePage extends StatefulWidget {
  const VeliHomePage({super.key});

  @override
  State<VeliHomePage> createState() => _VeliHomePageState();
}

class _VeliHomePageState extends State<VeliHomePage> {
  String _selectedChild = 'Öğrenci';
  List<LinkedChildRecord> _linkedChildren = const [];
  List<Map<String, dynamic>> _weeklySchedule = const [];
  List<TeacherWeeklyReportRecord> _teacherReports = const [];

  List<Map<String, dynamic>> get _riskAlerts {
    final analytics = SmartInsightService.instance.parentRiskAlerts(
      _selectedChild,
    );
    final colors = [
      const Color(0xFFB42318),
      const Color(0xFF1D4ED8),
      const Color(0xFFB54708),
    ];
    final icons = [
      Icons.trending_down_rounded,
      Icons.event_busy_rounded,
      Icons.receipt_long_outlined,
    ];
    return List.generate(
      analytics.length,
      (index) => {
        'title': analytics[index]['title'],
        'detail': analytics[index]['detail'],
        'color': colors[index % colors.length],
        'icon': icons[index % icons.length],
      },
    );
  }

  List<Map<String, String>> get _supportSuggestions {
    final attendance = AttendanceService.instance.forStudent(_selectedChild);
    final absentCount = attendance
        .where((item) => item.status == 'Devamsiz')
        .length;
    final lateCount = attendance.where((item) => item.status == 'Gec').length;
    final overdueCount = AccountingFinanceStore.instance.installments
        .where(
          (item) => item.student == _selectedChild && item.status == 'Geciken',
        )
        .length;
    return [
      {
        'title': 'Günlük tekrar saatini sabitleyin',
        'detail': lateCount > 0
            ? '$lateCount geç kalma kaydı var. Aksam rutininin sabitlenmesi faydali olabilir.'
            : 'Ders sonrası kisa tekrar rutini performans istikrarini korur.',
      },
      {
        'title': 'Yoklama hareketlerini haftalık izleyin',
        'detail': absentCount > 0
            ? '$absentCount devamsızlık kaydı sistemde görünüyor. Haftalık kontrol önerilir.'
            : 'Katılım düzenli; mevcut tempoyu korumak yeterli görünüyor.',
      },
      {
        'title': 'Finans ve rehberlik bildirimlerini takip edin',
        'detail': overdueCount > 0
            ? '$overdueCount geciken ödeme kaydı var. Veli panelinden detaylari kontrol edebilirsiniz.'
            : 'Ödeme ve görüşme tarafında su an kritik bir uyarı görünmüyor.',
      },
    ];
  }

  String get _preferredAdvisor {
    final childRequests = MeetingRequestStore.instance.requests
        .where((item) => item.studentName == _selectedChild)
        .toList();
    if (childRequests.isNotEmpty) {
      return childRequests.first.advisor;
    }
    return 'Öğretmen Destek Hattı';
  }

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await AccountingFinanceStore.instance.loadDashboard();
    _linkedChildren = await LinkedChildrenService.instance.loadLinkedChildren();
    await MeetingRequestStore.instance.ensureLoaded();
    if (_linkedChildren.isNotEmpty) {
      _selectedChild = _linkedChildren.first.fullName;
    }
    await AttendanceService.instance.refresh(studentName: _selectedChild);
    await _loadTeacherReports();
    _weeklySchedule = _buildWeeklySchedule();
    if (mounted) setState(() {});
  }

  Future<void> _loadTeacherReports() async {
    final linkedChild = _linkedChildren
        .where((item) => item.fullName == _selectedChild)
        .firstOrNull;
    if (linkedChild == null) {
      _teacherReports = const [];
      return;
    }

    try {
      _teacherReports = await TeacherWeeklyReportApiService.instance
          .fetchForParent(
            studentName: linkedChild.fullName,
            studentUsername: linkedChild.username,
            parentName: linkedChild.parentName,
            parentEmail: linkedChild.parentEmail,
          );
    } catch (_) {
      _teacherReports = const [];
    }
  }

  List<Map<String, dynamic>> _buildWeeklySchedule() {
    final attendance = AttendanceService.instance.forStudent(_selectedChild);
    final meetings = MeetingRequestStore.instance.requests
        .where((item) => item.studentName == _selectedChild)
        .toList();
    final items = <Map<String, dynamic>>[];

    if (attendance.isNotEmpty) {
      final latest = attendance.first;
      items.add({
        'time': 'Bugün',
        'title': '${latest.lesson} yoklama durumu',
        'subtitle': '${latest.status} • ${latest.className}',
        'type': 'Yoklama',
        'color': const Color(0xFF2563EB),
      });
    }

    for (final meeting in meetings.take(2)) {
      items.add({
        'time': meeting.slot,
        'title': '${meeting.advisor} görüşmesi',
        'subtitle': meeting.topic,
        'type': 'Görüşme',
        'color': const Color(0xFF7C3AED),
      });
    }

    if (items.isEmpty) {
      return const [
        {
          'time': 'Plan yok',
          'title': 'Takvim verisi bekleniyor',
          'subtitle':
              'Yeni yoklama veya görüşme kaydı olustugünda burada görünecek',
          'type': 'Bilgi',
          'color': Color(0xFF9E9E9E),
        },
      ];
    }

    return items;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            const VeliHeader(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                child: ResponsiveContent(
                  child: ResponsiveLayout.isTablet(context)
                      ? Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(child: _primaryColumn(context)),
                            const SizedBox(width: 20),
                            Expanded(child: _secondaryColumn(context)),
                          ],
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _childSelector(context),
                            const SizedBox(height: 18),
                            _primaryColumn(context),
                            const SizedBox(height: 18),
                            _secondaryColumn(context),
                          ],
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _primaryColumn(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle(
          context,
          title: 'Canlı akademik özet',
          actionLabel: 'Detaylar',
          onAction: _showAcademicSummary,
        ),
        const SizedBox(height: 12),
        _academicSnapshotCard(context),
        const SizedBox(height: 18),
        _sectionTitle(
          context,
          title: 'Risk bildirimi',
          actionLabel: 'Tümünü gör',
          onAction: _showRiskSummary,
        ),
        const SizedBox(height: 12),
        ..._riskAlerts.map(
          (alert) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _riskCard(context, alert),
          ),
        ),
        const SizedBox(height: 8),
        _sectionTitle(
          context,
          title: 'Haftalık veli raporu',
          actionLabel: 'Rapor aç',
          onAction: _openWeeklyReport,
        ),
        const SizedBox(height: 12),
        _weeklyReportCard(context),
        const SizedBox(height: 18),
        _sectionTitle(
          context,
          title: 'Öğretmenle hızlı iletişim',
          actionLabel: 'Mesajlar',
          onAction: () => _openPage(context, const VeliMesajlarPage()),
        ),
        const SizedBox(height: 12),
        _teacherCommunicationCard(context),
        const SizedBox(height: 18),
        _sectionTitle(
          context,
          title: 'Çalışma takibi',
          actionLabel: 'Ayrıntı',
          onAction: _showStudyTracking,
        ),
        const SizedBox(height: 12),
        _studyTrackingSection(context),
      ],
    );
  }

  Widget _secondaryColumn(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionTitle(
          context,
          title: 'Sınav ve ödev takvimi',
          actionLabel: 'Takvimi aç',
          onAction: _showScheduleSheet,
        ),
        const SizedBox(height: 12),
        _scheduleSection(context),
        const SizedBox(height: 18),
        _sectionTitle(
          context,
          title: 'Finans ve ödeme takibi',
          actionLabel: 'Ödemeler',
          onAction: () => _openPage(context, const VeliOdemePage()),
        ),
        const SizedBox(height: 12),
        _financeCard(context),
        const SizedBox(height: 18),
        _sectionTitle(
          context,
          title: 'Çocuk ve belge yönetimi',
          actionLabel: 'Dashboard',
          onAction: () => _openPage(context, const VeliChildrenDashboardPage()),
        ),
        const SizedBox(height: 12),
        _familyToolsSection(context),
        const SizedBox(height: 18),
        _sectionTitle(
          context,
          title: 'İzin ve devamsızlık bildirimi',
          actionLabel: 'Mazeret bildir',
          onAction: _openExcuseRequest,
        ),
        const SizedBox(height: 12),
        _attendanceCard(context),
        const SizedBox(height: 18),
        _sectionTitle(
          context,
          title: 'Belge merkezi',
          actionLabel: 'Belgeleri aç',
          onAction: _showDocumentsSheet,
        ),
        const SizedBox(height: 12),
        _documentSection(context),
        const SizedBox(height: 18),
        _sectionTitle(
          context,
          title: 'Veli için öneriler',
          actionLabel: 'Plan oluştur',
          onAction: () => _openRecommendationPlan(
            _supportSuggestions.first['title']!,
            _supportSuggestions.first['detail']!,
          ),
        ),
        const SizedBox(height: 12),
        ..._supportSuggestions.map(
          (suggestion) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _suggestionCard(context, suggestion),
          ),
        ),
      ],
    );
  }

  Widget _familyToolsSection(BuildContext context) {
    final latestAttendance = AttendanceService.instance
        .forStudent(_selectedChild)
        .firstOrNull;
    return Column(
      children: [
        _surface(
          context,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.notifications_active_outlined,
                    color: Color(0xFF2563EB),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Anlik yoklama bildirimi',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: () =>
                        _openPage(context, const VeliDevamsizlikPage()),
                    child: const Text('Devamsızlık'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                latestAttendance == null
                    ? 'Seçili öğrenci için henüz yoklama verisi bulunmuyor.'
                    : 'Son yoklama kaydına göre $_selectedChild ${latestAttendance.lesson} dersinde ${latestAttendance.status.toLowerCase()} olarak güncellendi.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _toolCard(
                context,
                title: 'Çocuk Dashboard',
                icon: Icons.family_restroom_outlined,
                color: const Color(0xFF2563EB),
                onTap: () =>
                    _openPage(context, const VeliChildrenDashboardPage()),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _toolCard(
                context,
                title: 'Makbuz Arsivi',
                icon: Icons.folder_copy_outlined,
                color: const Color(0xFF0F766E),
                onTap: () => _openPage(context, const VeliReceiptArchivePage()),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        _toolCard(
          context,
          title: 'Öğretmen Geri Bildirimleri',
          icon: Icons.feedback_outlined,
          color: const Color(0xFF7C3AED),
          onTap: () => _openPage(context, const VeliTeacherFeedbackPage()),
        ),
      ],
    );
  }

  Widget _toolCard(
    BuildContext context, {
    required String title,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: onTap,
      child: _surface(
        context,
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(
    BuildContext context, {
    required String title,
    required String actionLabel,
    required VoidCallback onAction,
  }) {
    final theme = Theme.of(context);

    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        TextButton(onPressed: onAction, child: Text(actionLabel)),
      ],
    );
  }

  Widget _academicSnapshotCard(BuildContext context) {
    final theme = Theme.of(context);
    final attendance = AttendanceService.instance.forStudent(_selectedChild);
    final absent = attendance.where((item) => item.status == 'Devamsiz').length;
    final late = attendance.where((item) => item.status == 'Gec').length;
    final attendanceRate = attendance.isEmpty
        ? 100
        : (((attendance.length - absent) / attendance.length) * 100).round();

    return _surface(
      context,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFDBEAFE),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.insights_rounded,
                  color: Color(0xFF2563EB),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _selectedChild.replaceAll('Yilmaz', 'Yılmaz'),
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${_classForChild(_selectedChild)} • Sayısal • Son güncelleme bugün',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.textTheme.bodySmall?.color?.withValues(
                          alpha: 0.7,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              FilledButton.tonalIcon(
                onPressed: () =>
                    _openPage(context, const VeliExamResultsPage()),
                icon: const Icon(Icons.analytics_outlined),
                label: const Text('Sonuçlar'),
              ),
              const SizedBox(width: 8),
              FilledButton.tonalIcon(
                onPressed: () => _openPage(context, const ExamAnalysisPage()),
                icon: const Icon(Icons.insights_rounded),
                label: const Text('Analiz'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _metricBox(
                  context,
                  title: 'Ortalama',
                  value: '${(84 - (absent * 2)).clamp(55, 100)}',
                  color: const Color(0xFF0F766E),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _metricBox(
                  context,
                  title: 'Haftalık katılım',
                  value: '%$attendanceRate',
                  color: const Color(0xFF7C3AED),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _metricBox(
                  context,
                  title: 'Eksik görev',
                  value: '${absent + late}',
                  color: const Color(0xFFB54708),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: theme.colorScheme.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.record_voice_over_rounded,
                  color: Color(0xFF2563EB),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Rehberlik notu: $_selectedChild için devam, görev ve sınav akışı birlikte izleniyor.',
                    style: theme.textTheme.bodyMedium?.copyWith(height: 1.4),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _riskCard(BuildContext context, Map<String, dynamic> alert) {
    return _surface(
      context,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: (alert['color'] as Color).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              alert['icon'] as IconData,
              color: alert['color'] as Color,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  alert['title'] as String,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  alert['detail'] as String,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(height: 1.4),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton(
                      onPressed: _openWeeklyReport,
                      child: const Text('Raporu Aç'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _weeklyReportCard(BuildContext context) {
    final attendance = AttendanceService.instance.forStudent(_selectedChild);
    final attended = attendance
        .where((item) => item.status == 'Katildi')
        .length;
    final attendanceRate = attendance.isEmpty
        ? 0
        : ((attended / attendance.length) * 100).round();
    final overdue = AccountingFinanceStore.instance.installments
        .where(
          (item) => item.student == _selectedChild && item.status == 'Geciken',
        )
        .length;
    return _surface(
      context,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Güncel veli raporu',
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              Chip(
                label: const Text('Hazır'),
                side: BorderSide.none,
                backgroundColor: const Color(0xFFD1FAE5),
                labelStyle: const TextStyle(color: Color(0xFF065F46)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _ReportLine(label: 'Katılım', value: '%$attendanceRate'),
          _ReportLine(
            label: 'Tamamlanan ders',
            value: '$attended / ${attendance.length}',
          ),
          _ReportLine(
            label: 'Finans durumu',
            value: overdue == 0 ? 'Dengede' : '$overdue uyarı',
          ),
          _ReportLine(
            label: 'Öğretmen raporu',
            value:
                _teacherReports.firstOrNull?.title ?? 'Yeni rapor bekleniyor',
          ),
          _ReportLine(
            label: 'Gönderilen rapor',
            value: _teacherReports.isEmpty
                ? 'Henüz yok'
                : '${_teacherReports.length} kayıt',
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: _openWeeklyReport,
                  icon: const Icon(Icons.picture_as_pdf_outlined),
                  label: const Text('PDF Görünümü'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () =>
                      _showInfoSnack('Rapor veli e-posta adresine gönderildi.'),
                  icon: const Icon(Icons.mail_outline_rounded),
                  label: const Text('E-posta Gönder'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _teacherCommunicationCard(BuildContext context) {
    final latestMeeting = MeetingRequestStore.instance.requests
        .where((item) => item.studentName == _selectedChild)
        .cast<MeetingRequestRecord?>()
        .firstOrNull;
    final advisor = latestMeeting?.advisor ?? _preferredAdvisor;
    final advisorSubtitle = latestMeeting == null
        ? 'Seçili öğrenci için aktif görüşme planı henüz yok'
        : '${latestMeeting.slot} • ${latestMeeting.status}';
    return _surface(
      context,
      child: Column(
        children: [
          _contactRow(
            context,
            title: advisor,
            subtitle: advisorSubtitle,
            icon: Icons.calculate_rounded,
            color: const Color(0xFF2563EB),
            onTap: () => _openPage(context, const VeliMesajlarPage()),
          ),
          const SizedBox(height: 10),
          _contactRow(
            context,
            title: 'Rehberlik Servisi',
            subtitle: latestMeeting == null
                ? 'Görüşme ve destek planları buradan yönetilir'
                : '${latestMeeting.topic} için destek kaydı var',
            icon: Icons.support_agent_rounded,
            color: const Color(0xFF7C3AED),
            onTap: () => _openMeetingRequest(_preferredAdvisor),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton.tonalIcon(
                onPressed: () => _openPage(context, const VeliMesajlarPage()),
                icon: const Icon(Icons.chat_bubble_outline_rounded),
                label: const Text('Mesaj Gönder'),
              ),
              FilledButton.tonalIcon(
                onPressed: () => _openMeetingRequest(_preferredAdvisor),
                icon: const Icon(Icons.video_call_outlined),
                label: const Text('Görüşme Talebi'),
              ),
              OutlinedButton.icon(
                onPressed: () => _openPage(context, const VeliDuyurularPage()),
                icon: const Icon(Icons.campaign_outlined),
                label: const Text('Duyurular'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _studyTrackingSection(BuildContext context) {
    final attendance = AttendanceService.instance.forStudent(_selectedChild);
    final overdue = AccountingFinanceStore.instance.installments
        .where((item) => item.status == 'Geciken')
        .length;
    final studyItems = [
      {
        'label': 'Bugün tamamlanan ders',
        'value':
            '${attendance.where((item) => item.status == 'Katildi').length} ders',
        'note': 'Seçili öğrencinin yoklama ve plan verisi birlikte izleniyor',
        'icon': Icons.task_alt_rounded,
        'color': const Color(0xFF0F766E),
      },
      {
        'label': 'Bu hafta devamsızlık',
        'value':
            '${attendance.where((item) => item.status == 'Devamsiz').length} kayıt',
        'note': 'Tarih bazlı devamsızlık dökümü görüntülenebilir',
        'icon': Icons.auto_graph_rounded,
        'color': const Color(0xFF2563EB),
      },
      {
        'label': 'Finans sinyali',
        'value': overdue == 0 ? 'Dengede' : '$overdue uyarı',
        'note': overdue == 0
            ? 'Gecikmiş ödeme görünmüyor'
            : 'Geciken planlar sistemde işaretlendi',
        'icon': Icons.timer_outlined,
        'color': const Color(0xFF7C3AED),
      },
    ];
    return Column(
      children: studyItems
          .map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _surface(
                context,
                child: Row(
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: (item['color'] as Color).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        item['icon'] as IconData,
                        color: item['color'] as Color,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item['label'] as String,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            item['note'] as String,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    Text(
                      item['value'] as String,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          )
          .toList(),
    );
  }

  Widget _scheduleSection(BuildContext context) {
    return Column(
      children: _weeklySchedule
          .map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: InkWell(
                borderRadius: BorderRadius.circular(22),
                onTap: () => _showScheduleDetail(item),
                child: _surface(
                  context,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 12,
                        height: 56,
                        decoration: BoxDecoration(
                          color: item['color'] as Color,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item['time'] as String,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            const SizedBox(height: 3),
                            Text(
                              item['title'] as String,
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              item['subtitle'] as String,
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      ),
                      Chip(
                        label: Text(item['type'] as String),
                        side: BorderSide.none,
                        backgroundColor: (item['color'] as Color).withValues(
                          alpha: 0.12,
                        ),
                        labelStyle: TextStyle(color: item['color'] as Color),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          )
          .toList(),
    );
  }

  Widget _financeCard(BuildContext context) {
    final store = AccountingFinanceStore.instance;
    final overdue = store.installments
        .where((item) => item.status == 'Geciken')
        .toList();
    final latestDue = overdue.isEmpty ? 'Ödeme dengede' : overdue.first.due;
    final remaining = overdue.fold<int>(
      0,
      (sum, item) => sum + store.parseAmount(item.amount),
    );
    return _surface(
      context,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: _metricBox(
                  context,
                  title: 'Kalan tutar',
                  value: store.formatAmount(remaining),
                  color: const Color(0xFFB54708),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _metricBox(
                  context,
                  title: 'Son ödeme',
                  value: latestDue,
                  color: const Color(0xFF2563EB),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.info_outline_rounded,
                  color: Color(0xFFB45309),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    overdue.isEmpty
                        ? 'Geciken ödeme bulunmuyor. Tüm tahsilatlar dengede ilerliyor.'
                        : 'Geciken ödemeler için sistem otomatik uyarı oluşturur. Geciken plan sayısı: ${overdue.length}.',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton.icon(
                onPressed: () =>
                    _openPage(context, const VeliOnlineOdemePage()),
                icon: const Icon(Icons.credit_card_rounded),
                label: const Text('Online Ödeme'),
              ),
              OutlinedButton.icon(
                onPressed: () => _openPage(context, const VeliOdemePage()),
                icon: const Icon(Icons.receipt_long_outlined),
                label: const Text('Geçmişi Gör'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _attendanceCard(BuildContext context) {
    final attendance = AttendanceService.instance.forStudent(_selectedChild);
    final absent = attendance.where((item) => item.status == 'Devamsiz').length;
    final excused = attendance.where((item) => item.status == 'Izinli').length;
    return _surface(
      context,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Bu ay $absent devamsızlık, $excused izinli kayıt bulunuyor.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(height: 1.4),
                ),
              ),
              const SizedBox(width: 12),
              FilledButton.tonal(
                onPressed: () =>
                    _openPage(context, const VeliDevamsizlikPage()),
                child: const Text('Takvim'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton.icon(
                onPressed: _openExcuseRequest,
                icon: const Icon(Icons.edit_calendar_outlined),
                label: const Text('Mazeret Bildir'),
              ),
              OutlinedButton.icon(
                onPressed: () =>
                    _showInfoSnack('Devamsızlık özeti öğretmene iletildi.'),
                icon: const Icon(Icons.send_outlined),
                label: const Text('Okula Bildir'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _documentSection(BuildContext context) {
    final documents = _documentItems;
    return Column(
      children: documents
          .map(
            (document) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: InkWell(
                onTap: () => _showDocumentPreview(document),
                borderRadius: BorderRadius.circular(22),
                child: _surface(
                  context,
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: const Color(0xFFEEF2FF),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(
                          Icons.description_outlined,
                          color: Color(0xFF4F46E5),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              document['title']!,
                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              document['subtitle']!,
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => _showDocumentPreview(document),
                        icon: const Icon(Icons.open_in_new_rounded),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          )
          .toList(),
    );
  }

  Widget _suggestionCard(BuildContext context, Map<String, String> suggestion) {
    return _surface(
      context,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            suggestion['title']!,
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            suggestion['detail']!,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(height: 1.4),
          ),
          const SizedBox(height: 10),
          Align(
            alignment: Alignment.centerLeft,
            child: FilledButton.tonal(
              onPressed: () => _openRecommendationPlan(
                suggestion['title']!,
                suggestion['detail']!,
              ),
              child: const Text('Planı Uygula'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _metricBox(
    BuildContext context, {
    required String title,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }

  Widget _contactRow(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Theme.of(
            context,
          ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.45),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded),
          ],
        ),
      ),
    );
  }

  Widget _surface(BuildContext context, {required Widget child}) {
    final theme = Theme.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(
              alpha: theme.brightness == Brightness.dark ? 0.22 : 0.06,
            ),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: child,
    );
  }

  void _openPage(BuildContext context, Widget page) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => page));
  }

  void _showInfoSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  void _showAcademicSummary() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Canlı akademik özet',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 14),
              ..._academicReportLines(),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () {
                  Navigator.pop(context);
                  _openPage(this.context, const VeliExamResultsPage());
                },
                child: const Text('Sınav Sonuçlarına Git'),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showRiskSummary() {
    showDialog<void>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Risk özeti'),
          content: Text(
            _riskAlerts
                .map((item) => '• ${item['title']}: ${item['detail']}')
                .join('\n\n'),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Kapat'),
            ),
            FilledButton(
              onPressed: () {
                Navigator.pop(context);
                _openMeetingRequest(_preferredAdvisor);
              },
              child: const Text('Görüşme Talebi'),
            ),
          ],
        );
      },
    );
  }

  void _openWeeklyReport() {
    _openPage(context, const VeliWeeklyReportPage());
  }

  void _showStudyTracking() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Çalışma takibi ayrıntısı',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 14),
              ..._studyTrackingLines(),
            ],
          ),
        );
      },
    );
  }

  List<Widget> _academicReportLines() {
    final attendance = AttendanceService.instance.forStudent(_selectedChild);
    final overdue = AccountingFinanceStore.instance.installments
        .where(
          (item) => item.student == _selectedChild && item.status == 'Geciken',
        )
        .length;
    final meetings = MeetingRequestStore.instance.requests
        .where((item) => item.studentName == _selectedChild)
        .length;
    return [
      _ReportLine(label: 'Seçili öğrenci', value: _selectedChild),
      _ReportLine(
        label: 'Yoklama kaydı',
        value: '${attendance.length} hareket',
      ),
      _ReportLine(
        label: 'Geciken ödeme',
        value: overdue == 0 ? 'Yok' : '$overdue uyarı',
      ),
      _ReportLine(label: 'Görüşme takibi', value: '$meetings kayıt'),
    ];
  }

  List<Widget> _studyTrackingLines() {
    final attendance = AttendanceService.instance.forStudent(_selectedChild);
    final attended = attendance
        .where((item) => item.status == 'Katildi')
        .length;
    final absent = attendance.where((item) => item.status == 'Devamsiz').length;
    final late = attendance.where((item) => item.status == 'Gec').length;
    final overdue = AccountingFinanceStore.instance.installments
        .where(
          (item) => item.student == _selectedChild && item.status == 'Geciken',
        )
        .length;
    return [
      _ReportLine(label: 'Tamamlanan ders', value: '$attended kayıt'),
      _ReportLine(label: 'Devamsızlık', value: '$absent kayıt'),
      _ReportLine(label: 'Gec kalma', value: '$late kayıt'),
      _ReportLine(
        label: 'Finans sinyali',
        value: overdue == 0 ? 'Dengede' : '$overdue uyarı',
      ),
      _ReportLine(
        label: 'Destek noktasi',
        value: _supportSuggestions.first['title'] ?? 'Plan bekleniyor',
      ),
    ];
  }

  void _showScheduleSheet() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return ListView.separated(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          itemCount: _weeklySchedule.length,
          separatorBuilder: (context, index) => const SizedBox(height: 10),
          itemBuilder: (context, index) {
            final item = _weeklySchedule[index];
            return ListTile(
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(
                backgroundColor: (item['color'] as Color).withValues(
                  alpha: 0.12,
                ),
                child: Icon(
                  Icons.event_note_rounded,
                  color: item['color'] as Color,
                ),
              ),
              title: Text(item['title'] as String),
              subtitle: Text('${item['time']} • ${item['subtitle']}'),
              trailing: Text(item['type'] as String),
              onTap: () {
                Navigator.pop(context);
                _showScheduleDetail(item);
              },
            );
          },
        );
      },
    );
  }

  void _showScheduleDetail(Map<String, dynamic> item) {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(item['title'] as String),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Tur: ${item['type']}'),
            const SizedBox(height: 8),
            Text('Zaman: ${item['time']}'),
            const SizedBox(height: 8),
            Text(item['subtitle'] as String),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Kapat'),
          ),
        ],
      ),
    );
  }

  void _openExcuseRequest() {
    _openPage(context, const VeliExcuseRequestPage());
  }

  void _showDocumentsSheet() {
    final documents = _documentItems;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return ListView.builder(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          itemCount: documents.length,
          itemBuilder: (context, index) {
            final item = documents[index];
            return ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const CircleAvatar(
                backgroundColor: Color(0xFFEEF2FF),
                child: Icon(
                  Icons.description_outlined,
                  color: Color(0xFF4F46E5),
                ),
              ),
              title: Text(item['title']!),
              subtitle: Text(item['subtitle']!),
              trailing: IconButton(
                onPressed: () => _showDocumentPreview(item),
                icon: const Icon(Icons.download_rounded),
              ),
              onTap: () => _showDocumentPreview(item),
            );
          },
        );
      },
    );
  }

  void _showDocumentPreview(Map<String, String> document) {
    showDialog<void>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(document['title']!),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                document['subtitle']!,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Theme.of(
                    context,
                  ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.45),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  _documentBody(document['title']!),
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(height: 1.45),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Kapat'),
            ),
            FilledButton(
              onPressed: () {
                Navigator.pop(context);
                _showInfoSnack('${document['title']} indirildi.');
              },
              child: const Text('İndir'),
            ),
          ],
        );
      },
    );
  }

  String _documentBody(String title) {
    if (title.contains('makbuzu')) {
      return 'Bu belge canlı tahsilat kaydından oluşturuldu. Ödeme kanalı, zaman bilgisi ve öğrenci eşleşmesi finans dashboard verisinden geliyor.';
    }
    if (title.contains('akademik')) {
      return 'Haftalık akademik özet, seçili öğrencinin yoklama, sınav ve plan takibine göre panelde derlenir.';
    }
    if (title.contains('görüşme')) {
      return 'Görüşme notlari veli-talep ve rehberlik akışından olusur. Yeni toplanti olustukca burada güncellenir.';
    }
    return 'Bu belge için önizleme hazır değil.';
  }

  void _openRecommendationPlan(String title, String detail) {
    _openPage(context, VeliSupportPlanPage(title: title, detail: detail));
  }

  void _openMeetingRequest(String advisor) {
    _openPage(context, VeliMeetingRequestPage(advisor: advisor));
  }

  List<Map<String, String>> get _documentItems {
    final collections = AccountingFinanceStore.instance.collections
        .take(3)
        .toList();
    if (collections.isNotEmpty) {
      return collections
          .map(
            (item) => {
              'title': '${item.name} makbuzu',
              'subtitle': '${item.method} • ${item.time}',
            },
          )
          .toList();
    }
    final meetings = MeetingRequestStore.instance.requests
        .where((item) => item.studentName == _selectedChild)
        .take(2);
    if (meetings.isNotEmpty) {
      return meetings
          .map(
            (item) => {
              'title': '${item.advisor} görüşme notu',
              'subtitle': '${item.slot} • ${item.status}',
            },
          )
          .toList();
    }
    return [
      {
        'title': 'Haftalık akademik özet',
        'subtitle': 'Canlı veri özeti • Bugün',
      },
    ];
  }

  Widget _childSelector(BuildContext context) {
    final options = _linkedChildren.map((item) => item.fullName).toList();
    return _surface(
      context,
      child: DropdownButtonFormField<String>(
        initialValue: _selectedChild,
        decoration: const InputDecoration(
          labelText: 'Çocuk Seçimi',
          border: OutlineInputBorder(),
        ),
        items: options
            .map(
              (item) => DropdownMenuItem(
                value: item,
                child: Text(item.replaceAll('Yilmaz', 'Yılmaz')),
              ),
            )
            .toList(),
        onChanged: (value) async {
          if (value == null) return;
          setState(() => _selectedChild = value);
          await AttendanceService.instance.refresh(studentName: value);
          _weeklySchedule = _buildWeeklySchedule();
          if (mounted) setState(() {});
        },
      ),
    );
  }

  String _classForChild(String child) {
    final record = _linkedChildren
        .where((item) => item.fullName == child)
        .firstOrNull;
    return record?.className ?? 'Sınıf';
  }
}

class _ReportLine extends StatelessWidget {
  final String label;
  final String value;

  const _ReportLine({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
          ),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}
