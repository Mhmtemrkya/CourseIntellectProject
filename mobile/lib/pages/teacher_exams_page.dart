import 'package:flutter/material.dart';
import 'package:student/pages/teacher_exam_edit_page.dart';
import 'package:student/pages/teacher_exam_results_page.dart';
import 'package:student/pages/teacher_exam_score_entry_page.dart';
import 'package:student/pages/teacher_create_exam_page.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/planned_exam_api_service.dart';
import 'package:student/services/school_feed_api_service.dart';
import 'package:student/widgets/responsive_layout.dart';
import 'package:student/widgets/responsive_overlays.dart';
import 'package:student/widgets/teacher_header.dart';

class TeacherExamsPage extends StatefulWidget {
  const TeacherExamsPage({super.key});

  @override
  State<TeacherExamsPage> createState() => _TeacherExamsPageState();
}

class _TeacherExamsPageState extends State<TeacherExamsPage> {
  int selectedTab = 0;
  bool _loading = true;
  String _teacherName = '';

  final List<String> tabs = ["Yaklaşan Sınavlar", "Tamamlananlar"];

  final List<Map<String, dynamic>> upcomingExams = [];
  final List<Map<String, dynamic>> completedExams = [];

  String _decodeText(String? value) {
    return (value ?? '')
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
        .replaceAll('&uuml;', 'ü')
        .replaceAll('&Uuml;', 'Ü')
        .replaceAll('&ccedil;', 'ç')
        .replaceAll('&Ccedil;', 'Ç')
        .replaceAll('&ouml;', 'ö')
        .replaceAll('&Ouml;', 'Ö')
        .replaceAll('&scedil;', 'ş')
        .replaceAll('&Scedil;', 'Ş')
        .replaceAll('&nbsp;', ' ');
  }

  @override
  void initState() {
    super.initState();
    _loadExams();
  }

  Future<void> _loadExams() async {
    final session = await AuthSessionStore.instance.load();
    final examResults = await SchoolFeedApiService.instance.fetchExamResults();
    final planned = await PlannedExamApiService.instance.fetchPlannedExams(
      teacherName: session?.fullName,
    );
    final grouped = <String, List<dynamic>>{};
    for (final item in examResults) {
      final key =
          '${item.examTitle}|${item.className}|${item.subject}|${item.date}';
      grouped.putIfAbsent(key, () => []).add(item);
    }
    completedExams
      ..clear()
      ..addAll(
        grouped.values.map((items) {
          final first = items.first;
          final totalScore = items.fold<num>(
            0,
            (sum, item) => sum + (item as dynamic).score,
          );
          final average = totalScore / items.length;
          return {
            "title": first.examTitle,
            "type": first.type,
            "className": first.className,
            "subject": first.subject,
            "date": first.date,
            "questionCount": items.length,
            "duration": "-",
            "status": "Tamamlandi",
            "statusColor": const Color(0xFF69C36D),
            "accentColor": const Color(0xFF69C36D),
            "avgScore": average.toStringAsFixed(0),
            "sourceType": "Sınav Sonuçları",
            "sources": const <Map<String, String>>[],
          };
        }).toList(),
      );
    upcomingExams
      ..clear()
      ..addAll(
        planned.map(
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
            "accentColor": const Color(0xFFFF7A00),
            "sourceType": item.sourceType,
            "sources": item.sources
                .map(
                  (source) => {
                    "title": source.title,
                    "type": source.type,
                    "subject": source.subject ?? item.subject,
                  },
                )
                .toList(),
          },
        ),
      );
    if (!mounted) return;
    setState(() {
      _teacherName = session?.fullName ?? _teacherName;
      _loading = false;
    });
  }

  Future<void> _createExam() async {
    final result = await Navigator.push<Map<String, dynamic>>(
      context,
      MaterialPageRoute(builder: (_) => const TeacherCreateExamPage()),
    );
    if (!mounted || result == null) return;

    try {
      await PlannedExamApiService.instance.createPlannedExam({
        "title": result["title"],
        "type": result["type"],
        "className": result["className"],
        "subject": result["subject"],
        "dateLabel": result["date"],
        "duration": result["duration"],
        "questionCount": result["questionCount"],
        "teacherName": _teacherName,
        "sourceType": result["sourceType"],
        "sources": result["sources"],
      });
      await _loadExams();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Planlı sınav oluşturuldu.")),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  void _showExamDetail(Map<String, dynamic> exam) {
    final theme = Theme.of(context);
    final sources = (exam["sources"] as List?) ?? [];

    showModalBottomSheet(
      context: context,
      backgroundColor: theme.cardColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) {
        return ResponsiveSheetContainer(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Wrap(
              runSpacing: 14,
              children: [
                Center(
                  child: Container(
                    width: 48,
                    height: 5,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade400,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                Text(
                  _decodeText(exam["title"] as String?),
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                _detailRow("Ders", _decodeText(exam["subject"] as String?)),
                _detailRow("Sınıf", exam["className"] as String),
                _detailRow("Tür", _decodeText(exam["type"] as String?)),
                _detailRow("Tarih", exam["date"] as String),
                _detailRow("Soru", "${exam["questionCount"]}"),
                _detailRow("Süre", exam["duration"] as String),
                _detailRow("Kaynak", exam["sourceType"] as String? ?? "-"),
                if (exam["avgScore"] != null)
                  _detailRow("Ortalama", exam["avgScore"] as String),
                if (sources.isNotEmpty) ...[
                  Text(
                    "Seçilen İçerikler",
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  ...sources.map(
                    (item) => Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: theme.scaffoldBackgroundColor,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            item["type"] == "Deneme"
                                ? Icons.fact_check_rounded
                                : Icons.quiz_rounded,
                            color: theme.colorScheme.primary,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(_decodeText(item["title"] as String?)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(sheetContext),
                    child: const Text("Kapat"),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _detailRow(String label, String value) {
    return Builder(
      builder: (context) {
        final theme = Theme.of(context);

        return Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: theme.scaffoldBackgroundColor,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 90,
                child: Text(
                  "$label:",
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              Expanded(child: Text(value)),
            ],
          ),
        );
      },
    );
  }

  void _deleteExam(List<Map<String, dynamic>> list, int index) {
    final title = list[index]["title"] as String;
    final id = list[index]["id"] as String?;

    () async {
      if (id != null && id.isNotEmpty) {
        try {
          await PlannedExamApiService.instance.deletePlannedExam(id);
        } catch (error) {
          if (!mounted) return;
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(error.toString())));
          return;
        }
      }

      if (!mounted) return;
      setState(() {
        list.removeAt(index);
      });

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("$title silindi")));
    }();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final currentList = selectedTab == 0 ? upcomingExams : completedExams;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: TeacherHeader(
        title: "Sinavlarim",
        teacherName: _teacherName.isEmpty ? 'Öğretmen' : _teacherName,
        subtitle: '${completedExams.length} tamamlanan sınav',
        showBackButton: true,
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _createExam,
        backgroundColor: theme.colorScheme.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: ResponsiveContent(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_loading)
                const Padding(
                  padding: EdgeInsets.only(bottom: 16),
                  child: LinearProgressIndicator(),
                ),
              _heroCard(theme, isDark),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const TeacherExamScoreEntryPage(),
                    ),
                  ),
                  icon: const Icon(Icons.edit_note_rounded),
                  label: const Text('Sınav Notu / Deneme Puanı Gir'),
                ),
              ),
              const SizedBox(height: 18),
              _tabBar(theme),
              const SizedBox(height: 18),
              if (currentList.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: theme.cardColor,
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: Text(
                    selectedTab == 0
                        ? 'Henüz planlı sınav bulunmuyor.'
                        : 'Henüz gosterilecek tamamlanmis sınav bulunmuyor.',
                  ),
                ),
              ...currentList.asMap().entries.map((entry) {
                final index = entry.key;
                final item = entry.value;

                return _examCard(
                  theme,
                  isDark,
                  item,
                  index,
                  selectedTab == 0 ? upcomingExams : completedExams,
                );
              }),
            ],
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
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
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
                "Sınav Yönetimi",
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
            "Yaklaşan sınavlarını planla, tamamlanan sınavları analiz et ve tüm süreci tek ekrandan yönet.",
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.92),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _heroStat("${upcomingExams.length}", "Yaklaşan"),
              const SizedBox(width: 12),
              _heroStat("${completedExams.length}", "Tamamlanan"),
              const SizedBox(width: 12),
              _heroStat(
                "${completedExams.isEmpty ? 0 : completedExams.length}",
                "Rapor",
              ),
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

  Widget _examCard(
    ThemeData theme,
    bool isDark,
    Map<String, dynamic> item,
    int index,
    List<Map<String, dynamic>> sourceList,
  ) {
    final subjectTheme = _themeForSubject(item["subject"]?.toString() ?? '');
    final accent = item["accentColor"] as Color;
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
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
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: subjectTheme.gradient,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(24),
              ),
            ),
            child: Stack(
              children: [
                Positioned(
                  right: -10,
                  top: -8,
                  child: Text(
                    subjectTheme.monogram,
                    style: TextStyle(
                      fontSize: 72,
                      fontWeight: FontWeight.w900,
                      color: Colors.white.withValues(alpha: 0.10),
                    ),
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.16),
                            borderRadius: BorderRadius.circular(16),
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
                            '${item["questionCount"]} soru',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      _decodeText(item["subject"] as String?),
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: Colors.white.withValues(alpha: 0.88),
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.7,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _decodeText(item["title"] as String?),
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
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _metaPill(
                      theme,
                      item["className"] as String,
                      subjectTheme.ink,
                    ),
                    _metaPill(
                      theme,
                      _decodeText(item["type"] as String?),
                      const Color(0xFF334155),
                    ),
                    _metaPill(
                      theme,
                      item["status"] as String,
                      item["statusColor"] as Color,
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: _metaChip(
                        theme,
                        icon: Icons.schedule_rounded,
                        text: item["date"] as String,
                        color: accent,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _metaChip(
                        theme,
                        icon: Icons.timer_outlined,
                        text: item["duration"] as String,
                        color: accent,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _metaChip(
                        theme,
                        icon: Icons.layers_outlined,
                        text: _decodeText(item["sourceType"] as String?) == ''
                            ? "Kaynak yok"
                            : _decodeText(item["sourceType"] as String?),
                        color: accent,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _showExamDetail(item),
                        icon: const Icon(Icons.visibility_outlined),
                        label: const Text("Detay"),
                        style: OutlinedButton.styleFrom(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () async {
                          if (selectedTab == 0) {
                            final updatedExam =
                                await Navigator.push<Map<String, dynamic>>(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) =>
                                        TeacherExamEditPage(exam: item),
                                  ),
                                );

                            if (updatedExam != null) {
                              setState(() {
                                sourceList[index] = updatedExam;
                              });
                            }
                          } else {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) =>
                                    TeacherExamResultsPage(exam: item),
                              ),
                            );
                          }
                        },
                        icon: Icon(
                          selectedTab == 0
                              ? Icons.edit_note_rounded
                              : Icons.bar_chart_rounded,
                        ),
                        label: Text(selectedTab == 0 ? "Düzenle" : "Sonuçlar"),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: accent,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: () => _deleteExam(sourceList, index),
                    icon: const Icon(
                      Icons.delete_outline_rounded,
                      color: Colors.redAccent,
                    ),
                    label: const Text(
                      'Sil',
                      style: TextStyle(color: Colors.redAccent),
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

  Widget _metaPill(ThemeData theme, String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: theme.textTheme.bodySmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _metaChip(
    ThemeData theme, {
    required IconData icon,
    required String text,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TeacherExamSubjectTheme {
  final List<Color> gradient;
  final Color ink;
  final String monogram;
  final String tagline;
  final IconData icon;

  const _TeacherExamSubjectTheme({
    required this.gradient,
    required this.ink,
    required this.monogram,
    required this.tagline,
    required this.icon,
  });
}

_TeacherExamSubjectTheme _themeForSubject(String subject) {
  switch (subject.trim().toLowerCase()) {
    case 'matematik':
      return const _TeacherExamSubjectTheme(
        gradient: [Color(0xFF1D4ED8), Color(0xFF38BDF8)],
        ink: Color(0xFF1D4ED8),
        monogram: 'M',
        tagline: 'Soru akışı, süre ve zorluk dengesi.',
        icon: Icons.functions_rounded,
      );
    case 'türkçe':
    case 'turkce':
      return const _TeacherExamSubjectTheme(
        gradient: [Color(0xFF0F766E), Color(0xFF14B8A6)],
        ink: Color(0xFF115E59),
        monogram: 'TR',
        tagline: 'Dil, yorum ve paragraf performansı.',
        icon: Icons.menu_book_rounded,
      );
    case 'fizik':
      return const _TeacherExamSubjectTheme(
        gradient: [Color(0xFF7C3AED), Color(0xFFA855F7)],
        ink: Color(0xFF6D28D9),
        monogram: 'F',
        tagline: 'Kuvvet, hareket ve problem çözümü.',
        icon: Icons.bolt_rounded,
      );
    case 'kimya':
      return const _TeacherExamSubjectTheme(
        gradient: [Color(0xFF059669), Color(0xFF34D399)],
        ink: Color(0xFF047857),
        monogram: 'K',
        tagline: 'Tepkime ve kavram kontrolü.',
        icon: Icons.science_rounded,
      );
    default:
      return const _TeacherExamSubjectTheme(
        gradient: [Color(0xFF334155), Color(0xFF64748B)],
        ink: Color(0xFF334155),
        monogram: 'SN',
        tagline: 'Planlanan oturumlar ve sonuç akışı.',
        icon: Icons.fact_check_rounded,
      );
  }
}
