import 'dart:io';

import 'package:flutter/material.dart';

import '../services/api_config.dart';
import '../services/question_bank_store.dart';
import '../widgets/responsive_layout.dart';
import 'teacher_question_create_page.dart';

class TeacherQuestionBankDetailPage extends StatefulWidget {
  final QuestionBankRecord question;

  const TeacherQuestionBankDetailPage({super.key, required this.question});

  @override
  State<TeacherQuestionBankDetailPage> createState() =>
      _TeacherQuestionBankDetailPageState();
}

class _TeacherQuestionBankDetailPageState
    extends State<TeacherQuestionBankDetailPage> {
  final _store = QuestionBankStore.instance;

  QuestionBankRecord get _question {
    return _store.questions.firstWhere(
      (item) => item.id == widget.question.id,
      orElse: () => widget.question,
    );
  }

  @override
  void initState() {
    super.initState();
    _store.addListener(_refresh);
  }

  @override
  void dispose() {
    _store.removeListener(_refresh);
    super.dispose();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  Future<void> _deleteQuestion() async {
    final approved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Soruyu sil'),
          content: const Text(
            'Bu soru öğretmen ve öğrenci soru bankasından kaldırılacak. Emin misiniz?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('İptal'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Sil'),
            ),
          ],
        );
      },
    );

    if (approved != true) return;
    try {
      await _store.deleteQuestion(_question.id);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
      return;
    }
    if (!mounted) return;
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final item = _question;
    final hasImage = item.imagePath != null && item.imagePath!.isNotEmpty;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Soru Detayı'),
        actions: [
          IconButton(
            onPressed: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) =>
                      TeacherQuestionCreatePage(initialQuestion: item),
                ),
              );
            },
            icon: const Icon(Icons.edit_outlined),
            tooltip: 'Düzenle',
          ),
          IconButton(
            onPressed: _deleteQuestion,
            icon: const Icon(Icons.delete_outline_rounded),
            tooltip: 'Sil',
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: ResponsiveContent(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _hero(theme, isDark, item),
              const SizedBox(height: 16),
              _panel(
                theme,
                isDark,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Soru Metni',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: theme.scaffoldBackgroundColor,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Text(
                        item.questionText,
                        style: theme.textTheme.bodyLarge?.copyWith(
                          height: 1.55,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (item.type == 'Çoktan Seçmeli' ||
                  item.type == 'Doğru / Yanlış') ...[
                const SizedBox(height: 16),
                _panel(
                  theme,
                  isDark,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Seçenekler',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 12),
                      ...item.options.asMap().entries.map((entry) {
                        final isCorrect = item.correctOptionIndex == entry.key;
                        final optionImage =
                            item.optionImagePaths.length > entry.key
                            ? item.optionImagePaths[entry.key]
                            : null;
                        return Container(
                          width: double.infinity,
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: isCorrect
                                ? const Color(0xFFD1FAE5)
                                : theme.scaffoldBackgroundColor,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 14,
                                backgroundColor: isCorrect
                                    ? const Color(0xFF10B981)
                                    : theme.colorScheme.primary.withValues(
                                        alpha: 0.12,
                                      ),
                                foregroundColor: isCorrect
                                    ? Colors.white
                                    : theme.colorScheme.primary,
                                child: Text(
                                  String.fromCharCode(65 + entry.key),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(child: Text(entry.value)),
                              if ((optionImage ?? '').isNotEmpty) ...[
                                const SizedBox(width: 10),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: Image.network(
                                    ApiConfig.resolveAssetUrl(optionImage),
                                    width: 54,
                                    height: 54,
                                    fit: BoxFit.cover,
                                    errorBuilder:
                                        (context, error, stackTrace) =>
                                            Container(
                                              width: 54,
                                              height: 54,
                                              color:
                                                  theme.scaffoldBackgroundColor,
                                              child: const Icon(
                                                Icons.broken_image_outlined,
                                              ),
                                            ),
                                  ),
                                ),
                              ],
                              if (isCorrect)
                                const Text(
                                  'Doğru',
                                  style: TextStyle(
                                    color: Color(0xFF047857),
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                            ],
                          ),
                        );
                      }),
                    ],
                  ),
                ),
              ],
              if (hasImage) ...[
                const SizedBox(height: 16),
                _panel(
                  theme,
                  isDark,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Soru Görseli',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 12),
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => _showImagePreview(item.imagePath!),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(18),
                          child: _questionImage(
                            item.imagePath!,
                            height: 220,
                            theme: theme,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              if ((item.solutionTextHtml ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: 16),
                _panel(
                  theme,
                  isDark,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Çözüm Metni',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        item.solutionTextHtml!.trim(),
                        style: theme.textTheme.bodyMedium?.copyWith(
                          height: 1.45,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              if (item.solutionAssetPath != null) ...[
                const SizedBox(height: 16),
                _panel(
                  theme,
                  isDark,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Çözüm Eki',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: theme.scaffoldBackgroundColor,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              item.solutionAssetType == 'Video'
                                  ? Icons.play_circle_outline_rounded
                                  : Icons.insert_drive_file_outlined,
                              color: theme.colorScheme.primary,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                item.solutionAssetPath!.split('/').last,
                              ),
                            ),
                            Text(
                              item.solutionAssetType ?? 'Dosya',
                              style: TextStyle(
                                color: theme.colorScheme.primary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
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

  Widget _hero(ThemeData theme, bool isDark, QuestionBankRecord item) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF2563EB)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.24)
                : const Color(0xFF2563EB).withValues(alpha: 0.20),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _heroTag(item.subject),
              _heroTag(item.difficulty),
              _heroTag(item.type),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            item.topic,
            style: theme.textTheme.headlineSmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            '${item.teacher} • ${item.createdAt} • ${item.usageCount} kullanım',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.88),
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Hedef sınıflar: ${item.classTargets.join(', ')}',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.88),
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _heroTag(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
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
      width: double.infinity,
      height: 180,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.image_not_supported_outlined, size: 34),
          const SizedBox(height: 10),
          Text(path.split('/').last, textAlign: TextAlign.center),
        ],
      ),
    );
  }

  void _showImagePreview(String path) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        return Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.all(24),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: InteractiveViewer(
              child: Image.file(
                File(path),
                fit: BoxFit.contain,
                errorBuilder: (context, error, stackTrace) =>
                    _imageFallback(Theme.of(dialogContext), path),
              ),
            ),
          ),
        );
      },
    );
  }
}
