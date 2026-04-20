import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../services/staff_registry_store.dart';
import '../services/question_thread_api_service.dart';
import 'student_question_answer_page.dart';
import 'student_question_detail_page.dart';
import '../widgets/responsive_layout.dart';

class StudentQuestionPage extends StatefulWidget {
  const StudentQuestionPage({super.key});

  @override
  State<StudentQuestionPage> createState() => _StudentQuestionPageState();
}

class _StudentQuestionPageState extends State<StudentQuestionPage> {
  final TextEditingController _questionController = TextEditingController();
  final TextEditingController _topicController = TextEditingController();

  int selectedTab = 0;
  bool _loading = true;
  bool _submitting = false;
  String? _loadError;
  String selectedSubject = "Matematik";
  String selectedTeacher = "";
  String selectedPriority = "Normal";

  final List<String> subjects = ["Matematik", "Fizik", "Kimya", "Turkce"];

  final Map<String, List<String>> teachersBySubject = {};

  final List<String> priorities = ["Normal", "Acil", "Ödev İçin"];

  final List<QuestionThreadAttachmentRecord> attachments = [];
  bool _uploadingAttachment = false;

  List<Map<String, dynamic>> myQuestions = [];
  List<Map<String, dynamic>> questionNotifications = [];

  List<String> get currentTeachers =>
      teachersBySubject[selectedSubject] ?? const [];

  @override
  void initState() {
    super.initState();
    _loadTeachers();
    _loadQuestions();
  }

  Future<void> _loadTeachers() async {
    await StaffRegistryStore.instance.ensureLoaded();
    final teachers = StaffRegistryStore.instance.teachers;
    for (final subject in subjects) {
      final matches = teachers
          .where(
            (teacher) => teacher.branchOrDepartment.toLowerCase().contains(
              subject.toLowerCase(),
            ),
          )
          .map((teacher) => teacher.fullName)
          .toList();
      teachersBySubject[subject] = matches.isNotEmpty
          ? matches
          : teachers.take(2).map((teacher) => teacher.fullName).toList();
    }
    if (!mounted) return;
    setState(() {
      selectedTeacher = currentTeachers.isNotEmpty ? currentTeachers.first : '';
    });
  }

  Future<void> _loadQuestions() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });

    try {
      final items = await QuestionThreadApiService.instance.fetchThreads();
      if (!mounted) return;
      setState(() {
        myQuestions = items.map(_mapThreadToQuestion).toList();
        questionNotifications = _buildNotifications(myQuestions);
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loadError = error.toString();
        _loading = false;
      });
    }
  }

  @override
  void dispose() {
    _questionController.dispose();
    _topicController.dispose();
    super.dispose();
  }

  Future<void> _submitQuestion() async {
    final question = _questionController.text.trim();
    final topic = _topicController.text.trim();

    if (question.isEmpty || topic.isEmpty) {
      _showInfo("Konu ve soru açıklamasi zorunlu.");
      return;
    }
    if (selectedTeacher.trim().isEmpty) {
      _showInfo("Bu ders için atanmış öğretmen bulunamadı.");
      return;
    }

    setState(() {
      _submitting = true;
    });

    try {
      await QuestionThreadApiService.instance.createThread(
        title: topic,
        subject: selectedSubject,
        teacherName: selectedTeacher,
        questionText: question,
        attachments: List<QuestionThreadAttachmentRecord>.from(attachments),
      );

      _questionController.clear();
      _topicController.clear();
      attachments.clear();

      await _loadQuestions();
      if (!mounted) return;
      setState(() {
        selectedTab = 1;
      });
      _showInfo("Sorun öğretmene gönderildi.");
    } catch (error) {
      _showInfo(error.toString());
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
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
      _showInfo(error.toString());
    } finally {
      if (mounted) {
        setState(() {
          _uploadingAttachment = false;
        });
      }
    }
  }

  void _showInfo(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final answeredCount = myQuestions
        .where((item) => item["status"] == "Yanıtlandi")
        .length;
    final unreadNotifications = questionNotifications
        .where((item) => item["read"] == false)
        .length;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(title: const Text("Soru Sor")),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: ResponsiveContent(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _heroCard(theme, isDark, answeredCount, unreadNotifications),
              const SizedBox(height: 18),
              _tabs(theme),
              const SizedBox(height: 18),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_loadError != null)
                _errorPanel(theme, isDark)
              else if (selectedTab == 0) ...[
                _askForm(theme, isDark),
              ] else if (selectedTab == 1) ...[
                _notificationPanel(theme, isDark),
                const SizedBox(height: 16),
                ...myQuestions.map(
                  (item) => _questionCard(theme, isDark, item),
                ),
              ] else ...[
                _historyPanel(theme, isDark),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Map<String, dynamic> _mapThreadToQuestion(Map<String, dynamic> item) {
    final replies = (item['replies'] as List<dynamic>? ?? const [])
        .map((reply) => Map<String, dynamic>.from(reply as Map))
        .toList();
    final teacherReplies = replies
        .where(
          (reply) =>
              (reply['senderRole'] as String? ?? '').toLowerCase() == 'teacher',
        )
        .toList();
    final latestTeacherReply = teacherReplies.isNotEmpty
        ? teacherReplies.last
        : null;
    final attachmentItems = (item['attachments'] as List<dynamic>? ?? const [])
        .map((attachment) => Map<String, dynamic>.from(attachment as Map))
        .map(QuestionThreadAttachmentRecord.fromMap)
        .toList();
    final latestTeacherReplyAttachments =
        (latestTeacherReply?['attachments'] as List<dynamic>? ?? const [])
            .map((attachment) => Map<String, dynamic>.from(attachment as Map))
            .map(QuestionThreadAttachmentRecord.fromMap)
            .toList();
    final status = teacherReplies.isNotEmpty ? 'Yanıtlandi' : 'Bekliyor';

    return {
      'id': item['id']?.toString() ?? '',
      'subject': item['subject'] as String? ?? 'Genel',
      'teacher': item['teacherName'] as String? ?? 'Atanan Öğretmen',
      'topic': item['title'] as String? ?? 'Soru',
      'question': item['questionText'] as String? ?? '',
      'status': status,
      'time': _formatRelative(
        item['lastActivity'] as String? ?? item['createdAt'] as String?,
      ),
      'answer': latestTeacherReply?['messageText'] as String? ?? '',
      'priority': _inferPriority(
        item['title'] as String? ?? '',
        item['questionText'] as String? ?? '',
      ),
      'answeredTime': latestTeacherReply == null
          ? null
          : _formatDateTime(latestTeacherReply['createdAt'] as String?),
      'attachments': attachmentItems.map((item) => item.toPayload()).toList(),
      'answerAttachments': latestTeacherReplyAttachments
          .map((item) => item.toPayload())
          .toList(),
    };
  }

  List<Map<String, dynamic>> _buildNotifications(
    List<Map<String, dynamic>> items,
  ) {
    final answered = items
        .where((item) => item['status'] == 'Yanıtlandi')
        .take(3);
    return answered
        .map(
          (item) => {
            'title': '${item["topic"]} soruna yanit geldi',
            'subtitle': '${item["teacher"]} çözüm adımlarını paylaştı.',
            'time':
                item['answeredTime'] as String? ??
                item['time'] as String? ??
                'Bugün',
            'read': false,
          },
        )
        .toList();
  }

  String _inferPriority(String title, String questionText) {
    final normalized = '$title $questionText'.toLowerCase();
    if (normalized.contains('acil')) return 'Acil';
    if (normalized.contains('ödev')) return 'Ödev İçin';
    return 'Normal';
  }

  String _formatRelative(String? value) {
    if (value == null || value.isEmpty) return 'Simdi';
    final date = DateTime.tryParse(value)?.toLocal();
    if (date == null) return value;
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 1) return 'Simdi';
    if (diff.inHours < 1) return '${diff.inMinutes} dk önce';
    if (diff.inDays < 1) return '${diff.inHours} saat önce';
    if (diff.inDays == 1) return 'Dun';
    return '${diff.inDays} gün önce';
  }

  String _formatDateTime(String? value) {
    if (value == null || value.isEmpty) return 'Bugün';
    final date = DateTime.tryParse(value)?.toLocal();
    if (date == null) return value;
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final hour = date.hour.toString().padLeft(2, '0');
    final minute = date.minute.toString().padLeft(2, '0');
    return '$day.$month.${date.year} • $hour:$minute';
  }

  Widget _errorPanel(ThemeData theme, bool isDark) {
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Sorular yüklenemedi',
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(_loadError ?? 'Bilinmeyen hata.'),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: _loadQuestions,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Tekrar Dene'),
          ),
        ],
      ),
    );
  }

  Widget _heroCard(
    ThemeData theme,
    bool isDark,
    int answeredCount,
    int unreadNotifications,
  ) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: [Color(0xFF2563EB), Color(0xFF38BDF8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF2563EB).withValues(alpha: 0.24),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "Takıldığın soruyu hemen gönder",
            style: TextStyle(
              color: Colors.white,
              fontSize: 26,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            "Öğretmenine konu, öncelik ve eklerle birlikte soru gönderebilir, önceki yanıtlarını takip edebilirsin.",
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.92),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _statPill("Toplam", "${myQuestions.length}"),
              const SizedBox(width: 10),
              _statPill("Yanit", "$answeredCount"),
              const SizedBox(width: 10),
              _statPill("Bildirim", "$unreadNotifications"),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statPill(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 20,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.88)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tabs(ThemeData theme) {
    final items = ["Yeni Soru", "Sorularim", "Gecmis"];
    return Row(
      children: List.generate(items.length, (index) {
        final selected = selectedTab == index;
        return Expanded(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {
              setState(() {
                selectedTab = index;
              });
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              margin: EdgeInsets.only(right: index == 0 ? 8 : 0),
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: selected ? theme.colorScheme.primary : theme.cardColor,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Center(
                child: Text(
                  items[index],
                  style: TextStyle(
                    color: selected
                        ? Colors.white
                        : theme.textTheme.bodyLarge?.color,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _askForm(ThemeData theme, bool isDark) {
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DropdownButtonFormField<String>(
            initialValue: selectedSubject,
            decoration: const InputDecoration(labelText: "Ders"),
            items: subjects
                .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                .toList(),
            onChanged: (value) {
              if (value == null) return;
              setState(() {
                selectedSubject = value;
                final nextTeachers =
                    teachersBySubject[value] ?? const <String>[];
                selectedTeacher = nextTeachers.isNotEmpty
                    ? nextTeachers.first
                    : '';
              });
            },
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: selectedTeacher.isEmpty ? null : selectedTeacher,
            decoration: const InputDecoration(labelText: "Öğretmen"),
            items: currentTeachers
                .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                .toList(),
            onChanged: currentTeachers.isEmpty
                ? null
                : (value) {
                    if (value == null) return;
                    setState(() {
                      selectedTeacher = value;
                    });
                  },
          ),
          if (currentTeachers.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text('Seçili ders için uygun öğretmen bulunamadı.'),
            ),
          const SizedBox(height: 12),
          TextField(
            controller: _topicController,
            decoration: const InputDecoration(
              labelText: "Konu",
              hintText: "Örnek: Turev, Fonksiyonlar, Parabol",
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: selectedPriority,
            decoration: const InputDecoration(labelText: "Öncelik"),
            items: priorities
                .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                .toList(),
            onChanged: (value) {
              if (value == null) return;
              setState(() {
                selectedPriority = value;
              });
            },
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _questionController,
            maxLines: 6,
            decoration: const InputDecoration(
              labelText: "Soru Açıklaması",
              hintText:
                  "Soruyu detaylı yaz. Takıldığın adımı, denediğin yöntemi ve tam olarak neyi anlamadığını belirt.",
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
                color: theme.colorScheme.primary.withValues(alpha: 0.12),
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
                            "Ekler",
                            style: theme.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            "Resim, PDF veya video ekleyerek sorunu daha net anlat.",
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
                    _attachmentButton(
                      theme,
                      icon: Icons.image_outlined,
                      label: "Görsel",
                      onTap: () {
                        _pickAndUploadAttachment(type: FileType.image);
                      },
                    ),
                    _attachmentButton(
                      theme,
                      icon: Icons.picture_as_pdf_outlined,
                      label: "PDF",
                      onTap: () {
                        _pickAndUploadAttachment(
                          type: FileType.custom,
                          allowedExtensions: const ['pdf'],
                        );
                      },
                    ),
                    _attachmentButton(
                      theme,
                      icon: Icons.video_library_outlined,
                      label: "Video",
                      onTap: () {
                        _pickAndUploadAttachment(type: FileType.video);
                      },
                    ),
                  ],
                ),
                if (_uploadingAttachment)
                  const Padding(
                    padding: EdgeInsets.only(top: 14),
                    child: LinearProgressIndicator(),
                  ),
              ],
            ),
          ),
          if (attachments.isNotEmpty) ...[
            const SizedBox(height: 12),
            ...attachments.map(
              (item) => Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: theme.scaffoldBackgroundColor,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: theme.colorScheme.primary.withValues(alpha: 0.10),
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
                            _attachmentLabel(item.fileType),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              _attachmentTag(item.fileType),
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: _attachmentTint(item.fileType),
                                fontWeight: FontWeight.w800,
                              ),
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
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: theme.scaffoldBackgroundColor,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              "Öncelik: $selectedPriority • Öğretmen: $selectedTeacher",
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              onPressed: _submitting ? null : _submitQuestion,
              icon: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send_rounded),
              label: Text(_submitting ? "Gönderiliyor..." : "Soruyu Gönder"),
            ),
          ),
        ],
      ),
    );
  }

  Widget _attachmentButton(
    ThemeData theme, {
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
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
            Icon(icon, size: 18, color: theme.colorScheme.primary),
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
        return 'Görsel eklendi';
      case 'pdf':
        return 'PDF eklendi';
      case 'video':
        return 'Video eklendi';
      default:
        return 'Ek dosya';
    }
  }

  String _attachmentTag(String type) {
    switch (type.toLowerCase()) {
      case 'image':
        return 'IMG';
      case 'pdf':
        return 'PDF';
      case 'video':
        return 'VID';
      default:
        return 'DOS';
    }
  }

  Widget _questionCard(
    ThemeData theme,
    bool isDark,
    Map<String, dynamic> item,
  ) {
    final answered = item["status"] == "Yanıtlandi";

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.18)
                : Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item["topic"] as String,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: (answered ? Colors.green : Colors.orange).withValues(
                    alpha: 0.12,
                  ),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  item["status"] as String,
                  style: TextStyle(
                    color: answered ? Colors.green : Colors.orange,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            "${item["subject"]} • ${item["teacher"]} • ${item["time"]}",
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.72),
            ),
          ),
          const SizedBox(height: 12),
          Text(item["question"] as String),
          if (answered) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: theme.scaffoldBackgroundColor,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                item["answer"] as String,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              OutlinedButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => StudentQuestionDetailPage(question: item),
                    ),
                  );
                },
                child: const Text("Detay"),
              ),
              const SizedBox(width: 10),
              if (answered)
                ElevatedButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) =>
                            StudentQuestionAnswerPage(question: item),
                      ),
                    );
                  },
                  child: const Text("Yanıtı Gör"),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _notificationPanel(ThemeData theme, bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.18)
                : Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Soru Bildirimleri",
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          if (questionNotifications.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: theme.scaffoldBackgroundColor,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Text(
                'Henüz yeni soru bildirimi yok.',
                style: theme.textTheme.bodyMedium,
              ),
            )
          else
            ...questionNotifications.map((item) {
              final unread = item["read"] == false;
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: unread
                      ? theme.colorScheme.primary.withValues(alpha: 0.08)
                      : theme.scaffoldBackgroundColor,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Icon(
                      unread
                          ? Icons.notifications_active_rounded
                          : Icons.check_circle_outline_rounded,
                      color: unread ? theme.colorScheme.primary : Colors.green,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item["title"] as String,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 4),
                          Text(item["subtitle"] as String),
                        ],
                      ),
                    ),
                    Text(
                      item["time"] as String,
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _historyPanel(ThemeData theme, bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "Soru Gecmisi",
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 12),
        if (myQuestions.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: theme.cardColor,
              borderRadius: BorderRadius.circular(22),
            ),
            child: Text(
              'Henüz gönderdiğin soru bulunmuyor.',
              style: theme.textTheme.bodyMedium,
            ),
          )
        else
          ...myQuestions.map((item) {
            final answered = item["status"] == "Yanıtlandi";
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: theme.cardColor,
                borderRadius: BorderRadius.circular(22),
                boxShadow: [
                  BoxShadow(
                    color: isDark
                        ? Colors.black.withValues(alpha: 0.18)
                        : Colors.black.withValues(alpha: 0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: (answered ? Colors.green : Colors.orange)
                        .withValues(alpha: 0.14),
                    foregroundColor: answered ? Colors.green : Colors.orange,
                    child: Icon(
                      answered ? Icons.done_rounded : Icons.schedule_rounded,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item["topic"] as String,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          "${item["teacher"]} • ${item["time"]}",
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                  Text(
                    item["status"] as String,
                    style: TextStyle(
                      color: answered ? Colors.green : Colors.orange,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }
}
