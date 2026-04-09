import 'package:flutter/material.dart';
import '../widgets/responsive_layout.dart';

class StudentWrongQuestionDetailPage extends StatelessWidget {
  final String lesson;
  final String topic;
  final List<Map<String, String>> questions;
  final Color color;

  const StudentWrongQuestionDetailPage({
    super.key,
    required this.lesson,
    required this.topic,
    required this.questions,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Yanlış Sorular', style: TextStyle(fontWeight: FontWeight.bold)),
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
              borderRadius: BorderRadius.circular(26),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(lesson, style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Text(
                  topic,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 22, height: 1.15),
                ),
                const SizedBox(height: 8),
                Text(
                  '${questions.length} yanlis soru tekrar icin listelendi.',
                  style: const TextStyle(color: Colors.white70),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          ...questions.asMap().entries.map(
                (entry) => Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Theme.of(context).cardColor,
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 12,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              'Soru ${entry.key + 1}',
                              style: TextStyle(color: color, fontWeight: FontWeight.w800),
                            ),
                          ),
                          const Spacer(),
                          Text(
                            'Dogru: ${entry.value['correct']}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        entry.value['question'] ?? '',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800, height: 1.35),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Senin cevabin: ${entry.value['yourAnswer']}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: const Color(0xFFB42318), fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Kisa not: ${entry.value['note']}',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.4),
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
}
