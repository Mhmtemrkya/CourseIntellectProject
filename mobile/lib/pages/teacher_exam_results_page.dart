import 'package:flutter/material.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/exam_results_store.dart';
import 'package:student/services/planned_exam_api_service.dart';
import 'package:student/services/school_feed_api_service.dart';
import 'package:student/widgets/teacher_header.dart';

class TeacherExamResultsPage extends StatefulWidget {
  final Map<String, dynamic> exam;

  const TeacherExamResultsPage({super.key, required this.exam});

  @override
  State<TeacherExamResultsPage> createState() => _TeacherExamResultsPageState();
}

class _TeacherExamResultsPageState extends State<TeacherExamResultsPage> {
  String _teacherName = '';
  List<ExamScoreRecord> _records = const [];
  List<PlannedExamSubmissionRecord> _submissions = const [];
  bool _loading = true;
  String? _error;

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
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final session = await AuthSessionStore.instance.load();
      final className = widget.exam["className"] as String? ?? '';
      final plannedExamId = widget.exam["id"] as String?;
      final plannedSubmissions = plannedExamId == null || plannedExamId.isEmpty
          ? const <PlannedExamSubmissionRecord>[]
          : await PlannedExamApiService.instance.fetchSubmissions(
              plannedExamId,
            );
      var effective = <ExamScoreRecord>[];
      if (plannedSubmissions.isEmpty) {
        final fetched = await SchoolFeedApiService.instance.fetchExamResults(
          className: className.isEmpty ? null : className,
        );
        final examTitle = widget.exam["title"] as String? ?? '';
        final exactMatches = fetched.where((item) {
          return item.className == className && item.examTitle == examTitle;
        }).toList();
        final subjectMatches = fetched.where((item) {
          return item.className == className &&
              item.subject == (widget.exam["subject"] as String? ?? '');
        }).toList();
        effective = exactMatches.isNotEmpty
            ? exactMatches
            : subjectMatches.isNotEmpty
            ? subjectMatches
            : fetched.where((item) => item.className == className).toList();
      }

      if (!mounted) return;
      setState(() {
        _teacherName = session?.fullName ?? _teacherName;
        _submissions = plannedSubmissions;
        _records = effective;
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final scoreValues = _submissions.isNotEmpty
        ? _submissions.map((item) => item.score).toList()
        : _records.map((item) => item.score).toList();
    final averageScore = scoreValues.isEmpty
        ? 0
        : (scoreValues.fold<int>(0, (sum, item) => sum + item) /
                  scoreValues.length)
              .round();
    final highestScore = scoreValues.isEmpty
        ? 0
        : scoreValues.fold<int>(
            0,
            (maxValue, item) => item > maxValue ? item : maxValue,
          );
    final subject =
        widget.exam["subject"] as String? ??
        (_records.isNotEmpty ? _records.first.subject : 'Ders');

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: TeacherHeader(
        title: "Sınav Sonuçları",
        teacherName: _teacherName.isEmpty ? 'Öğretmen' : _teacherName,
        subtitle: "$subject Öğretmeni",
        showBackButton: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _decodeText(widget.exam["title"] as String?) == ''
                        ? "Sınav Sonuçları"
                        : _decodeText(widget.exam["title"] as String?),
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${widget.exam["className"] ?? "-"} • ${widget.exam["date"] ?? "-"}',
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      _stat(theme, "Ort.", "$averageScore"),
                      const SizedBox(width: 10),
                      _stat(theme, "En Yuksek", "$highestScore"),
                      const SizedBox(width: 10),
                      _stat(
                        theme,
                        "Katılım",
                        "${_submissions.isNotEmpty ? _submissions.length : _records.length}",
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: CircularProgressIndicator(),
              )
            else if (_error != null)
              _messageCard(
                theme,
                icon: Icons.wifi_off_rounded,
                message: _error!,
              )
            else if (_submissions.isEmpty && _records.isEmpty)
              _messageCard(
                theme,
                icon: Icons.fact_check_outlined,
                message: 'Bu sınav için henüz sonuç bulunmuyor.',
              )
            else if (_submissions.isNotEmpty)
              ..._submissions.map(
                (item) => _submissionCard(theme, isDark, item),
              )
            else
              ..._records.map(
                (item) => Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: theme.cardColor,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: isDark
                            ? Colors.black.withValues(alpha: 0.16)
                            : Colors.black.withValues(alpha: 0.04),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: theme.colorScheme.primary.withValues(
                          alpha: 0.14,
                        ),
                        child: Text(
                          item.studentName[0],
                          style: TextStyle(
                            color: theme.colorScheme.primary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _decodeText(item.studentName),
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Net: ${item.net} • ${_decodeText(item.subject)}',
                            ),
                          ],
                        ),
                      ),
                      Text(
                        "${item.score}",
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: theme.colorScheme.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _submissionCard(
    ThemeData theme,
    bool isDark,
    PlannedExamSubmissionRecord item,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.16)
                : Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: theme.colorScheme.primary.withValues(
                  alpha: 0.14,
                ),
                child: Text(
                  (item.studentName.isEmpty ? '?' : item.studentName[0]),
                  style: TextStyle(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _decodeText(item.studentName),
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Doğru: ${item.correct} • Yanlış: ${item.wrong} • Boş: ${item.blank}',
                    ),
                  ],
                ),
              ),
              Text(
                "${item.score}",
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: theme.colorScheme.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _showSubmissionAnswers(item),
              icon: const Icon(Icons.fact_check_outlined),
              label: const Text('Cevapları Gör'),
            ),
          ),
        ],
      ),
    );
  }

  void _showSubmissionAnswers(PlannedExamSubmissionRecord submission) {
    final theme = Theme.of(context);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: theme.cardColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.78,
          minChildSize: 0.45,
          maxChildSize: 0.92,
          builder: (context, scrollController) {
            return ListView(
              controller: scrollController,
              padding: const EdgeInsets.all(18),
              children: [
                Text(
                  _decodeText(submission.studentName),
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Puan: ${submission.score} • Net: ${submission.net} • Toplam: ${submission.total}',
                ),
                const SizedBox(height: 16),
                ...submission.answers.map((answer) {
                  final isBlank = answer.selectedOptionIndex == null;
                  final color = isBlank
                      ? Colors.orange
                      : answer.isCorrect == true
                      ? Colors.green
                      : Colors.redAccent;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: theme.scaffoldBackgroundColor,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.quiz_outlined, color: color, size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '${answer.sortOrder + 1}. Soru',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            Text(
                              isBlank
                                  ? 'Boş'
                                  : answer.isCorrect == true
                                  ? 'Doğru'
                                  : 'Yanlış',
                              style: TextStyle(
                                color: color,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(_decodeText(answer.questionText)),
                        const SizedBox(height: 10),
                        Text(
                          'Öğrenci: ${isBlank ? "Cevaplamadı" : _decodeText(answer.selectedAnswerText)}',
                        ),
                        const SizedBox(height: 4),
                        Text('Doğru: ${_decodeText(answer.correctAnswerText)}'),
                      ],
                    ),
                  );
                }),
              ],
            );
          },
        );
      },
    );
  }

  Widget _messageCard(
    ThemeData theme, {
    required IconData icon,
    required String message,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(20),
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

  Widget _stat(ThemeData theme, String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: theme.scaffoldBackgroundColor,
          borderRadius: BorderRadius.circular(16),
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
            Text(label),
          ],
        ),
      ),
    );
  }
}
