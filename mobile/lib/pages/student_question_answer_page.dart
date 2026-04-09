import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/api_config.dart';
import '../widgets/responsive_layout.dart';

class StudentQuestionAnswerPage extends StatelessWidget {
  final Map<String, dynamic> question;

  const StudentQuestionAnswerPage({
    super.key,
    required this.question,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final answer = question['answer'] as String? ?? '';
    final attachments = (question['answerAttachments'] as List<dynamic>? ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text(
          'Öğretmen Yanıtı',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
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
                    colors: [Color(0xFF14532D), Color(0xFF10B981)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: isDark
                          ? Colors.black.withValues(alpha: 0.24)
                          : const Color(0xFF10B981).withValues(alpha: 0.24),
                      blurRadius: 18,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        question['teacher'] as String,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Yanıtlanan sorunun çözümünü ve öğretmen notlarını bu ekranda görebilirsin.',
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      '${question['subject']} • ${question['topic']}',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.88),
                        fontWeight: FontWeight.w600,
                      ),
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
                      'Senin Sorun',
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
                        question['question'] as String,
                        style: theme.textTheme.bodyLarge?.copyWith(height: 1.5),
                      ),
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
                    Row(
                      children: [
                        Icon(Icons.auto_awesome_rounded, color: theme.colorScheme.primary),
                        const SizedBox(width: 8),
                        Text(
                          'Öğretmen Yanıtı',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primary.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: theme.colorScheme.primary.withValues(alpha: 0.14),
                        ),
                      ),
                      child: Text(
                        answer,
                        style: theme.textTheme.bodyLarge?.copyWith(
                          height: 1.6,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    _infoLine(theme, 'Yanıtlayan', question['teacher'] as String),
                    _infoLine(theme, 'Yanıt Zamanı', question['answeredTime'] as String? ?? 'Bugün'),
                    _infoLine(theme, 'Durum', question['status'] as String),
                    if (attachments.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      ...attachments.map(
                        (item) => Container(
                          width: double.infinity,
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: theme.scaffoldBackgroundColor,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Row(
                            children: [
                              Icon(_attachmentIcon(item['fileType']?.toString()), color: theme.colorScheme.primary),
                              const SizedBox(width: 10),
                              Expanded(child: Text(item['fileName']?.toString() ?? 'Ek')),
                              TextButton(
                                onPressed: () => _openAttachment(context, item['fileUrl']?.toString()),
                                child: const Text('Aç'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
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

  Widget _infoLine(ThemeData theme, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.72),
              ),
            ),
          ),
          Text(
            value,
            style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  IconData _attachmentIcon(String? type) {
    switch ((type ?? '').toLowerCase()) {
      case 'image':
        return Icons.image_outlined;
      case 'pdf':
        return Icons.picture_as_pdf_outlined;
      case 'video':
        return Icons.video_library_outlined;
      default:
        return Icons.attach_file_rounded;
    }
  }

  Future<void> _openAttachment(BuildContext context, String? value) async {
    if (value == null || value.isEmpty) return;
    final normalized = value.startsWith('http')
        ? value
        : '${ApiConfig.baseUrl}${value.startsWith('/') ? '' : '/'}$value';
    final success = await launchUrl(Uri.parse(normalized), mode: LaunchMode.externalApplication);
    if (!context.mounted || success) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Ek dosya açılamadı.')),
    );
  }
}
