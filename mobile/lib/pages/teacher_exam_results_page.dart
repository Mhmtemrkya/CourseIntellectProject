import 'package:flutter/material.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/exam_results_store.dart';
import 'package:student/services/school_feed_api_service.dart';
import 'package:student/widgets/teacher_header.dart';

class TeacherExamResultsPage extends StatefulWidget {
  final Map<String, dynamic> exam;

  const TeacherExamResultsPage({
    super.key,
    required this.exam,
  });

  @override
  State<TeacherExamResultsPage> createState() => _TeacherExamResultsPageState();
}

class _TeacherExamResultsPageState extends State<TeacherExamResultsPage> {
  String _teacherName = '';
  List<ExamScoreRecord> _records = const [];
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
      final effective = exactMatches.isNotEmpty
          ? exactMatches
          : subjectMatches.isNotEmpty
              ? subjectMatches
              : fetched.where((item) => item.className == className).toList();

      if (!mounted) return;
      setState(() {
        _teacherName = session?.fullName ?? _teacherName;
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
    final averageScore = _records.isEmpty
        ? 0
        : (_records.fold<int>(0, (sum, item) => sum + item.score) / _records.length)
            .round();
    final highestScore = _records.isEmpty
        ? 0
        : _records.fold<int>(
            0,
            (maxValue, item) => item.score > maxValue ? item.score : maxValue,
          );
    final subject = widget.exam["subject"] as String? ?? (_records.isNotEmpty ? _records.first.subject : 'Ders');

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: TeacherHeader(
        title: "Sinav Sonuclari",
        teacherName: _teacherName.isEmpty ? 'Ogretmen' : _teacherName,
        subtitle: "$subject Ogretmeni",
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
                        ? "Sinav Sonuclari"
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
                      _stat(theme, "Katilim", "${_records.length}"),
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
            else if (_records.isEmpty)
              _messageCard(
                theme,
                icon: Icons.fact_check_outlined,
                message: 'Bu sinav icin henuz sonuc bulunmuyor.',
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
                        backgroundColor:
                            theme.colorScheme.primary.withValues(alpha: 0.14),
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
                            Text('Net: ${item.net} • ${_decodeText(item.subject)}'),
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
