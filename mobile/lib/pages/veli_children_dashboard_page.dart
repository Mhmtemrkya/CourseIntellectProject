import 'package:flutter/material.dart';

import '../services/accounting_finance_store.dart';
import '../services/attendance_service.dart';
import '../services/linked_children_service.dart';
import '../services/school_feed_api_service.dart';

class VeliChildrenDashboardPage extends StatefulWidget {
  const VeliChildrenDashboardPage({super.key});

  @override
  State<VeliChildrenDashboardPage> createState() => _VeliChildrenDashboardPageState();
}

class _VeliChildrenDashboardPageState extends State<VeliChildrenDashboardPage> {
  List<(String, String, String, String, Color)> _children = const [];

  @override
  void initState() {
    super.initState();
    _loadChildren();
  }

  Future<void> _loadChildren() async {
    await AccountingFinanceStore.instance.loadDashboard();
    await AttendanceService.instance.refresh();
    final linkedChildren = await LinkedChildrenService.instance.loadLinkedChildren();
    final examResults = await SchoolFeedApiService.instance.fetchExamResults();

    final rows = linkedChildren.map((child) {
      final attendance = AttendanceService.instance.forStudent(child.fullName);
      final absent = attendance.where((item) => item.status == 'Devamsiz').length;
      final overdue = AccountingFinanceStore.instance.installments
          .where((item) => item.student == child.fullName && item.status == 'Geciken')
          .length;
      final childScores = examResults.where((item) => _normalize(item.studentName) == _normalize(child.fullName)).toList();
      final average = childScores.isEmpty
          ? 0.0
          : childScores.fold<int>(0, (sum, item) => sum + item.score) / childScores.length;
      final note = overdue > 0 ? '$overdue finans uyarisi' : '$absent devamsizlik kaydi';
      final color = child.className.contains('11') ? const Color(0xFF2563EB) : const Color(0xFF0F766E);
      return (child.fullName, child.className, '${average.toStringAsFixed(1)} ortalama', note, color);
    }).toList();

    if (!mounted) return;
    setState(() => _children = rows);
  }

  @override
  Widget build(BuildContext context) {
    final children = _children;

    return Scaffold(
      appBar: AppBar(title: const Text('Cocuk Bazli Dashboard', style: TextStyle(fontWeight: FontWeight.bold))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: children
            .map(
              (child) => InkWell(
                borderRadius: BorderRadius.circular(22),
                onTap: () => _showChildDetail(context, child),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Theme.of(context).cardColor,
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          CircleAvatar(
                            backgroundColor: child.$5.withValues(alpha: 0.12),
                            child: Text(child.$1[0], style: TextStyle(color: child.$5, fontWeight: FontWeight.w900)),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  child.$1.replaceAll('Yilmaz', 'Yılmaz'),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
                                ),
                                const SizedBox(height: 2),
                                Text(child.$2, style: Theme.of(context).textTheme.bodySmall),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Icon(Icons.chevron_right_rounded, color: child.$5),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _infoChip(context, child.$3, child.$5),
                          _infoChip(context, child.$4, child.$5),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            )
            .toList(),
      ),
    );
  }

  Widget _infoChip(BuildContext context, String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }

  void _showChildDetail(
    BuildContext context,
    (String, String, String, String, Color) child,
  ) {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(child.$1.replaceAll('Yilmaz', 'Yılmaz')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Sinif: ${child.$2}'),
            const SizedBox(height: 8),
            Text('Akademik Ozet: ${child.$3}'),
            const SizedBox(height: 8),
            Text('Durum: ${child.$4}'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Kapat'),
          ),
        ],
      ),
    );
  }

  String _normalize(String value) {
    return value
        .trim()
        .toLowerCase()
        .replaceAll('ç', 'c')
        .replaceAll('ğ', 'g')
        .replaceAll('ı', 'i')
        .replaceAll('ö', 'o')
        .replaceAll('ş', 's')
        .replaceAll('ü', 'u');
  }
}
