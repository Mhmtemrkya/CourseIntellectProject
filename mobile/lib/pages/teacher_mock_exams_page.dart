import 'package:flutter/material.dart';

import '../services/auth_session_store.dart';
import '../services/planned_exam_api_service.dart';
import '../widgets/responsive_layout.dart';
import '../widgets/teacher_empty_state_panel.dart';
import '../widgets/teacher_header.dart';
import 'teacher_question_studio_page.dart';

class TeacherMockExamsPage extends StatefulWidget {
  const TeacherMockExamsPage({super.key});

  @override
  State<TeacherMockExamsPage> createState() => _TeacherMockExamsPageState();
}

class _TeacherMockExamsPageState extends State<TeacherMockExamsPage> {
  bool _loading = true;
  String _teacherName = 'Öğretmen';
  String? _error;
  List<PlannedExamRecord> _exams = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  bool _isMockExam(PlannedExamRecord exam) {
    final type = exam.type.trim().toLowerCase();
    return type == 'mockexam' || type.contains('deneme');
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = await AuthSessionStore.instance.load();
      final records = await PlannedExamApiService.instance.fetchPlannedExams(
        teacherName: session?.fullName,
      );
      if (!mounted) return;
      setState(() {
        _teacherName = session?.fullName ?? _teacherName;
        _exams = records.where(_isMockExam).toList();
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.toString();
      });
    }
  }

  Future<void> _create() async {
    final created = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => const TeacherQuestionStudioPage(examMode: true),
      ),
    );
    if (created == true) {
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Deneme sınavı oluşturuldu.')),
      );
    }
  }

  Future<void> _delete(PlannedExamRecord exam) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Denemeyi sil'),
        content: Text(
          '${exam.title} kaydını silmek istediğinizden emin misiniz?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Vazgeç'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sil'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await PlannedExamApiService.instance.deletePlannedExam(exam.id);
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final totalQuestions = _exams.fold<int>(
      0,
      (sum, exam) => sum + exam.questionCount,
    );

    return Scaffold(
      appBar: TeacherHeader(
        title: 'Deneme Sınavları',
        teacherName: _teacherName,
        subtitle: '${_exams.length} canlı deneme',
        showBackButton: true,
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Deneme Oluştur'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 92),
          child: ResponsiveContent(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _heroCard(totalQuestions),
                const SizedBox(height: 16),
                if (_loading) const LinearProgressIndicator(),
                if (_error != null) ...[
                  _messageCard(
                    icon: Icons.cloud_off_rounded,
                    title: 'Canlı denemeler alınamadı',
                    description: _error!,
                    action: TextButton(
                      onPressed: _load,
                      child: const Text('Tekrar Dene'),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                if (!_loading && _error == null && _exams.isEmpty)
                  TeacherEmptyStatePanel(
                    title: 'Henüz deneme sınavı oluşturulmadı',
                    description:
                        'İlk denemeni oluştur, sorularını ekle ve öğrencilerin için yayınla.',
                    accentColor: const Color(0xFFFF8A1C),
                    mainIcon: Icons.fact_check_outlined,
                    primaryLabel: 'Deneme Oluştur',
                    onPrimary: _create,
                    secondaryLabel: 'Yenile',
                    onSecondary: _load,
                    tipDescription:
                        'Oluşturduğun denemeler canlı sistemden bu ekranda listelenir.',
                    floatingIcons: const [
                      Icons.timer_outlined,
                      Icons.quiz_outlined,
                      Icons.check_circle_outline,
                    ],
                  ),
                ..._exams.map((exam) => _examCard(theme, exam)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _heroCard(int totalQuestions) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(26),
        gradient: const LinearGradient(
          colors: [Color(0xFFFF7A00), Color(0xFFFFA03B)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.fact_check_rounded, color: Colors.white, size: 28),
              SizedBox(width: 10),
              Text(
                'Deneme Yönetimi',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Deneme sorularını ortak editörden hazırlayın ve canlı yayınlayın.',
            style: TextStyle(color: Colors.white, height: 1.4),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _stat('${_exams.length}', 'Deneme'),
              const SizedBox(width: 10),
              _stat('$totalQuestions', 'Soru'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _stat(String value, String label) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(16),
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
            Text(label, style: const TextStyle(color: Colors.white70)),
          ],
        ),
      ),
    );
  }

  Widget _examCard(ThemeData theme, PlannedExamRecord exam) {
    return Container(
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: theme.dividerColor.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Chip(label: Text('Deneme Sınavı')),
              const Spacer(),
              IconButton(
                onPressed: () => _delete(exam),
                icon: const Icon(Icons.delete_outline_rounded),
              ),
            ],
          ),
          Text(
            exam.title,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text('${exam.subject} · ${exam.className}'),
          const SizedBox(height: 14),
          Row(
            children: [
              _detail(Icons.calendar_today_outlined, exam.date),
              _detail(Icons.timer_outlined, exam.duration),
              _detail(Icons.quiz_outlined, '${exam.questionCount} soru'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _detail(IconData icon, String value) {
    return Expanded(
      child: Row(
        children: [
          Icon(icon, size: 15, color: const Color(0xFFFF8A1C)),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              value.isEmpty ? '-' : value,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _messageCard({
    required IconData icon,
    required String title,
    required String description,
    required Widget action,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.error),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  Text(description),
                ],
              ),
            ),
            action,
          ],
        ),
      ),
    );
  }
}
