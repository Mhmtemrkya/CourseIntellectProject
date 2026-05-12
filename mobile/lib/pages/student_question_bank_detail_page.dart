import 'dart:io';

import 'package:flutter/material.dart';

import '../services/api_config.dart';
import '../services/question_bank_store.dart';
import '../widgets/responsive_layout.dart';
import 'student_question_bank_solve_page.dart';

class StudentQuestionBankDetailPage extends StatelessWidget {
  final String subject;
  final String topic;
  final List<QuestionBankRecord> questions;

  const StudentQuestionBankDetailPage({
    super.key,
    required this.subject,
    required this.topic,
    required this.questions,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final firstQuestion = questions.first;
    final imageCount = questions
        .where((item) => item.imagePath != null && item.imagePath!.isNotEmpty)
        .length;
    final solutionCount = questions
        .where((item) => item.solutionAssetPath != null)
        .length;
    final visibleClasses = {
      for (final item in questions) ...item.classTargets,
    }.toList()..sort();

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(title: const Text('Konu Detayı')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: ResponsiveContent(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1E293B), Color(0xFFFF7A45)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _tag(subject),
                        _tag('${questions.length} soru'),
                        _tag(firstQuestion.difficulty),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text(
                      topic,
                      style: theme.textTheme.headlineSmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      '${firstQuestion.teacher} tarafından hazırlanan konu seti',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.9),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        _heroMetric(
                          Icons.quiz_outlined,
                          '${questions.length} Soru',
                        ),
                        _heroMetric(Icons.image_outlined, '$imageCount Görsel'),
                        _heroMetric(
                          Icons.lightbulb_outline_rounded,
                          '$solutionCount Çözüm',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              _panel(
                theme,
                isDark,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Konu Özeti',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Bu bölümde $topic konusu için hazırlanan ${questions.length} soruyu art arda çözebilirsin. Her sorudan sonra değil, set sonunda genel sonucunu ve kazandığın XP\'yi göreceksin.',
                      style: theme.textTheme.bodyLarge?.copyWith(height: 1.55),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Hedef sınıflar',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: visibleClasses.map(_outlineTag).toList(),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => StudentQuestionBankSolvePage(
                          subject: subject,
                          topic: topic,
                          questions: questions,
                        ),
                      ),
                    );
                  },
                  icon: const Icon(Icons.play_arrow_rounded),
                  label: Text('${questions.length} Soruluk Seti Başlat'),
                ),
              ),
              const SizedBox(height: 16),
              _panel(
                theme,
                isDark,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Sorular',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ...questions.asMap().entries.map((entry) {
                      final item = entry.value;
                      final hasImage =
                          item.imagePath != null && item.imagePath!.isNotEmpty;
                      return Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: theme.scaffoldBackgroundColor,
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                CircleAvatar(
                                  radius: 15,
                                  backgroundColor: theme.colorScheme.primary
                                      .withValues(alpha: 0.12),
                                  foregroundColor: theme.colorScheme.primary,
                                  child: Text('${entry.key + 1}'),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    item.type,
                                    style: theme.textTheme.titleSmall?.copyWith(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                                if (hasImage)
                                  const Icon(Icons.image_outlined, size: 18),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              item.questionText,
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                height: 1.5,
                              ),
                            ),
                            if (hasImage) ...[
                              const SizedBox(height: 12),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(14),
                                child: _questionImage(
                                  item.imagePath!,
                                  height: 120,
                                  theme: theme,
                                ),
                              ),
                            ],
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tag(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _outlineTag(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFFF7A45)),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Color(0xFFFF7A45),
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _questionImage(
    String path, {
    required double height,
    required ThemeData theme,
  }) {
    final resolvedPath = ApiConfig.resolveAssetUrl(path);
    if (resolvedPath.startsWith('http://') ||
        resolvedPath.startsWith('https://')) {
      return Image.network(
        resolvedPath,
        height: height,
        width: double.infinity,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) =>
            _imageFallback(theme, path),
      );
    }
    return Image.file(
      File(path),
      height: height,
      width: double.infinity,
      fit: BoxFit.cover,
      errorBuilder: (context, error, stackTrace) => _imageFallback(theme, path),
    );
  }

  Widget _heroMetric(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 18),
          const SizedBox(width: 8),
          Text(
            text,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _panel(ThemeData theme, bool isDark, {required Widget child}) {
    return Container(
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
      child: child,
    );
  }

  Widget _imageFallback(ThemeData theme, String path) {
    return Container(
      height: 120,
      color: theme.scaffoldBackgroundColor,
      alignment: Alignment.center,
      child: Text(path.split('/').last, textAlign: TextAlign.center),
    );
  }
}
