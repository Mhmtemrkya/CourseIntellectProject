import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/accounting_finance_store.dart';
import '../services/attendance_service.dart';
import '../services/api_config.dart';
import '../services/auth_session_store.dart';
import '../services/exam_results_store.dart';
import '../services/school_feed_api_service.dart';
import '../services/linked_children_service.dart';
import '../services/teacher_weekly_report_api_service.dart';
import '../widgets/app_header.dart';
import '../widgets/responsive_layout.dart';
import '../widgets/responsive_overlays.dart';

class VeliWeeklyReportPage extends StatefulWidget {
  const VeliWeeklyReportPage({super.key});

  @override
  State<VeliWeeklyReportPage> createState() => _VeliWeeklyReportPageState();
}

class _VeliWeeklyReportPageState extends State<VeliWeeklyReportPage> {
  String _selectedChild = 'Öğrenci';
  List<ExamScoreRecord> _examRecords = const [];
  List<AttendanceRecord> _attendanceRecords = const [];
  List<LinkedChildRecord> _children = const [];
  List<TeacherWeeklyReportRecord> _teacherReports = const [];
  bool _loading = true;

  String _decodeHtmlEntities(String value) {
    return value
        .replaceAll('&#xFC;', 'ü')
        .replaceAll('&#xDC;', 'Ü')
        .replaceAll('&#xE7;', 'ç')
        .replaceAll('&#xC7;', 'Ç')
        .replaceAll('&#x131;', 'ı')
        .replaceAll('&#x130;', 'İ')
        .replaceAll('&#xF6;', 'ö')
        .replaceAll('&#xD6;', 'Ö')
        .replaceAll('&#x15F;', 'ş')
        .replaceAll('&#x15E;', 'Ş')
        .replaceAll('&#x11F;', 'ğ')
        .replaceAll('&#x11E;', 'Ğ')
        .replaceAll('&amp;', '&')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'");
  }

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await AccountingFinanceStore.instance.loadDashboard();
    final children = await LinkedChildrenService.instance.loadLinkedChildren();
    _children = children;
    if (children.isNotEmpty) {
      _selectedChild = children.first.fullName;
    }
    await AttendanceService.instance.refresh(studentName: _selectedChild);
    final examRecords = await SchoolFeedApiService.instance.fetchExamResults();
    await _loadTeacherReports();
    if (!mounted) return;
    setState(() {
      _examRecords = examRecords
          .where((item) => item.studentName == _selectedChild)
          .toList();
      _attendanceRecords = AttendanceService.instance.forStudent(
        _selectedChild,
      );
      _loading = false;
    });
  }

  Future<void> _loadTeacherReports() async {
    final session = await AuthSessionStore.instance.load();
    final linkedChild = _children
        .where((item) => item.fullName == _selectedChild)
        .firstOrNull;
    if (session == null || linkedChild == null) {
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: const AppHeader(title: 'Haftalık Rapor'),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: ResponsiveContent(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(child: CircularProgressIndicator()),
                )
              else ...[
                _heroCard(context),
                const SizedBox(height: 16),
                _actionsCard(context),
                const SizedBox(height: 16),
                _summaryGrid(context),
                const SizedBox(height: 16),
                _teacherNoteCard(context),
                const SizedBox(height: 16),
                _teacherReportsCard(context),
                const SizedBox(height: 16),
                _lessonPerformanceCard(context),
                const SizedBox(height: 16),
                _weeklyPlanCard(context),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _heroCard(BuildContext context) {
    final theme = Theme.of(context);
    final average = _averageScore();
    final attendanceRate = _attendanceRate();
    final overdueCount = AccountingFinanceStore.instance.installments
        .where(
          (item) => item.student == _selectedChild && item.status == 'Geciken',
        )
        .length;
    final status = average >= 80
        ? 'Iyi'
        : average >= 65
        ? 'Izlemede'
        : 'Destek';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF1D4ED8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(999),
            ),
            child: const Text(
              'Güncel dönem raporu',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            '$_selectedChild için haftalık veli raporu hazır',
            style: theme.textTheme.headlineSmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              height: 1.15,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Katılım, sınav, finans ve veli aksiyonları tek görünümde toplandı. Bu kart seçili öğrencinin güncel kayıtlarından üretilir.',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.86),
              height: 1.45,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _heroMetric('Genel durum', status)),
              const SizedBox(width: 10),
              Expanded(child: _heroMetric('Katılım', '%$attendanceRate')),
              const SizedBox(width: 10),
              Expanded(
                child: _heroMetric(
                  'Finans',
                  overdueCount == 0 ? 'Dengede' : '$overdueCount uyarı',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroMetric(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }

  Widget _summaryGrid(BuildContext context) {
    final average = _averageScore();
    final completed = _attendanceRecords
        .where((item) => item.status == 'Katıldı')
        .length;
    final total = _attendanceRecords.length;
    final overdueCount = AccountingFinanceStore.instance.installments
        .where(
          (item) => item.student == _selectedChild && item.status == 'Geciken',
        )
        .length;
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        _SummaryTile(
          title: 'Sınav ortalaması',
          value: average == 0 ? 'Veri yok' : average.toString(),
          icon: Icons.analytics_outlined,
          color: Color(0xFF2563EB),
        ),
        _SummaryTile(
          title: 'Katılım kaydı',
          value: '$completed / $total',
          icon: Icons.assignment_turned_in_outlined,
          color: Color(0xFF0F766E),
        ),
        _SummaryTile(
          title: 'Yoklama orani',
          value: '%${_attendanceRate()}',
          icon: Icons.timer_outlined,
          color: Color(0xFF7C3AED),
        ),
        _SummaryTile(
          title: 'Finans notu',
          value: overdueCount == 0 ? 'Dengede' : '$overdueCount uyarı',
          icon: Icons.flag_outlined,
          color: Color(0xFFB54708),
        ),
      ],
    );
  }

  Widget _teacherNoteCard(BuildContext context) {
    final average = _averageScore();
    final attendanceRate = _attendanceRate();
    final overdueCount = AccountingFinanceStore.instance.installments
        .where(
          (item) => item.student == _selectedChild && item.status == 'Geciken',
        )
        .length;
    return _surface(
      context,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Öğretmen değerlendirmesi',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          _InsightRow(
            icon: Icons.check_circle_outline,
            color: Color(0xFF0F766E),
            text: average >= 80
                ? 'Sınav ortalaması güçlü görünüyor. Mevcut çalışma düzeni korunabilir.'
                : 'Sınav ortalaması yakından izlenmeli. Kısa tekrar planları faydalı olabilir.',
          ),
          const SizedBox(height: 10),
          _InsightRow(
            icon: Icons.priority_high_rounded,
            color: Color(0xFFB54708),
            text: attendanceRate >= 90
                ? 'Katılım düzeni guclu. Devam takibi istikrarli ilerliyor.'
                : 'Katılım oranında düşüş var. Devamsızlık ve geç kalma kayıtları kontrol edilmeli.',
          ),
          const SizedBox(height: 10),
          _InsightRow(
            icon: Icons.edit_note_rounded,
            color: Color(0xFF2563EB),
            text: overdueCount == 0
                ? 'Finans tarafında kritik bir uyarı görünmüyor.'
                : 'Geciken ödeme kayıtları var. Veli panelindeki ödeme planı kontrol edilmeli.',
          ),
        ],
      ),
    );
  }

  Widget _teacherReportsCard(BuildContext context) {
    final theme = Theme.of(context);
    return _surface(
      context,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Öğretmenden Gelen Raporlar',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFDBEAFE),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '${_teacherReports.length} rapor',
                  style: const TextStyle(
                    color: Color(0xFF1D4ED8),
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (_teacherReports.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Henüz özel haftalık rapor yok',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  SizedBox(height: 6),
                  Text(
                    'Öğretmen bu öğrenci için rapor paylaştığında burada düzenli rapor kartları halinde görünecek.',
                    style: TextStyle(color: Color(0xFF64748B), height: 1.45),
                  ),
                ],
              ),
            )
          else
            ..._teacherReports.take(4).map((report) {
              final accent = _reportAccent(report.subject);
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                child: InkWell(
                  borderRadius: BorderRadius.circular(28),
                  onTap: () => _openTeacherWeeklyReport(report),
                  child: Ink(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(28),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: [
                        BoxShadow(
                          color: accent.withValues(alpha: 0.10),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 54,
                              height: 54,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(18),
                                gradient: LinearGradient(
                                  colors: [
                                    accent,
                                    accent.withValues(alpha: 0.78),
                                  ],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                              ),
                              child: Center(
                                child: Text(
                                  _reportGlyph(report.subject),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 18,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    report.title,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: theme.textTheme.titleMedium
                                        ?.copyWith(
                                          color: const Color(0xFF0F172A),
                                          fontWeight: FontWeight.w900,
                                          height: 1.2,
                                        ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    '${report.teacherName} • ${report.weeklyPeriodLabel}',
                                    style: const TextStyle(
                                      color: Color(0xFF64748B),
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 6,
                                  ),
                                  decoration: BoxDecoration(
                                    color: accent.withValues(alpha: 0.10),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(
                                    report.className,
                                    style: TextStyle(
                                      color: accent,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 10),
                                const Icon(
                                  Icons.arrow_outward_rounded,
                                  color: Color(0xFF94A3B8),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _teacherReportLightBadge(report.subject, accent),
                            _teacherReportLightBadge(
                              '${report.attachments.length} ek',
                              const Color(0xFF475569),
                            ),
                            _teacherReportLightBadge(
                              'Veliye iletildi',
                              const Color(0xFF059669),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Text(
                          report.summary,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xFF475569),
                            height: 1.55,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: const Row(
                            children: [
                              Icon(
                                Icons.visibility_outlined,
                                size: 18,
                                color: Color(0xFF334155),
                              ),
                              SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Raporu aç, detayları ve ek dosyaları incele',
                                  style: TextStyle(
                                    color: Color(0xFF334155),
                                    fontWeight: FontWeight.w700,
                                  ),
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
            }),
        ],
      ),
    );
  }

  void _openTeacherWeeklyReport(TeacherWeeklyReportRecord report) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        final theme = Theme.of(context);
        return SafeArea(
          child: ResponsiveSheetContainer(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          _reportAccent(report.subject),
                          _reportAccent(report.subject).withValues(alpha: 0.78),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(30),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _teacherReportBadge(report.subject),
                            _teacherReportBadge(report.className),
                            _teacherReportBadge(report.weeklyPeriodLabel),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Text(
                          report.title,
                          style: theme.textTheme.headlineSmall?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${report.teacherName} tarafından gönderildi',
                          style: const TextStyle(color: Colors.white70),
                        ),
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.mark_email_read_outlined,
                                color: Colors.white,
                                size: 18,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Bu rapor veli paneline iletildi ve kalıcı olarak kaydedildi.',
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    color: Colors.white.withValues(alpha: 0.90),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  _reportSurface(
                    title: 'Öğretmen Özeti',
                    child: Text(report.summary),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _reportSurface(
                          title: 'Güçlü Yönler',
                          child: Text(
                            report.highlights.isEmpty
                                ? 'Bu raporda ayrıca güçlü yön notu paylaşılmadı.'
                                : report.highlights,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _reportSurface(
                          title: 'Destek Alanları',
                          child: Text(
                            report.supportNotes.isEmpty
                                ? 'Bu raporda ayrıca destek notu paylaşılmadı.'
                                : report.supportNotes,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _reportSurface(
                    title: 'Ek Dosyalar',
                    child: report.attachments.isEmpty
                        ? const Text('Bu rapora ek dosya yüklenmedi.')
                        : Column(
                            children: report.attachments
                                .map(
                                  (item) => ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    onTap: () =>
                                        _openTeacherReportAttachment(item),
                                    leading: CircleAvatar(
                                      backgroundColor: const Color(0xFFDBEAFE),
                                      foregroundColor: const Color(0xFF2563EB),
                                      child: Text(
                                        item.fileType.characters.first,
                                      ),
                                    ),
                                    title: Text(item.name),
                                    subtitle: Text(item.fileType),
                                    trailing: const Icon(
                                      Icons.open_in_new_rounded,
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Future<void> _openTeacherReportAttachment(
    TeacherWeeklyReportAttachmentRecord attachment,
  ) async {
    final url = ApiConfig.resolveAssetUrl(attachment.url);
    final uri = Uri.tryParse(url);
    if (uri == null) {
      _showSnack('Dosya adresi gecersiz.');
      return;
    }
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched) {
      _showSnack('Dosya acilamadi.');
    }
  }

  Widget _lessonPerformanceCard(BuildContext context) {
    final lessonRows = _lessonRows();
    return _surface(
      context,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Ders bazlı görünüm',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 14),
          ...lessonRows,
        ],
      ),
    );
  }

  Widget _weeklyPlanCard(BuildContext context) {
    final overdueCount = AccountingFinanceStore.instance.installments
        .where(
          (item) => item.student == _selectedChild && item.status == 'Geciken',
        )
        .length;
    return _surface(
      context,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Hafta içi aksiyon planı',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 14),
          _PlanItem(
            day: 'Bugün',
            title: 'Yoklama ve sınav kayıtlarını kontrol et',
            detail:
                'Bu rapor öğrencinin güncel katılım ve sınav verilerine göre oluşturuldu.',
          ),
          const SizedBox(height: 10),
          _PlanItem(
            day: 'Bu hafta',
            title: 'Zayif derslere kisa tekrar bloklari ekle',
            detail: _lessonRows().isEmpty
                ? 'Yeni sınav kaydı geldikçe ders bazlı öneri burada güçlenecek.'
                : 'En düşük ortalamali ders için 20-30 dakikalik tekrar penceresi planlanabilir.',
          ),
          const SizedBox(height: 10),
          _PlanItem(
            day: 'Takip',
            title: overdueCount == 0
                ? 'Finans dengede'
                : 'Finans takibi gerekli',
            detail: overdueCount == 0
                ? 'Ödeme tarafında acil bir uyarı bulunmuyor.'
                : '$overdueCount geciken ödeme kaydı için veli paneli üzerinden aksiyon alinabilir.',
          ),
        ],
      ),
    );
  }

  Widget _actionsCard(BuildContext context) {
    return _surface(
      context,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Hızlı işlemler',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 14),
          InkWell(
            onTap: () => _openEmail(context),
            borderRadius: BorderRadius.circular(16),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFEEF2FF),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.alternate_email_rounded,
                    color: Color(0xFF4F46E5),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Raporun gönderileceği adres',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: const Color(0xFF4F46E5),
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          'mehmet.yilmaz.veli@example.com',
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.open_in_new_rounded,
                    color: Color(0xFF4F46E5),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              FilledButton.icon(
                onPressed: () => _downloadPdf(context),
                icon: const Icon(Icons.download_rounded),
                label: const Text('PDF İndir'),
              ),
              FilledButton.tonalIcon(
                onPressed: () {
                  _openEmail(context);
                },
                icon: const Icon(Icons.mail_outline_rounded),
                label: const Text('E-posta Gönder'),
              ),
              OutlinedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                },
                icon: const Icon(Icons.arrow_back_rounded),
                label: const Text('Ana Sayfaya Dön'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _openEmail(BuildContext context) async {
    const email = 'veli@courseintellect.app';
    final uri = Uri(
      scheme: 'mailto',
      path: email,
      queryParameters: {
        'subject': 'Haftalık veli raporu',
        'body':
            'Merhaba, seçili öğrencinin haftalık veli raporunu paylaşıyorum.',
      },
    );

    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
      return;
    }

    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('E-posta uygulaması açılamadı.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _downloadPdf(BuildContext context) async {
    final document = pw.Document();
    document.addPage(
      pw.MultiPage(
        build: (_) => [
          pw.Text(
            'Haftalık Veli Raporu',
            style: pw.TextStyle(fontSize: 22, fontWeight: pw.FontWeight.bold),
          ),
          pw.SizedBox(height: 8),
          pw.Text('Öğrenci: $_selectedChild'),
          pw.Text('Dönem: Güncel rapor'),
          pw.SizedBox(height: 18),
          pw.Text(
            'Genel Özet',
            style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold),
          ),
          pw.Bullet(text: 'Katılım oranı: %${_attendanceRate()}'),
          pw.Bullet(
            text:
                'Sınav ortalaması: ${_averageScore() == 0 ? 'Veri yok' : _averageScore().toString()}',
          ),
          pw.Bullet(
            text:
                'Finans durumu: ${AccountingFinanceStore.instance.installments.where((item) => item.student == _selectedChild && item.status == 'Geciken').isEmpty ? 'Dengede' : 'Uyarı var'}',
          ),
          pw.SizedBox(height: 18),
          pw.Text(
            'Öğretmen Notları',
            style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold),
          ),
          pw.Paragraph(
            text:
                'Bu PDF, seçili öğrencinin sınav, yoklama ve finans kayıtlarından otomatik üretilmiştir.',
          ),
        ],
      ),
    );

    final directory = await getTemporaryDirectory();
    final file = File('${directory.path}/haftalık_veli_raporu.pdf');
    await file.writeAsBytes(await document.save());
    await SharePlus.instance.share(
      ShareParams(files: [XFile(file.path)], text: 'Haftalık veli raporu'),
    );

    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Rapor PDF olarak hazırlandi: ${file.path}'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
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
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: child,
    );
  }

  Widget _teacherReportBadge(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _teacherReportLightBadge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w800,
          fontSize: 12,
        ),
      ),
    );
  }

  Color _reportAccent(String subject) {
    final normalized = subject.toLowerCase();
    if (normalized.contains('matem')) return const Color(0xFF2563EB);
    if (normalized.contains('türk') || normalized.contains('turk')) {
      return const Color(0xFFDC2626);
    }
    if (normalized.contains('fen')) return const Color(0xFF059669);
    if (normalized.contains('ing')) return const Color(0xFF7C3AED);
    if (normalized.contains('sosyal') ||
        normalized.contains('coğraf') ||
        normalized.contains('cograf')) {
      return const Color(0xFFF97316);
    }
    return const Color(0xFF0F766E);
  }

  String _reportGlyph(String subject) {
    final normalized = subject.toLowerCase();
    if (normalized.contains('matem')) return '∑';
    if (normalized.contains('türk') || normalized.contains('turk')) return 'TR';
    if (normalized.contains('fen')) return 'FN';
    if (normalized.contains('ing')) return 'EN';
    if (normalized.contains('sosyal') ||
        normalized.contains('coğraf') ||
        normalized.contains('cograf')) {
      return 'SB';
    }
    return 'RP';
  }

  Widget _reportSurface({required String title, required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }

  int _averageScore() {
    if (_examRecords.isEmpty) return 0;
    final total = _examRecords.fold<int>(0, (sum, item) => sum + item.score);
    return (total / _examRecords.length).round();
  }

  int _attendanceRate() {
    if (_attendanceRecords.isEmpty) return 0;
    final attended = _attendanceRecords
        .where((item) => item.status == 'Katıldı')
        .length;
    return ((attended / _attendanceRecords.length) * 100).round();
  }

  List<Widget> _lessonRows() {
    if (_examRecords.isEmpty) {
      return const [
        _LessonLine(
          title: 'Veri bekleniyor',
          value: 0,
          color: Color(0xFF9E9E9E),
        ),
      ];
    }

    final grouped = <String, List<ExamScoreRecord>>{};
    for (final item in _examRecords) {
      grouped
          .putIfAbsent(_decodeHtmlEntities(item.subject), () => [])
          .add(item);
    }

    final colors = [
      const Color(0xFFB45309),
      const Color(0xFF0F766E),
      const Color(0xFF2563EB),
      const Color(0xFF7C3AED),
    ];

    final entries = grouped.entries.toList()
      ..sort((a, b) {
        final aAvg =
            a.value.fold<int>(0, (sum, item) => sum + item.score) /
            a.value.length;
        final bAvg =
            b.value.fold<int>(0, (sum, item) => sum + item.score) /
            b.value.length;
        return bAvg.compareTo(aAvg);
      });

    return entries.asMap().entries.map((entry) {
      final records = entry.value.value;
      final average =
          (records.fold<int>(0, (sum, item) => sum + item.score) /
                  records.length)
              .round();
      return Padding(
        padding: EdgeInsets.only(
          bottom: entry.key == entries.length - 1 ? 0 : 12,
        ),
        child: _LessonLine(
          title: entry.value.key,
          value: average,
          color: colors[entry.key % colors.length],
        ),
      );
    }).toList();
  }
}

class _SummaryTile extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;

  const _SummaryTile({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: MediaQuery.of(context).size.width > 420
          ? (MediaQuery.of(context).size.width - 44) / 2
          : double.infinity,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.14),
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
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: color,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    value,
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
    );
  }
}

class _InsightRow extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String text;

  const _InsightRow({
    required this.icon,
    required this.color,
    required this.text,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color, size: 18),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(height: 1.45),
          ),
        ),
      ],
    );
  }
}

class _LessonLine extends StatelessWidget {
  final String title;
  final int value;
  final Color color;

  const _LessonLine({
    required this.title,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
            Text(
              '$value',
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: value / 100,
            minHeight: 10,
            backgroundColor: color.withValues(alpha: 0.12),
            valueColor: AlwaysStoppedAnimation<Color>(color),
          ),
        ),
      ],
    );
  }
}

class _PlanItem extends StatelessWidget {
  final String day;
  final String title;
  final String detail;

  const _PlanItem({
    required this.day,
    required this.title,
    required this.detail,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xFFDBEAFE),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            day,
            style: const TextStyle(
              color: Color(0xFF1D4ED8),
              fontWeight: FontWeight.w700,
            ),
          ),
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
                ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800),
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
    );
  }
}
