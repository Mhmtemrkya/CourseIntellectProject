import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import 'package:student/pages/exam_solve_page.dart';
import 'package:student/pages/student_exam_history_page.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/planned_exam_api_service.dart';
import 'package:student/services/school_feed_api_service.dart';
import 'package:student/widgets/exam_camera_preview.dart';
import 'package:url_launcher/url_launcher.dart';
import '../widgets/responsive_layout.dart';

class ExamsPage extends StatefulWidget {
  final bool mockOnly;

  const ExamsPage({super.key, this.mockOnly = false});

  @override
  State<ExamsPage> createState() => _ExamsPageState();
}

class _ExamsPageState extends State<ExamsPage> {
  int selectedTab = 0;
  bool _loading = true;
  String? _error;
  String _studentName = 'Öğrenci';
  String _studentUsername = '';
  List<Map<String, dynamic>> _completedExams = const [];
  List<Map<String, dynamic>> _upcomingExams = const [];

  List<String> get tabs => [
    widget.mockOnly ? "Deneme Sınavları" : "Sınavlarım",
    "Sonuçlarım",
  ];

  bool _isMockExamType(String? type) {
    final normalized = (type ?? '').trim().toLowerCase();
    return normalized == 'mockexam' || normalized.contains('deneme');
  }

  bool _isMockPlannedExam(PlannedExamRecord exam) {
    return _isMockExamType(exam.type);
  }

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
      final scopedPlanned = planned
          .where(
            (item) => widget.mockOnly
                ? _isMockPlannedExam(item)
                : !_isMockPlannedExam(item),
          )
          .toList();

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
        _studentUsername = session?.username ?? _studentUsername;
        _upcomingExams = scopedPlanned
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
                "liveLinkUrl": item.liveLinkUrl,
                "requireCamera": item.requireCamera,
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
            .where(
              (item) => widget.mockOnly
                  ? _isMockExamType(item.type)
                  : !_isMockExamType(item.type),
            )
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

  DateTime? _plannedStartAt(String? label) {
    final value = (label ?? '').replaceAll('•', ' ').trim();
    if (value.isEmpty) return null;
    final numeric = RegExp(
      r'^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$',
    ).firstMatch(value);
    if (numeric != null) {
      return DateTime(
        int.parse(numeric.group(3)!),
        int.parse(numeric.group(2)!),
        int.parse(numeric.group(1)!),
        int.tryParse(numeric.group(4) ?? '0') ?? 0,
        int.tryParse(numeric.group(5) ?? '0') ?? 0,
      );
    }

    final text = RegExp(
      r'^(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)(?:\s+(\d{4}))?\s+(\d{2}):(\d{2})$',
    ).firstMatch(value);
    if (text == null) return null;
    const months = {
      'ocak': 1,
      'şubat': 2,
      'subat': 2,
      'mart': 3,
      'nisan': 4,
      'mayıs': 5,
      'mayis': 5,
      'haziran': 6,
      'hazıran': 6,
      'temmuz': 7,
      'ağustos': 8,
      'agustos': 8,
      'eylül': 9,
      'eylul': 9,
      'ekim': 10,
      'kasım': 11,
      'kasim': 11,
      'aralık': 12,
      'aralik': 12,
    };
    final month = months[text.group(2)!.toLowerCase()];
    if (month == null) return null;
    return DateTime(
      int.tryParse(text.group(3) ?? '') ?? DateTime.now().year,
      month,
      int.parse(text.group(1)!),
      int.parse(text.group(4)!),
      int.parse(text.group(5)!),
    );
  }

  void _openExamSolve(Map<String, dynamic> item) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ExamSolvePage(
          plannedExamId: item["id"] as String?,
          examTitle: item["title"] as String?,
          subject: item["subject"] as String?,
          questionCount: item["questionCount"] as int? ?? 10,
          requireCamera: item["requireCamera"] as bool? ?? false,
        ),
      ),
    );
  }

  Future<void> _checkIn(
    Map<String, dynamic> item, {
    required bool joinedLive,
    required bool cameraReady,
  }) async {
    final id = item["id"] as String?;
    if (id == null) return;
    try {
      await PlannedExamApiService.instance.checkIn(
        id,
        studentName: _studentName,
        studentUsername: _studentUsername,
        className: item["className"] as String?,
        joinedLive: joinedLive,
        cameraReady: cameraReady,
      );
    } catch (_) {
      // Yoklama başarısız olsa bile sınava girişi engelleme.
    }
  }

  // Kamera/canlı yayın zorunluysa önce giriş kapısını göster.
  Future<void> _startExamWithGate(Map<String, dynamic> item) async {
    final liveLink = (item["liveLinkUrl"] as String? ?? '').trim();
    final requireCamera = item["requireCamera"] as bool? ?? false;

    if (liveLink.isEmpty && !requireCamera) {
      await _checkIn(item, joinedLive: false, cameraReady: false);
      if (mounted) _openExamSolve(item);
      return;
    }

    var joinedLive = false;
    var cameraReady = false;

    final entered = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final canEnter =
                (liveLink.isEmpty || joinedLive) &&
                (!requireCamera || cameraReady);
            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                20,
                20,
                20 + MediaQuery.of(context).viewInsets.bottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Sınav Giriş Kontrolü".tr,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    item["title"] as String? ?? '',
                    style: const TextStyle(color: Colors.grey),
                  ),
                  const SizedBox(height: 16),
                  if (liveLink.isNotEmpty) ...[
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text("Canlı yayına katıl".tr),
                      subtitle: Text(
                        "Öğretmenin canlı bağlantısına gir, kameranı aç.".tr,
                      ),
                    ),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        child: Text(
                          joinedLive ? "Tekrar Aç" : "Canlı Yayına Katıl",
                        ),
                        onPressed: () async {
                          final uri = Uri.tryParse(liveLink);
                          if (uri != null) {
                            await launchUrl(
                              uri,
                              mode: LaunchMode.externalApplication,
                            );
                          }
                          setSheetState(() => joinedLive = true);
                        },
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (requireCamera) ...[
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        liveLink.isNotEmpty ? "2. Kameranı aç" : "Kameranı aç",
                      ),
                      subtitle: Text("Sınav boyunca kameran açık kalmalı.".tr),
                    ),
                    const SizedBox(height: 8),
                    ExamCameraPreview(
                      onReady: () => setSheetState(() => cameraReady = true),
                    ),
                  ],
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF22A06B),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      onPressed: canEnter
                          ? () => Navigator.pop(sheetContext, true)
                          : null,
                      child: Text("Sınava Gir".tr),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    if (entered == true) {
      await _checkIn(item, joinedLive: joinedLive, cameraReady: cameraReady);
      if (mounted) _openExamSolve(item);
    }
  }

  bool _canStartExam(Map<String, dynamic> item) {
    final startsAt = _plannedStartAt(item["date"] as String?);
    return startsAt == null || !DateTime.now().isBefore(startsAt);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final currentList = selectedTab == 0 ? _upcomingExams : _completedExams;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(widget.mockOnly ? "Deneme Sınavları" : "Sınavlarım"),
      ),
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
                  _messageCard(theme, message: _error!)
                else if (currentList.isEmpty)
                  _emptyPanel(theme)
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
          Text(
            widget.mockOnly ? "Deneme Sınavları" : "Sınavlarım",
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            widget.mockOnly
                ? "Planlanan deneme sınavlarını takip et, sonuçlarını incele ve yaklaşan oturumlara hazır ol."
                : "Öğretmenin tarafından oluşturulan sınavları takip et, sonuçlarını incele ve yaklaşan oturumlara hazır ol.",
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.92),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _heroStat(
                "${_upcomingExams.length}",
                widget.mockOnly ? "Deneme" : "Sınavlarım",
              ),
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

  Widget _messageCard(ThemeData theme, {required String message}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        children: [
          Text(
            message,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }

  Widget _emptyPanel(ThemeData theme) {
    final title = selectedTab == 0
        ? (widget.mockOnly ? 'Henüz deneme sınavı yok' : 'Henüz sınav yok')
        : 'Henüz sınav sonucunuz bulunmuyor';
    final description = selectedTab == 0
        ? 'Öğretmenin sınav oluşturduğunda burada görünecek.'
        : 'Girdiğiniz sınavların sonuçları burada görüntülenecek.';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        children: [
          Text(
            title,
            textAlign: TextAlign.center,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(description, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton(onPressed: _loadExams, child: Text('Yenile'.tr)),
        ],
      ),
    );
  }

  Widget _examCard(ThemeData theme, bool isDark, Map<String, dynamic> item) {
    final isCompleted = selectedTab == 1;
    final canStart = isCompleted || _canStartExam(item);

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0B1728) : Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.10)
              : const Color(0xFFE2E8F0),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${item["subject"]} • ${item["type"]}',
            style: theme.textTheme.labelMedium?.copyWith(
              color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.68),
              fontWeight: FontWeight.w800,
              letterSpacing: 0.9,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            item["title"] as String,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            [
              item["className"],
              item["date"],
              item["duration"],
              '${item["questionCount"]} soru',
              if (isCompleted) '${item["score"]} puan',
            ].whereType<Object>().join(' • '),
            style: theme.textTheme.bodySmall?.copyWith(height: 1.45),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: canStart
                  ? () {
                      if (isCompleted) {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => StudentExamHistoryPage(
                              studentName: _studentName,
                              title: 'Sınav Sonuçlarım'.tr,
                            ),
                          ),
                        );
                      } else {
                        _startExamWithGate(item);
                      }
                    }
                  : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFF7A1A),
                foregroundColor: Colors.white,
              ),
              child: Text(
                isCompleted
                    ? "Sonucu Gör"
                    : canStart
                    ? "Sınava Gir"
                    : "Saatini Bekle",
              ),
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
