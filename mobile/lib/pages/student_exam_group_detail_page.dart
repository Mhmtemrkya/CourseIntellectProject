import 'package:flutter/material.dart';

import '../services/exam_results_store.dart';
import '../widgets/responsive_layout.dart';

class StudentExamGroupDetailPage extends StatelessWidget {
  final String title;
  final String subtitle;
  final Color color;
  final List<ExamScoreRecord> records;

  const StudentExamGroupDetailPage({
    super.key,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.records,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: ResponsiveContent(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [const Color(0xFF0F172A), color],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(28),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(subtitle, style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Text(
                  '$title tum kayitlari',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 22, height: 1.15),
                ),
                const SizedBox(height: 8),
                Text('${records.length} kayit bulundu.', style: const TextStyle(color: Colors.white70)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          ...records.map(
            (item) => Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(context).cardColor,
                borderRadius: BorderRadius.circular(22),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(_iconForType(item.type), color: color),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.examTitle, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 4),
                        Text('${item.type} • ${item.date}', style: Theme.of(context).textTheme.bodySmall),
                        const SizedBox(height: 6),
                        Text(
                          item.type == 'Sozlu' ? 'Sozlu notu' : 'Net: ${item.net}',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text('${item.score}', style: TextStyle(color: color, fontWeight: FontWeight.w900)),
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

  IconData _iconForType(String type) {
    switch (type) {
      case 'Deneme':
        return Icons.fact_check_outlined;
      case 'Sozlu':
        return Icons.record_voice_over_outlined;
      case 'Quiz':
        return Icons.quiz_outlined;
      default:
        return Icons.assignment_outlined;
    }
  }
}
