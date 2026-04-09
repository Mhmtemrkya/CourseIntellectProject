import 'package:flutter/material.dart';

import '../services/exam_results_store.dart';
import '../services/school_feed_api_service.dart';
import '../widgets/admin_ui.dart';
import 'student_exam_history_page.dart';

class AdminExamResultsPage extends StatefulWidget {
  const AdminExamResultsPage({super.key});

  @override
  State<AdminExamResultsPage> createState() => _AdminExamResultsPageState();
}

class _AdminExamResultsPageState extends State<AdminExamResultsPage> {
  String _selectedClass = 'Tümü';
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
    final classes = ['Tümü', ..._records.map((item) => item.className).toSet().toList()..sort()];
    final students = _records.map((item) => item.studentName).toSet().where((student) {
      if (_selectedClass == 'Tümü') return true;
      return _records.any((item) => item.studentName == student && item.className == _selectedClass);
    }).toList()
      ..sort();

    return AdminScaffold(
      appBar: AppBar(
        title: const Text('Sınav Sonuçları', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Sonuç merkezi',
            title: 'Öğrenci notları ve deneme sonuçlarını kurumsal düzeyde görüntüleyin.',
            description: 'Sınıf bazlı filtreleme ile öğrenci geçmişi ve genel sınav performansı açılır.',
            metrics: [
              AdminHeroMetric(label: 'Öğrenci', value: '${students.length}'),
              AdminHeroMetric(label: 'Kayıt', value: '${_records.length}'),
            ],
          ),
          const SizedBox(height: 16),
          AdminPanel(
            child: DropdownButtonFormField<String>(
              initialValue: _selectedClass,
              decoration: const InputDecoration(
                labelText: 'Sınıf Filtresi',
                border: OutlineInputBorder(),
              ),
              items: classes.map((value) => DropdownMenuItem(value: value, child: Text(value))).toList(),
              onChanged: (value) => setState(() => _selectedClass = value ?? 'Tümü'),
            ),
          ),
          const SizedBox(height: 16),
          if (_loading)
            const Padding(
              padding: EdgeInsets.only(top: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 48),
              child: Center(
                child: Column(
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _loadRecords,
                      child: const Text('Tekrar Dene'),
                    ),
                  ],
                ),
              ),
            )
          else
            ...students.map((student) {
              final studentRecords = _records.where((item) => item.studentName == student).toList();
              final average = studentRecords.isEmpty
                  ? 0.0
                  : studentRecords.fold<int>(0, (sum, item) => sum + item.score) / studentRecords.length;
              final className = studentRecords.first.className;
              return AdminPanel(
                margin: const EdgeInsets.only(bottom: 12),
                child: InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => StudentExamHistoryPage(
                        studentName: student,
                        title: 'Öğrenci Sonuç Geçmişi',
                      ),
                    ),
                  ),
                  child: Row(
                    children: [
                      const CircleAvatar(child: Icon(Icons.school_outlined)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(student, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                            const SizedBox(height: 4),
                            Text(className, style: Theme.of(context).textTheme.bodySmall),
                          ],
                        ),
                      ),
                      Text(
                        average.toStringAsFixed(1),
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
                      ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  Future<void> _loadRecords() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final records = await SchoolFeedApiService.instance.fetchExamResults();
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
}
