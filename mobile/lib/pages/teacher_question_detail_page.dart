import 'package:flutter/material.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/widgets/teacher_header.dart';

class TeacherQuestionDetailPage extends StatefulWidget {
  final Map<String, dynamic> thread;

  const TeacherQuestionDetailPage({
    super.key,
    required this.thread,
  });

  @override
  State<TeacherQuestionDetailPage> createState() =>
      _TeacherQuestionDetailPageState();
}

class _TeacherQuestionDetailPageState extends State<TeacherQuestionDetailPage> {
  String _teacherName = '';

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    final session = await AuthSessionStore.instance.load();
    if (!mounted || session == null) return;
    setState(() => _teacherName = session.fullName);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final attachments = (widget.thread['attachments'] as List<dynamic>? ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .map((item) => item['fileName']?.toString() ?? 'ek')
        .toList();
    final replies = (widget.thread['replies'] as List<dynamic>? ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    final teacherReplies = replies.where((item) {
      return (item['senderRole'] as String? ?? '').toLowerCase() == 'teacher';
    }).toList();
    final latestReply = teacherReplies.isNotEmpty ? teacherReplies.last : null;
    final answered = latestReply != null;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: TeacherHeader(
        title: "Soru Detayi",
        teacherName: _teacherName.isEmpty ? 'Öğretmen' : _teacherName,
        subtitle: '${widget.thread['subject'] as String? ?? 'Genel'} Öğretmeni',
        showBackButton: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: Column(
          children: [
            _card(
              theme,
              isDark,
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor:
                            theme.colorScheme.primary.withValues(alpha: 0.14),
                        child: Text(
                          (widget.thread['studentName'] as String? ?? 'Öğrenci')
                              .split(' ')
                              .where((e) => e.isNotEmpty)
                              .take(2)
                              .map((e) => e[0])
                              .join(),
                          style: TextStyle(
                            color: theme.colorScheme.primary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.thread['studentName'] as String? ?? 'Öğrenci',
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(widget.thread['className'] as String? ?? 'Sınıf'),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: (answered
                                  ? const Color(0xFF69C36D)
                                  : const Color(0xFFFFB020))
                              .withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Text(
                          answered ? "Yanitlandi" : "Bekliyor",
                          style: TextStyle(
                            color: answered
                                ? const Color(0xFF69C36D)
                                : const Color(0xFFFFB020),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Text(
                    "Ders / Konu",
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.7),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    widget.thread['subject'] as String? ?? 'Genel',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    "Soru",
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.7),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: theme.scaffoldBackgroundColor,
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Text(
                      widget.thread['questionText'] as String? ?? '',
                      style: theme.textTheme.bodyMedium?.copyWith(height: 1.45),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _card(
              theme,
              isDark,
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Ekler",
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (attachments.isEmpty)
                    _attachmentItem(theme, "Ek dosya bulunmuyor.")
                  else
                    ...attachments.map((item) => _attachmentItem(theme, item)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _card(
              theme,
              isDark,
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    answered ? "Son Yanıt" : "Öğretmen Notu",
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    latestReply?['messageText'] as String? ??
                        "Bu soru henuz yanitlanmadi. Yanit ekranindan ogrenciye donus yapabilirsin.",
                    style: theme.textTheme.bodyMedium?.copyWith(height: 1.4),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _card(ThemeData theme, bool isDark, Widget child) {
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

  Widget _attachmentItem(ThemeData theme, String text) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Text(text),
    );
  }
}
