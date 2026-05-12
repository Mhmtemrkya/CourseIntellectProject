import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../services/attendance_service.dart';
import '../services/exam_results_store.dart';
import '../services/school_feed_api_service.dart';
import '../services/student_registry_store.dart';
import '../widgets/admin_ui.dart';

class AdminKpiDashboardPage extends StatefulWidget {
  const AdminKpiDashboardPage({super.key});

  @override
  State<AdminKpiDashboardPage> createState() => _AdminKpiDashboardPageState();
}

class _AdminKpiDashboardPageState extends State<AdminKpiDashboardPage> {
  List<ExamScoreRecord> _records = const [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    await Future.wait([
      StudentRegistryStore.instance.ensureLoaded(),
      AccountingFinanceStore.instance.loadDashboard(),
      AttendanceService.instance.refresh(),
    ]);
    final records = await SchoolFeedApiService.instance.fetchExamResults();
    if (!mounted) return;
    setState(() {
      _records = records;
    });
  }

  @override
  Widget build(BuildContext context) {
    final totalStudents = StudentRegistryStore.instance.students.length;
    final absentCount = AttendanceService.instance
        .all()
        .where((item) => item.status == 'Devamsiz')
        .length;
    final attendanceTotal = AttendanceService.instance.all().length;
    final collectionRate = AccountingFinanceStore.instance.totalReceivables == 0
        ? 0.0
        : AccountingFinanceStore.instance.collectedTotal /
              AccountingFinanceStore.instance.totalReceivables;
    final occupancyRate = totalStudents == 0
        ? 0.0
        : (totalStudents / 1000).clamp(0.0, 1.0);
    final absenteeRisk = attendanceTotal == 0
        ? 0.0
        : absentCount / attendanceTotal;
    final academicScore = _records.isEmpty
        ? 0.0
        : (_records.fold<int>(0, (sum, item) => sum + item.score) /
                  _records.length) /
              100;

    final kpis = [
      ('Doluluk Orani', occupancyRate, const Color(0xFF2563EB)),
      ('Tahsilat Performansi', collectionRate, const Color(0xFF14532D)),
      ('Devamsızlık Riski', absenteeRisk, const Color(0xFFB45309)),
      ('Akademik Başarı', academicScore, const Color(0xFF7C3AED)),
    ];

    return AdminScaffold(
      appBar: AppBar(
        title: const Text(
          'Kurum KPI Grafikleri',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: kpis
            .map(
              (kpi) => AdminPanel(
                margin: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          kpi.$1,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        const Spacer(),
                        Text(
                          '%${(kpi.$2 * 100).round()}',
                          style: TextStyle(
                            color: kpi.$3,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: LinearProgressIndicator(
                        value: kpi.$2.clamp(0.0, 1.0),
                        minHeight: 10,
                        color: kpi.$3,
                        backgroundColor: kpi.$3.withValues(alpha: 0.12),
                      ),
                    ),
                  ],
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}
