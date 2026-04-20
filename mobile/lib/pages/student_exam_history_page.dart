import 'package:flutter/material.dart';

import '../services/auth_session_store.dart';
import '../services/exam_results_store.dart';
import '../services/school_feed_api_service.dart';
import 'student_exam_group_detail_page.dart';
import '../widgets/responsive_layout.dart';

class StudentExamHistoryPage extends StatefulWidget {
  final String studentName;
  final String title;

  const StudentExamHistoryPage({
    super.key,
    required this.studentName,
    required this.title,
  });

  @override
  State<StudentExamHistoryPage> createState() => _StudentExamHistoryPageState();
}

class _StudentExamHistoryPageState extends State<StudentExamHistoryPage> {
  bool _loading = true;
  String? _error;
  List<ExamScoreRecord> _records = const [];

  @override
  void initState() {
    super.initState();
    _loadRecords();
  }

  @override
  Widget build(BuildContext context) {
    final records = _records;
    final average = _averageForStudent(records).toStringAsFixed(1);
    final denemeler = records.where((item) => item.type == 'Deneme').toList();
    final lessons = _groupByLesson(records);
    final bestRecords = [...records]
      ..sort((a, b) => b.score.compareTo(a.score));
    final best = bestRecords.isEmpty ? null : bestRecords.first;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(title: Text(widget.title)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(_error!, textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _loadRecords,
                    child: const Text('Tekrar Dene'),
                  ),
                ],
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: ResponsiveContent(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _heroCard(average, records.length),
                    const SizedBox(height: 16),
                    ResponsiveLayout.isTablet(context)
                        ? Row(
                            children: [
                              Expanded(
                                child: _summaryCard(
                                  context,
                                  title: 'En Yuksek Not',
                                  value: best == null ? '-' : '${best.score}',
                                  subtitle: best == null
                                      ? 'Kayıt yok'
                                      : '${best.subject} • ${best.type}',
                                  color: const Color(0xFF10B981),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: _summaryCard(
                                  context,
                                  title: 'Deneme Sayisi',
                                  value: '${denemeler.length}',
                                  subtitle: denemeler.isEmpty
                                      ? 'Deneme kaydı yok'
                                      : 'Tüm deneme sonuçların hazır',
                                  color: const Color(0xFFF59E0B),
                                ),
                              ),
                            ],
                          )
                        : Column(
                            children: [
                              _summaryCard(
                                context,
                                title: 'En Yuksek Not',
                                value: best == null ? '-' : '${best.score}',
                                subtitle: best == null
                                    ? 'Kayıt yok'
                                    : '${best.subject} • ${best.type}',
                                color: const Color(0xFF10B981),
                              ),
                              const SizedBox(height: 10),
                              _summaryCard(
                                context,
                                title: 'Deneme Sayisi',
                                value: '${denemeler.length}',
                                subtitle: denemeler.isEmpty
                                    ? 'Deneme kaydı yok'
                                    : 'Tüm deneme sonuçların hazır',
                                color: const Color(0xFFF59E0B),
                              ),
                            ],
                          ),
                    const SizedBox(height: 18),
                    _sectionTitle(context, 'Denemeler'),
                    const SizedBox(height: 12),
                    _groupCard(
                      context,
                      title: 'Tüm Deneme Sonuçları',
                      subtitle: denemeler.isEmpty
                          ? 'Henüz deneme kaydı yok'
                          : '${denemeler.length} kayıt • son skor ${denemeler.first.score}',
                      color: const Color(0xFFF59E0B),
                      trailing: denemeler.isEmpty
                          ? '-'
                          : '${denemeler.first.score}',
                      onTap: denemeler.isEmpty
                          ? null
                          : () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => StudentExamGroupDetailPage(
                                  title: 'Denemeler',
                                  subtitle: widget.studentName,
                                  color: const Color(0xFFF59E0B),
                                  records: denemeler,
                                ),
                              ),
                            ),
                    ),
                    const SizedBox(height: 18),
                    _sectionTitle(context, 'Dersler'),
                    const SizedBox(height: 12),
                    ...lessons.entries.map((entry) {
                      final color = _subjectColor(entry.key);
                      final sorted = [...entry.value]
                        ..sort((a, b) => b.date.compareTo(a.date));
                      final oralCount = entry.value
                          .where((item) => item.type == 'Sözlü')
                          .length;
                      final writtenCount = entry.value
                          .where((item) => item.type == 'Yazılı')
                          .length;
                      final quizCount = entry.value
                          .where((item) => item.type == 'Quiz')
                          .length;
                      final average =
                          (entry.value.fold<int>(
                                    0,
                                    (sum, item) => sum + item.score,
                                  ) /
                                  entry.value.length)
                              .round();

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _groupCard(
                          context,
                          title: entry.key,
                          subtitle:
                              'Yazılı $writtenCount • Sözlü $oralCount • Quiz $quizCount',
                          color: color,
                          trailing: '$average',
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => StudentExamGroupDetailPage(
                                title: entry.key,
                                subtitle: widget.studentName,
                                color: color,
                                records: sorted,
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
    );
  }

  Future<void> _loadRecords() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = await AuthSessionStore.instance.load();
      final studentName = session?.primaryRole == 'Student'
          ? await SchoolFeedApiService.resolveLinkedStudentName(session)
          : SchoolFeedApiService.normalizeStudentQuery(widget.studentName);
      final records = await SchoolFeedApiService.instance.fetchExamResults(
        studentName: studentName,
      );
      if (!mounted) return;
      setState(() {
        _records = records;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  double _averageForStudent(List<ExamScoreRecord> records) {
    if (records.isEmpty) return 0;
    final total = records.fold<int>(0, (sum, item) => sum + item.score);
    return total / records.length;
  }

  Widget _heroCard(String average, int totalCount) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFFF59E0B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.studentName,
            style: const TextStyle(
              color: Colors.white70,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Bütün ders notlarını ve girdigin tüm deneme sonuçlarını tek merkezden ac.',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w900,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _heroMetric('Genel Ortalama', average),
              const SizedBox(width: 10),
              _heroMetric('Toplam Kayıt', '$totalCount'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroMetric(String label, String value) {
    return Expanded(
      child: Container(
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
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 18,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _summaryCard(
    BuildContext context, {
    required String title,
    required String value,
    required String subtitle,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(22),
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
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(height: 1.35),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(BuildContext context, String title) {
    return Text(
      title,
      style: Theme.of(
        context,
      ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
    );
  }

  Widget _groupCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required Color color,
    required String trailing,
    VoidCallback? onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(Icons.open_in_new_rounded, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text(
              trailing,
              style: TextStyle(
                color: color,
                fontWeight: FontWeight.w900,
                fontSize: 18,
              ),
            ),
            const SizedBox(width: 4),
            Icon(Icons.chevron_right_rounded, color: color),
          ],
        ),
      ),
    );
  }

  Map<String, List<ExamScoreRecord>> _groupByLesson(
    List<ExamScoreRecord> records,
  ) {
    final map = <String, List<ExamScoreRecord>>{};
    for (final item in records.where((record) => record.subject != 'Genel')) {
      map.putIfAbsent(item.subject, () => []).add(item);
    }
    return map;
  }

  Color _subjectColor(String subject) {
    switch (subject) {
      case 'Matematik':
        return const Color(0xFF2563EB);
      case 'Turkce':
        return const Color(0xFFB45309);
      case 'Fizik':
        return const Color(0xFF0F766E);
      default:
        return const Color(0xFF475569);
    }
  }
}
