import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/question_thread_api_service.dart';
import 'package:student/widgets/teacher_header.dart';

class TeacherQuestionReplyPage extends StatefulWidget {
  final Map<String, dynamic> thread;

  const TeacherQuestionReplyPage({super.key, required this.thread});

  @override
  State<TeacherQuestionReplyPage> createState() =>
      _TeacherQuestionReplyPageState();
}

class _TeacherQuestionReplyPageState extends State<TeacherQuestionReplyPage> {
  final TextEditingController replyController = TextEditingController();
  String _teacherName = '';
  final List<QuestionThreadAttachmentRecord> attachments = [];
  bool _submitting = false;
  bool _uploadingAttachment = false;

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
  void dispose() {
    replyController.dispose();
    super.dispose();
  }

  Future<void> _pickAndUploadAttachment({
    required FileType type,
    List<String>? allowedExtensions,
  }) async {
    final result = await FilePicker.platform.pickFiles(
      type: type,
      allowedExtensions: allowedExtensions,
      withData: true,
    );
    final file = result?.files.single;
    if (file == null) return;

    setState(() {
      _uploadingAttachment = true;
    });

    try {
      final attachment = await QuestionThreadApiService.instance
          .uploadAttachment(file: file);
      if (!mounted) return;
      setState(() {
        attachments.add(attachment);
      });
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() {
          _uploadingAttachment = false;
        });
      }
    }
  }

  Future<void> sendReply() async {
    if (replyController.text.trim().isEmpty && attachments.isEmpty) return;

    setState(() {
      _submitting = true;
    });

    try {
      final effectiveMessage =
          replyController.text.trim().isEmpty && attachments.isNotEmpty
          ? 'Ek paylaşıldı.'
          : replyController.text.trim();
      await QuestionThreadApiService.instance.replyToThread(
        threadId: widget.thread['id']?.toString() ?? '',
        messageText: effectiveMessage,
        attachments: List<QuestionThreadAttachmentRecord>.from(attachments),
      );
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) {
          return AlertDialog(
            title: const Text("Başarılı"),
            content: const Text("Yanıtınız öğrenciye gönderildi."),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                },
                child: const Text("Tamam"),
              ),
            ],
          );
        },
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: TeacherHeader(
        title: "Yanitla",
        teacherName: _teacherName.isEmpty ? 'Öğretmen' : _teacherName,
        subtitle: '${widget.thread['subject'] as String? ?? 'Genel'} Öğretmeni',
        showBackButton: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: Column(
          children: [
            Container(
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.thread['studentName'] as String? ?? 'Öğrenci',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    widget.thread['className'] as String? ?? 'Sınıf',
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: theme.colorScheme.primary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(widget.thread['questionText'] as String? ?? ''),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: theme.cardColor,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Yanıtınız",
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: replyController,
                    maxLines: 6,
                    decoration: const InputDecoration(
                      hintText: "Öğrenciye açıklayıcı bir yanıt yazın...",
                    ),
                  ),
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: theme.scaffoldBackgroundColor,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: theme.colorScheme.primary.withValues(
                          alpha: 0.12,
                        ),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                color: theme.colorScheme.primary.withValues(
                                  alpha: 0.10,
                                ),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Icon(
                                Icons.attach_file_rounded,
                                color: theme.colorScheme.primary,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    "Çözüm Ekleri",
                                    style: theme.textTheme.titleSmall?.copyWith(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    "Görsel, PDF veya video ekleyerek anlatımı güçlendirebilirsin.",
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: theme.textTheme.bodySmall?.color
                                          ?.withValues(alpha: 0.72),
                                      height: 1.35,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            _mediaButton(
                              context,
                              icon: Icons.image_outlined,
                              label: "Fotoğraf",
                              onTap: () => _pickAndUploadAttachment(
                                type: FileType.image,
                              ),
                            ),
                            _mediaButton(
                              context,
                              icon: Icons.picture_as_pdf_outlined,
                              label: "PDF",
                              onTap: () => _pickAndUploadAttachment(
                                type: FileType.custom,
                                allowedExtensions: const ['pdf'],
                              ),
                            ),
                            _mediaButton(
                              context,
                              icon: Icons.video_library_outlined,
                              label: "Video",
                              onTap: () => _pickAndUploadAttachment(
                                type: FileType.video,
                              ),
                            ),
                          ],
                        ),
                        if (_uploadingAttachment) ...[
                          const SizedBox(height: 14),
                          const LinearProgressIndicator(),
                        ],
                      ],
                    ),
                  ),
                  if (attachments.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    ...attachments.map(
                      (item) => Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: theme.scaffoldBackgroundColor,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: theme.colorScheme.primary.withValues(
                              alpha: 0.10,
                            ),
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: _attachmentTint(
                                  item.fileType,
                                ).withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(
                                _attachmentIcon(item.fileType),
                                color: _attachmentTint(item.fileType),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.fileName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    _attachmentLabel(item.fileType),
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: theme.textTheme.bodySmall?.color
                                          ?.withValues(alpha: 0.72),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              onPressed: () {
                                setState(() {
                                  attachments.remove(item);
                                });
                              },
                              icon: const Icon(Icons.close_rounded),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton.icon(
                      onPressed: _submitting ? null : sendReply,
                      icon: _submitting
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.send_rounded),
                      label: Text(
                        _submitting ? "Gönderiliyor..." : "Yaniti Gönder",
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _mediaButton(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    final theme = Theme.of(context);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Ink(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: theme.colorScheme.primary.withValues(alpha: 0.14),
          ),
          color: theme.cardColor,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: theme.colorScheme.primary, size: 18),
            const SizedBox(width: 8),
            Text(
              label,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _attachmentIcon(String type) {
    switch (type.toLowerCase()) {
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

  Color _attachmentTint(String type) {
    switch (type.toLowerCase()) {
      case 'image':
        return const Color(0xFF0EA5E9);
      case 'pdf':
        return const Color(0xFFEF4444);
      case 'video':
        return const Color(0xFF8B5CF6);
      default:
        return const Color(0xFF2563EB);
    }
  }

  String _attachmentLabel(String type) {
    switch (type.toLowerCase()) {
      case 'image':
        return 'Görsel çözüm';
      case 'pdf':
        return 'PDF çözüm';
      case 'video':
        return 'Video çözüm';
      default:
        return 'Ek dosya';
    }
  }
}
