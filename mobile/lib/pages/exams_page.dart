import 'package:flutter/material.dart';
import 'package:student/pages/exam_detail_page.dart';
import 'package:student/pages/exam_solve_page.dart';
import 'package:student/pages/student_exam_history_page.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/planned_exam_api_service.dart';
import 'package:student/services/school_feed_api_service.dart';
import '../widgets/responsive_layout.dart';

class ExamsPage extends StatefulWidget {
  const ExamsPage({super.key});

  @override
  State<ExamsPage> createState() => _ExamsPageState();
}

class _ExamsPageState extends State<ExamsPage> {
  int selectedTab = 0;
  bool _loading = true;
  String? _error;
  String _studentName = 'Öğrenci';
  List<Map<String, dynamic>> _completedExams = const [];
  List<Map<String, dynamic>> _upcomingExams = const [];

  final List<String> tabs = ["Sınavlarım", "Sonuçlarım"];

  @override
  void initState() {
    super.initState();
    _loadExams();
  }

  Future<void> _loadExams() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final session = await AuthSessionStore.instance.load();
      final studentName = session == null
          ? ''
          : await SchoolFeedApiService.resolveLinkedStudentName(session);
      final studentClassName = session == null
          ? ''
          : await SchoolFeedApiService.resolveLinkedStudentClassName(session);

      final planned = await PlannedExamApiService.instance.fetchPlannedExams(
        studentName: studentName,
        studentUsername: session?.username,
        className: studentClassName,
      );

      List<dynamic> records = const [];
      try {
        records = await SchoolFeedApiService.instance.fetchExamResults(
          studentName: studentName,
          className: studentClassName,
        );
      } catch (_) {
        records = const [];
      }

      if (!mounted) return;
      setState(() {
        _studentName = session?.fullName ?? _studentName;
        _upcomingExams = planned
            .map(
              (item) => {
                "id": item.id,
                "title": item.title,
                "type": item.type,
                "className": item.className,
                "subject": item.subject,
                "date": item.date,
                "questionCount": item.questionCount,
                "duration": item.duration,
                "status": item.status,
                "statusColor": const Color(0xFF4E8DF5),
                "accentColor": _accentColorForSubject(item.subject),
                "score": "-",
                "net": item.questionCount,
                "sources": item.sources
                    .map(
                      (source) => {
                        "questionId": source.questionId,
                        "title": source.title,
                        "type": source.type,
                        "imagePath": source.imagePath,
                        "imagePlacement": source.imagePlacement,
                      },
                    )
                    .toList(),
              },
            )
            .toList();
        _completedExams = records
            .map(
              (item) => {
                "title": item.examTitle,
                "type": item.type,
                "className": item.className,
                "subject": item.subject,
                "date": item.date,
                "questionCount": item.net > 0 ? item.net : 0,
                "duration": "Sonuç Kaydı",
                "status": "Tamamlandı",
                "statusColor": const Color(0xFF69C36D),
                "accentColor": _accentColorForSubject(item.subject),
                "score": item.score,
                "net": item.net,
                "sources": const <Map<String, String>>[],
              },
            )
            .toList();
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  static Color _accentColorForSubject(String subject) {
    return _themeForSubject(subject).accent;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final currentList = selectedTab == 0 ? _upcomingExams : _completedExams;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(title: const Text("Sınavlarım")),
      body: RefreshIndicator(
        onRefresh: _loadExams,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          child: ResponsiveContent(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _heroCard(theme, isDark),
                const SizedBox(height: 18),
                _tabBar(theme),
                const SizedBox(height: 18),
                if (_loading)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 48),
                      child: CircularProgressIndicator(),
                    ),
                  )
                else if (_error != null)
                  _messageCard(
                    theme,
                    icon: Icons.wifi_off_rounded,
                    message: _error!,
                  )
                else if (currentList.isEmpty)
                  selectedTab == 0
                      ? _messageCard(
                          theme,
                          icon: Icons.play_lesson_outlined,
                          message:
                              'Yaklaşan sınav bulunmuyor. Yeni planlanan sınavlar burada listelenecek.',
                        )
                      : _messageCard(
                          theme,
                          icon: Icons.fact_check_outlined,
                          message: 'Henüz tamamlanmış sınav sonucu bulunmuyor.',
                        )
                else
                  ...currentList.map((item) => _examCard(theme, isDark, item)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _heroCard(ThemeData theme, bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: [Color(0xFFFF7A00), Color(0xFFFFA24A)],
        ),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.24)
                : const Color(0xFFFF7A00).withValues(alpha: 0.22),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.fact_check_rounded, color: Colors.white, size: 28),
              SizedBox(width: 10),
              Text(
                "Sınavlarım",
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            "Planlanan sınavlarını takip et, sonuçlarını incele ve yaklaşan oturumlara hazır ol.",
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.92),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _heroStat("${_upcomingExams.length}", "Sınavlarım"),
              const SizedBox(width: 12),
              _heroStat("${_completedExams.length}", "Sonuçlarım"),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroStat(String value, String label) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.9),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tabBar(ThemeData theme) {
    return Row(
      children: List.generate(tabs.length, (index) {
        final selected = selectedTab == index;

        return Expanded(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {
              setState(() {
                selectedTab = index;
              });
            },
            child: Container(
              margin: EdgeInsets.only(right: index == 0 ? 10 : 0),
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: selected ? theme.colorScheme.primary : theme.cardColor,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Text(
                tabs[index],
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: selected
                      ? Colors.white
                      : theme.textTheme.bodyMedium?.color,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _messageCard(
    ThemeData theme, {
    required IconData icon,
    required String message,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        children: [
          Icon(icon, size: 34, color: theme.colorScheme.primary),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }

  Widget _examCard(ThemeData theme, bool isDark, Map<String, dynamic> item) {
    final isCompleted = selectedTab == 1;
    final accent = item["accentColor"] as Color;
    final sources = (item["sources"] as List<dynamic>? ?? const []);
    final subjectTheme = _themeForSubject(item["subject"]?.toString() ?? '');

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: accent.withValues(alpha: 0.10)),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.20)
                : Colors.black.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: subjectTheme.gradient,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(26),
              ),
            ),
            child: Stack(
              children: [
                Positioned(
                  right: -12,
                  top: -10,
                  child: Text(
                    subjectTheme.monogram,
                    style: TextStyle(
                      fontSize: 78,
                      fontWeight: FontWeight.w900,
                      color: Colors.white.withValues(alpha: 0.10),
                      height: 1,
                    ),
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 54,
                          height: 54,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.16),
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: Icon(subjectTheme.icon, color: Colors.white),
                        ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            isCompleted
                                ? 'Sonuç'
                                : '${item["questionCount"]} soru',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    Text(
                      item["subject"] as String,
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: Colors.white.withValues(alpha: 0.88),
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.7,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item["title"] as String,
                      style: theme.textTheme.headlineSmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        height: 1.05,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      subjectTheme.tagline,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.86),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _pill(theme, item["type"] as String, subjectTheme.ink),
                    _pill(
                      theme,
                      item["className"] as String,
                      const Color(0xFF475569),
                    ),
                    _pill(
                      theme,
                      item["status"] as String,
                      item["statusColor"] as Color,
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: theme.scaffoldBackgroundColor,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: _detailMetric(
                          theme,
                          icon: Icons.calendar_today_outlined,
                          label: isCompleted
                              ? 'Sınav Tarihi'
                              : 'Planlanan Tarih',
                          value: item["date"] as String,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _detailMetric(
                          theme,
                          icon: Icons.timelapse_outlined,
                          label: isCompleted ? 'Kayıt Tipi' : 'Süre',
                          value: item["duration"] as String,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _numberMetric(
                        theme,
                        label: 'Soru',
                        value: '${item["questionCount"]}',
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _numberMetric(
                        theme,
                        label: isCompleted ? 'Net' : 'Kaynak',
                        value: isCompleted
                            ? '${item["net"]}'
                            : '${sources.length}',
                      ),
                    ),
                    if (isCompleted) ...[
                      const SizedBox(width: 10),
                      Expanded(
                        child: _numberMetric(
                          theme,
                          label: 'Puan',
                          value: '${item["score"]}',
                        ),
                      ),
                    ],
                  ],
                ),
                if (!isCompleted && sources.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  Text(
                    'Sınav İçeriği',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  ...sources
                      .take(3)
                      .map(
                        (source) => Container(
                          width: double.infinity,
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: theme.scaffoldBackgroundColor,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.checklist_rtl_rounded,
                                color: accent,
                                size: 18,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  (source as Map<String, dynamic>)["title"]
                                          ?.toString() ??
                                      'Soru kaynağı',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                ],
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => ExamDetailPage(exam: item),
                            ),
                          );
                        },
                        icon: const Icon(Icons.visibility_outlined),
                        label: const Text("Detay"),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () {
                          if (isCompleted) {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => StudentExamHistoryPage(
                                  studentName: _studentName,
                                  title: 'Sınav Sonuçlarım',
                                ),
                              ),
                            );
                          } else {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => ExamSolvePage(
                                  plannedExamId: item["id"] as String?,
                                  examTitle: item["title"] as String?,
                                  subject: item["subject"] as String?,
                                  questionCount:
                                      item["questionCount"] as int? ?? 10,
                                ),
                              ),
                            );
                          }
                        },
                        icon: Icon(
                          isCompleted
                              ? Icons.bar_chart_rounded
                              : Icons.play_arrow_rounded,
                        ),
                        label: Text(isCompleted ? "Sonuçu Gör" : "Sınava Gir"),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: accent,
                          foregroundColor: Colors.white,
                        ),
                      ),
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

  Widget _pill(ThemeData theme, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        value,
        style: theme.textTheme.bodySmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _detailMetric(
    ThemeData theme, {
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: theme.colorScheme.primary),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.textTheme.bodySmall?.color?.withValues(
                    alpha: 0.72,
                  ),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _numberMetric(
    ThemeData theme, {
    required String label,
    required String value,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.72),
            ),
          ),
        ],
      ),
    );
  }
}

class _ExamSubjectTheme {
  final List<Color> gradient;
  final Color accent;
  final Color ink;
  final String monogram;
  final String tagline;
  final IconData icon;

  const _ExamSubjectTheme({
    required this.gradient,
    required this.accent,
    required this.ink,
    required this.monogram,
    required this.tagline,
    required this.icon,
  });
}

_ExamSubjectTheme _themeForSubject(String subject) {
  switch (subject.trim().toLowerCase()) {
    case 'matematik':
      return const _ExamSubjectTheme(
        gradient: [Color(0xFF1D4ED8), Color(0xFF38BDF8)],
        accent: Color(0xFF2563EB),
        ink: Color(0xFF1D4ED8),
        monogram: 'M',
        tagline: 'Sayılar, problemler ve mantık akışı.',
        icon: Icons.functions_rounded,
      );
    case 'türkçe':
    case 'turkce':
      return const _ExamSubjectTheme(
        gradient: [Color(0xFF0F766E), Color(0xFF14B8A6)],
        accent: Color(0xFF0F766E),
        ink: Color(0xFF115E59),
        monogram: 'TR',
        tagline: 'Dil bilgisi, yorum ve paragraf odağı.',
        icon: Icons.menu_book_rounded,
      );
    case 'fizik':
      return const _ExamSubjectTheme(
        gradient: [Color(0xFF7C3AED), Color(0xFFA855F7)],
        accent: Color(0xFF7C3AED),
        ink: Color(0xFF6D28D9),
        monogram: 'F',
        tagline: 'Hareket, kuvvet ve formül refleksi.',
        icon: Icons.bolt_rounded,
      );
    case 'kimya':
      return const _ExamSubjectTheme(
        gradient: [Color(0xFF059669), Color(0xFF34D399)],
        accent: Color(0xFF059669),
        ink: Color(0xFF047857),
        monogram: 'K',
        tagline: 'Tepkimeler, kavramlar ve işlem disiplini.',
        icon: Icons.science_rounded,
      );
    case 'biyoloji':
      return const _ExamSubjectTheme(
        gradient: [Color(0xFF65A30D), Color(0xFFA3E635)],
        accent: Color(0xFF65A30D),
        ink: Color(0xFF4D7C0F),
        monogram: 'B',
        tagline: 'Sistemler, süreçler ve kavram örgüsü.',
        icon: Icons.eco_rounded,
      );
    case 'ingilizce':
    case 'i̇ngilizce':
      return const _ExamSubjectTheme(
        gradient: [Color(0xFFF59E0B), Color(0xFFFCD34D)],
        accent: Color(0xFFD97706),
        ink: Color(0xFFB45309),
        monogram: 'EN',
        tagline: 'Kelime, okuma ve yapı tekrarları.',
        icon: Icons.language_rounded,
      );
    default:
      return const _ExamSubjectTheme(
        gradient: [Color(0xFF334155), Color(0xFF64748B)],
        accent: Color(0xFF475569),
        ink: Color(0xFF334155),
        monogram: 'SN',
        tagline: 'Planlanan oturumlar ve sonuç takibi.',
        icon: Icons.fact_check_rounded,
      );
  }
}
