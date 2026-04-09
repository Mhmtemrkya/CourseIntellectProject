import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/homework_api_service.dart';
import 'package:student/services/school_feed_api_service.dart';
import 'package:student/services/student_xp_service.dart';

class StudentHomeworkUploadPage extends StatefulWidget {
  final Map<String, dynamic> homework;

  const StudentHomeworkUploadPage({
    super.key,
    required this.homework,
  });

  @override
  State<StudentHomeworkUploadPage> createState() =>
      _StudentHomeworkUploadPageState();
}

class _StudentHomeworkUploadPageState extends State<StudentHomeworkUploadPage> {
  final TextEditingController noteController = TextEditingController();
  final List<String> files = [];
  String _studentName = '';

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    final session = await AuthSessionStore.instance.load();
    final resolvedStudentName = await SchoolFeedApiService.resolveLinkedStudentName(session);
    if (!mounted) return;
    setState(() => _studentName = resolvedStudentName);
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: true,
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
    );

    if (result != null && result.files.isNotEmpty) {
      setState(() {
        files.addAll(
          result.files
              .where((file) => file.name.isNotEmpty)
              .map((file) => file.name),
        );
      });
    }
  }

  Future<void> _submitHomework() async {
    if (files.isEmpty && noteController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Lütfen dosya ekleyin veya açıklama yazın."),
        ),
      );
      return;
    }

    final reward = StudentXpService.buildHomeworkReward(
      fileCount: files.length,
      hasNote: noteController.text.trim().isNotEmpty,
    );

    await HomeworkApiService.instance.submitAssignment(
      assignmentId: widget.homework["id"] as String,
      studentName: _studentName,
      note: noteController.text.trim(),
      files: files,
    );

    if (!mounted) return;

    showDialog(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text("Başarılı"),
          content: Text(
            "Odeviniz teslim edildi. +${reward.amount} XP kazandiniz."
            "${reward.bonuses.isEmpty ? "" : "\nBonus: ${reward.bonuses.join(" • ")}"}",
          ),
          actions: [
            TextButton(
              onPressed: () async {
                final dialogNavigator = Navigator.of(dialogContext);
                final pageNavigator = Navigator.of(context);
                await StudentXpService.addXp(reward.amount);
                if (!mounted) return;
                dialogNavigator.pop();
                pageNavigator.pop(reward.amount);
              },
              child: const Text("Tamam"),
            ),
          ],
        );
      },
    );
  }

  @override
  void dispose() {
    noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text("Odev Yukle"),
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
                    widget.homework["title"] as String,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text("Teslim: ${widget.homework["deadline"]}"),
                  const SizedBox(height: 14),
                  TextField(
                    controller: noteController,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: "Not",
                      hintText: "Ögretmeniniz için kısa bir not yazabilirsiniz",
                    ),
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
                  Row(
                    children: [
                      Text(
                        "Yüklenen Dosyalar",
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const Spacer(),
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: _pickFile,
                        child: Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: theme.colorScheme.primary.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Icon(
                            Icons.add,
                            color: theme.colorScheme.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  if (files.isEmpty)
                    Text(
                      "Henüz dosya eklenmedi. PDF, resim ve belge yükleyebilirsiniz.",
                      style: theme.textTheme.bodyMedium,
                    ),
                  ...files.map(
                    (item) => Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: theme.scaffoldBackgroundColor,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            _fileIcon(item),
                            color: theme.colorScheme.primary,
                          ),
                          const SizedBox(width: 10),
                          Expanded(child: Text(item)),
                          IconButton(
                            onPressed: () {
                              setState(() {
                                files.remove(item);
                              });
                            },
                            icon: const Icon(Icons.delete_outline_rounded),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              height: 54,
              child: ElevatedButton.icon(
                onPressed: _submitHomework,
                icon: const Icon(Icons.upload_file_rounded),
                label: const Text("Ödevi Teslim Et"),
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _fileIcon(String fileName) {
    final lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) {
      return Icons.picture_as_pdf_rounded;
    }
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png')) {
      return Icons.image_outlined;
    }
    return Icons.insert_drive_file_rounded;
  }
}
