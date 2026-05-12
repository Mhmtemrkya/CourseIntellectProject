import 'package:flutter/material.dart';

import 'admin_courses_page.dart';
import 'admin_exam_results_page.dart';
import 'admin_schedule_list_page.dart';
import '../services/attendance_service.dart';
import '../services/exam_results_store.dart';
import '../services/school_feed_api_service.dart';
import '../services/staff_registry_store.dart';
import 'teacher_reports_page.dart';
import '../widgets/admin_ui.dart';

class AdminAcademicsPage extends StatefulWidget {
  const AdminAcademicsPage({super.key});

  @override
  State<AdminAcademicsPage> createState() => _AdminAcademicsPageState();
}

class _AdminAcademicsPageState extends State<AdminAcademicsPage> {
  final _staffStore = StaffRegistryStore.instance;
  List<ExamScoreRecord> _records = const [];

  @override
  void initState() {
    super.initState();
    _staffStore.ensureLoaded().then((_) async {
      await AttendanceService.instance.refresh();
      final records = await SchoolFeedApiService.instance.fetchExamResults();
      if (mounted) {
        setState(() {
          _records = records;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final branchCards = _buildBranchCards();

    final teachers =
        (_staffStore.teachers.isEmpty
                ? _staffStore.staff
                : _staffStore.teachers)
            .take(4)
            .map(
              (teacher) => (
                teacher.fullName,
                teacher.branchOrDepartment,
                teacher.assignedClasses.isEmpty
                    ? 'Sınıf ataması bekleniyor'
                    : '${teacher.assignedClasses.length} sınıf',
                _teacherHealth(teacher.fullName),
              ),
            )
            .toList();

    final absentCount = AttendanceService.instance
        .all()
        .where((item) => item.status == 'Devamsiz')
        .length;
    final attendanceRate = AttendanceService.instance.all().isEmpty
        ? 100
        : (((AttendanceService.instance.all().length - absentCount) /
                      AttendanceService.instance.all().length) *
                  100)
              .round();
    final averageScore = _records.isEmpty
        ? 0
        : (_records.fold<int>(0, (sum, item) => sum + item.score) /
                  _records.length)
              .round();

    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Akademik Yönetim',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          AdminHeroCard(
            eyebrow: 'Akademik kontrol',
            title:
                'Sınıf başarısı, branş sağlığı ve öğretmen etkisini kurumsal düzeyde izleyin.',
            description:
                'Yönetici görünümünde sınav sonuçları, katılım ve öğretmen etkisi birlikte değerlendirilir.',
            metrics: [
              AdminHeroMetric(label: 'Kurum Ort.', value: '$averageScore'),
              AdminHeroMetric(label: 'Devam', value: '%$attendanceRate'),
            ],
          ),
          const SizedBox(height: 16),
          const AdminSectionTitle(title: 'Brans Durumu'),
          const SizedBox(height: 12),
          ...branchCards.map(
            (item) => AdminPanel(
              margin: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: item.$4.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(Icons.auto_graph_rounded, color: item.$4),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.$1,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${item.$2} • ${item.$3}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  AdminAccentBadge(label: item.$2, color: item.$4),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          const AdminSectionTitle(title: 'Öğretmen Etkisi'),
          const SizedBox(height: 12),
          ...teachers.map(
            (item) => AdminPanel(
              margin: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  const CircleAvatar(child: Icon(Icons.person_outline_rounded)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.$1,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${item.$2} • ${item.$3}',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  Text(
                    item.$4,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF14532D),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (teachers.isEmpty)
            const AdminPanel(child: Text('Henüz öğretmen kaydı görünmüyor.')),
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const AdminScheduleListPage()),
            ),
            icon: const Icon(Icons.schedule_rounded),
            label: const Text('Ders Programi Yönetimi'),
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const AdminCoursesPage()),
            ),
            icon: const Icon(Icons.menu_book_rounded),
            label: const Text('Kurs Yönetimi'),
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.tonalIcon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const TeacherReportsPage(),
                    ),
                  ),
                  icon: const Icon(Icons.analytics_outlined),
                  label: const Text('Rapor Merkezi'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const AdminExamResultsPage(),
                    ),
                  ),
                  icon: const Icon(Icons.fact_check_outlined),
                  label: const Text('Sınav Sonuçları'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  List<(String, String, String, Color)> _buildBranchCards() {
    if (_records.isEmpty) {
      return [
        (
          'Veri Yok',
          'Ort. 0',
          'Sonuç kaydı bekleniyor',
          const Color(0xFF9E9E9E),
        ),
      ];
    }

    final grouped = <String, List<ExamScoreRecord>>{};
    for (final item in _records) {
      grouped.putIfAbsent(item.subject, () => []).add(item);
    }

    final cards = grouped.entries.map((entry) {
      final average =
          (entry.value.fold<int>(0, (sum, item) => sum + item.score) /
                  entry.value.length)
              .round();
      final lowest = [...entry.value]
        ..sort((a, b) => a.score.compareTo(b.score));
      final color = average >= 80
          ? const Color(0xFF14532D)
          : average >= 70
          ? const Color(0xFF2563EB)
          : const Color(0xFFB45309);
      return (
        entry.key,
        'Ort. $average',
        'Risk: ${lowest.first.studentName}',
        color,
      );
    }).toList()..sort((a, b) => a.$2.compareTo(b.$2));

    return cards.take(4).toList();
  }

  String _teacherHealth(String teacherName) {
    final classes = _staffStore.staff
        .where((item) => item.fullName == teacherName)
        .expand((item) => item.assignedClasses)
        .toSet();
    if (classes.isEmpty || _records.isEmpty) {
      return 'Izleniyor';
    }

    final related = _records
        .where((item) => classes.contains(item.className))
        .toList();
    if (related.isEmpty) {
      return 'Izleniyor';
    }

    final average =
        (related.fold<int>(0, (sum, item) => sum + item.score) / related.length)
            .round();
    return '%$average etki';
  }
}
