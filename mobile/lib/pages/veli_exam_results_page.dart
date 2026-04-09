import 'package:flutter/material.dart';

import '../services/auth_session_store.dart';
import '../services/exam_results_store.dart';
import '../services/school_feed_api_service.dart';
import '../widgets/app_header.dart';
import '../widgets/responsive_layout.dart';
import 'student_exam_history_page.dart';

class VeliExamResultsPage extends StatefulWidget {
  const VeliExamResultsPage({super.key});

  @override
  State<VeliExamResultsPage> createState() => _VeliExamResultsPageState();
}

class _VeliExamResultsPageState extends State<VeliExamResultsPage> {
  String _selectedSegment = 'Tumu';
  bool _loading = true;
  String? _error;
  String _studentName = '';
  List<ExamScoreRecord> _records = const [];

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
        .replaceAll('&#x11E;', 'Ğ');
  }

  @override
  void initState() {
    super.initState();
    _loadRecords();
  }

  @override
  Widget build(BuildContext context) {
    final allRecords = _records;
    final filteredRecords = _filterRecords(allRecords);
    final average = _averageForStudent(allRecords).toStringAsFixed(1);
    final trialRecords = allRecords.where((item) => item.type == 'Deneme').toList();
    final lessonGroups = _groupBySubject(allRecords);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: const AppHeader(title: 'Sinav Sonuclari'),
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
              _heroCard(context, average, allRecords.length),
              const SizedBox(height: 16),
              _segmentBar(),
              const SizedBox(height: 16),
              _summaryGrid(context, allRecords, trialRecords),
              const SizedBox(height: 16),
              _trialSection(context, trialRecords),
              const SizedBox(height: 16),
              _lessonSection(context, lessonGroups),
              const SizedBox(height: 16),
              _recentResultsSection(context, filteredRecords),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => StudentExamHistoryPage(
                        studentName: _studentName,
                        title: 'Ogrenci Sonuc Gecmisi',
                      ),
                    ),
                  ),
                  icon: const Icon(Icons.bar_chart_rounded),
                  label: const Text('Tum Sonuclari Gor'),
                ),
              ),
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
      final studentName = await SchoolFeedApiService.resolveLinkedStudentName(session);
      final records = await SchoolFeedApiService.instance.fetchExamResults(studentName: studentName);
      if (!mounted) return;
      setState(() {
        _studentName = studentName;
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

  Widget _heroCard(BuildContext context, String average, int totalCount) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF1D4ED8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Sinav performans merkezi',
            style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            '${_decodeText(_studentName)} icin deneme, yazili ve ders bazli tum sonuclar profesyonel ozetle izlenir.',
            style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900, height: 1.2),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _heroMetric('Genel Ortalama', average),
              const SizedBox(width: 10),
              _heroMetric('Toplam Kayit', '$totalCount'),
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
            Text(label, style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18)),
          ],
        ),
      ),
    );
  }

  Widget _segmentBar() {
    final segments = ['Tumu', 'Deneme', 'Yazili', 'Quiz'];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: segments
            .map(
              (segment) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(segment),
                  selected: _selectedSegment == segment,
                  onSelected: (_) => setState(() => _selectedSegment = segment),
                ),
              ),
            )
            .toList(),
      ),
    );
  }

  Widget _summaryGrid(BuildContext context, List<ExamScoreRecord> allRecords, List<ExamScoreRecord> trialRecords) {
    final bestRecords = [...allRecords]..sort((a, b) => b.score.compareTo(a.score));
    final best = bestRecords.isEmpty ? null : bestRecords.first;
    final lastTrial = trialRecords.isNotEmpty ? trialRecords.first : null;

    if (ResponsiveLayout.isTablet(context)) {
      return Row(
        children: [
          Expanded(
            child: _summaryCard(
              context,
              title: 'En Yüksek Sonuç',
              value: best == null ? '-' : '${best.score}',
              subtitle: best == null ? 'Kayit yok' : '${_decodeText(best.subject)} • ${_decodeText(best.examTitle)}',
              color: const Color(0xFF0F766E),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _summaryCard(
              context,
              title: 'Son Deneme',
              value: lastTrial == null ? '-' : '${lastTrial.score}',
              subtitle: lastTrial == null ? 'Deneme yok' : '${lastTrial.date} • ${lastTrial.net} net',
              color: const Color(0xFFB45309),
            ),
          ),
        ],
      );
    }

    return Column(
      children: [
        _summaryCard(
          context,
          title: 'En Yüksek Sonuç',
          value: best == null ? '-' : '${best.score}',
          subtitle: best == null ? 'Kayit yok' : '${best.subject} • ${best.examTitle}',
          color: const Color(0xFF0F766E),
        ),
        const SizedBox(height: 10),
        _summaryCard(
          context,
          title: 'Son Deneme',
          value: lastTrial == null ? '-' : '${lastTrial.score}',
          subtitle: lastTrial == null ? 'Deneme yok' : '${lastTrial.date} • ${lastTrial.net} net',
          color: const Color(0xFFB45309),
        ),
      ],
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
          Text(title, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: color, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(value, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          Text(subtitle, style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.35)),
        ],
      ),
    );
  }

  Widget _trialSection(BuildContext context, List<ExamScoreRecord> trialRecords) {
    return _surfaceSection(
      context,
      title: 'Denemeler',
      child: trialRecords.isEmpty
          ? const Text('Bu ogrenci icin deneme kaydi bulunmuyor.')
          : Column(
              children: trialRecords
                  .map(
                    (item) => _resultRow(
                      context,
                      title: _decodeText(item.examTitle),
                      subtitle: '${item.date} • ${item.net} net',
                      score: item.score,
                      color: const Color(0xFFB45309),
                    ),
                  )
                  .toList(),
            ),
    );
  }

  Widget _lessonSection(BuildContext context, Map<String, List<ExamScoreRecord>> lessonGroups) {
    return _surfaceSection(
      context,
      title: 'Ders Bazli Sonuclar',
      child: Column(
        children: lessonGroups.entries.map((entry) {
          final avg = (entry.value.fold<int>(0, (sum, item) => sum + item.score) / entry.value.length).round();
          final last = entry.value.first;
          final color = _subjectColor(entry.key);

          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.book_outlined, color: color),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_decodeText(entry.key), style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      Text('Ortalama $avg • Son kayit ${_decodeText(last.type)}', style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
                Text('$avg', style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 20)),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _recentResultsSection(BuildContext context, List<ExamScoreRecord> records) {
    return _surfaceSection(
      context,
      title: _selectedSegment == 'Tumu' ? 'Tum Kayitlar' : '$_selectedSegment Kayitlari',
      child: records.isEmpty
          ? const Text('Secilen grupta kayit bulunmuyor.')
          : Column(
              children: records
                  .map(
                    (item) => _resultRow(
                      context,
                      title: _decodeText(item.examTitle),
                      subtitle: '${_decodeText(item.subject)} • ${item.date} • ${item.net} net',
                      score: item.score,
                      color: _subjectColor(item.subject),
                    ),
                  )
                  .toList(),
            ),
    );
  }

  Widget _surfaceSection(BuildContext context, {required String title, required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _resultRow(
    BuildContext context, {
    required String title,
    required String subtitle,
    required int score,
    required Color color,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text('$score', style: TextStyle(color: color, fontWeight: FontWeight.w900)),
          ),
        ],
      ),
    );
  }

  List<ExamScoreRecord> _filterRecords(List<ExamScoreRecord> records) {
    if (_selectedSegment == 'Tumu') {
      return records;
    }
    return records.where((item) => item.type == _selectedSegment).toList();
  }

  Map<String, List<ExamScoreRecord>> _groupBySubject(List<ExamScoreRecord> records) {
    final map = <String, List<ExamScoreRecord>>{};
    for (final item in records) {
      map.putIfAbsent(_decodeText(item.subject), () => []).add(item);
    }
    return map;
  }

  Color _subjectColor(String subject) {
    switch (_decodeText(subject)) {
      case 'Matematik':
        return const Color(0xFF2563EB);
      case 'Türkçe':
        return const Color(0xFFB45309);
      case 'Fizik':
        return const Color(0xFF0F766E);
      case 'Genel':
        return const Color(0xFF7C3AED);
      default:
        return const Color(0xFF475569);
    }
  }
}
