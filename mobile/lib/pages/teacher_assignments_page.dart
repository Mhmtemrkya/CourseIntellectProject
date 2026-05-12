import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:student/pages/teacher_assignment_detail_page.dart';
import 'package:student/pages/teacher_assignment_submissions_page.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/homework_api_service.dart';
import 'package:student/services/student_registry_store.dart';
import 'package:student/widgets/teacher_header.dart';

class TeacherAssignmentsPage extends StatefulWidget {
  const TeacherAssignmentsPage({super.key});

  @override
  State<TeacherAssignmentsPage> createState() => _TeacherAssignmentsPageState();
}

class _TeacherAssignmentsPageState extends State<TeacherAssignmentsPage> {
  static const List<String> _defaultSubjects = [
    'Matematik',
    'Türkçe',
    'Fizik',
    'Kimya',
    'Biyoloji',
    'İngilizce',
    'Tarih',
    'Coğrafya',
  ];
  int selectedTab = 0;
  List<String> _availableClasses = const [];
  List<String> _availableSubjects = const [];
  List<Map<String, dynamic>> _assignments = const [];
  bool _loading = true;
  String? _error;
  String _teacherName = '';

  final List<String> tabs = ["Aktif Ödevler", "Teslim Edilenler"];

  @override
  void initState() {
    super.initState();
    _loadAssignments();
  }

  Future<void> _loadAssignments() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await HomeworkApiService.instance.fetchAssignments();
      final session = await AuthSessionStore.instance.load();
      await StudentRegistryStore.instance.ensureLoaded();
      final teacherName = session?.fullName;
      final classes =
          StudentRegistryStore.instance.students
              .map((item) => item.className)
              .toSet()
              .toList()
            ..sort();
      final subjects = {
        ..._defaultSubjects,
        ...items
            .map((item) => (item['subject'] ?? '').toString())
            .where((item) => item.trim().isNotEmpty),
      }.toList()..sort();
      if (!mounted) return;
      setState(() {
        _teacherName = teacherName ?? _teacherName;
        _availableClasses = classes;
        _availableSubjects = subjects;
        _assignments = teacherName == null
            ? items
            : items.where((item) => item['teacher'] == teacherName).toList();
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _showCreateHomeworkDialog() async {
    final messenger = ScaffoldMessenger.of(context);
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _CreateHomeworkDialog(
        availableClasses: _availableClasses,
        availableSubjects: _availableSubjects.isEmpty
            ? _defaultSubjects
            : _availableSubjects,
      ),
    );

    if (!mounted || result == null) return;
    final session = await AuthSessionStore.instance.load();
    if (session == null) return;

    final uploadedMaterials = <String>[];
    final attachments = List<PlatformFile>.from(
      result['attachmentFiles'] as List<dynamic>? ?? const [],
    );
    for (final file in attachments) {
      final uploaded = await HomeworkApiService.instance.uploadHomeworkAsset(
        file: file,
      );
      uploadedMaterials.add(uploaded);
    }

    await HomeworkApiService.instance.createAssignment(
      title: result['title'] as String,
      className: result['className'] as String,
      subject: result['subject'] as String,
      teacher: session.fullName,
      deadline: result['deadline'] as String,
      description: result['description'] as String,
      materials: [
        ...List<String>.from(result['materials'] as List<dynamic>),
        ...uploadedMaterials,
      ],
    );

    setState(() {
      selectedTab = 0;
    });
    await _loadAssignments();

    messenger.showSnackBar(const SnackBar(content: Text("Ödev oluşturuldu")));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final allAssignments = _assignments;
    final activeAssignments = allAssignments
        .where((item) => item["status"] != "Tamamlandi")
        .toList();
    final completedAssignments = allAssignments
        .where((item) => item["status"] == "Tamamlandi")
        .toList();
    final currentList = selectedTab == 0
        ? activeAssignments
        : completedAssignments;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: TeacherHeader(
        title: "Ödevlerim",
        teacherName: _teacherName.isEmpty ? 'Öğretmen' : _teacherName,
        subtitle: "Ödev Takip Merkezi",
        showBackButton: true,
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showCreateHomeworkDialog,
        backgroundColor: theme.colorScheme.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
            ? Center(
                child: Column(
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: _loadAssignments,
                      child: const Text('Tekrar Dene'),
                    ),
                  ],
                ),
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _heroCard(
                    theme,
                    isDark,
                    activeAssignments,
                    completedAssignments,
                  ),
                  const SizedBox(height: 18),
                  _tabBar(theme),
                  const SizedBox(height: 18),
                  ...currentList.map(
                    (item) => _assignmentCard(theme, isDark, item),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _heroCard(
    ThemeData theme,
    bool isDark,
    List<Map<String, dynamic>> activeAssignments,
    List<Map<String, dynamic>> completedAssignments,
  ) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          colors: [Color(0xFFFF7A00), Color(0xFFFFA24A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.24)
                : const Color(0xFFFF7A00).withValues(alpha: 0.22),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.assignment_rounded, color: Colors.white, size: 28),
              SizedBox(width: 10),
              Text(
                "Ödev Yönetimi",
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            "Sınıflara verdiğin ödevleri takip et, teslim durumlarını gör ve yeni ödevler oluştur.",
            style: theme.textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.92),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _heroStat("${activeAssignments.length}", "Aktif"),
              const SizedBox(width: 12),
              _heroStat("${completedAssignments.length}", "Tamamlanan"),
              const SizedBox(width: 12),
              _heroStat(
                "${activeAssignments.fold<int>(0, (sum, item) => sum + (item["submitted"] as int))}",
                "Teslim",
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _heroStat(String value, String label) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
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
                fontSize: 22,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.9),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tabBar(ThemeData theme) {
    return Row(
      children: List.generate(tabs.length, (index) {
        final selected = selectedTab == index;

        return Expanded(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {
              setState(() {
                selectedTab = index;
              });
            },
            child: Container(
              margin: EdgeInsets.only(right: index == 0 ? 10 : 0),
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: selected ? theme.colorScheme.primary : theme.cardColor,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Text(
                tabs[index],
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: selected
                      ? Colors.white
                      : theme.textTheme.bodyMedium?.color,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _assignmentCard(
    ThemeData theme,
    bool isDark,
    Map<String, dynamic> item,
  ) {
    final submitted = item["submitted"] as int;
    final total = item["total"] as int;
    final progress = total == 0 ? 0.0 : submitted / total;

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
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
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: (item["accentColor"] as Color).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  Icons.assignment_turned_in_rounded,
                  color: item["accentColor"] as Color,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item["title"] as String,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "${item["subject"]} • ${item["className"]}",
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.textTheme.bodySmall?.color?.withValues(
                          alpha: 0.72,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: (item["statusColor"] as Color).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  item["status"] as String,
                  style: TextStyle(
                    color: item["statusColor"] as Color,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _metaChip(
                  theme,
                  icon: Icons.schedule_rounded,
                  text: item["deadline"] as String,
                  color: item["accentColor"] as Color,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _metaChip(
                  theme,
                  icon: Icons.groups_rounded,
                  text: "$submitted/$total Teslim",
                  color: item["accentColor"] as Color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 10,
              color: item["accentColor"] as Color,
              backgroundColor: theme.scaffoldBackgroundColor,
            ),
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: Text(
              "%${(progress * 100).toInt()} tamamlandı",
              style: theme.textTheme.bodySmall,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) =>
                            TeacherAssignmentDetailPage(assignment: item),
                      ),
                    );
                  },
                  icon: const Icon(Icons.visibility_outlined),
                  label: const Text("Detay"),
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) =>
                            TeacherAssignmentSubmissionsPage(assignment: item),
                      ),
                    );
                  },
                  icon: const Icon(Icons.checklist_rounded),
                  label: const Text("Teslimler"),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: item["accentColor"] as Color,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
              if ((item["status"] as String?) != "Tamamlandi") ...[
                const SizedBox(width: 10),
                IconButton(
                  tooltip: 'Sil',
                  onPressed: () => _deleteAssignment(item),
                  icon: const Icon(Icons.delete_outline_rounded),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _metaChip(
    ThemeData theme, {
    required IconData icon,
    required String text,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteAssignment(Map<String, dynamic> item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Ödevi Sil'),
        content: Text('"${item["title"]}" silinsin mi?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Vazgeç'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Sil'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    await HomeworkApiService.instance.deleteAssignment(item["id"] as String);
    await _loadAssignments();
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Ödev silindi')));
  }
}

class _CreateHomeworkDialog extends StatefulWidget {
  const _CreateHomeworkDialog({
    required this.availableClasses,
    required this.availableSubjects,
  });

  final List<String> availableClasses;
  final List<String> availableSubjects;

  @override
  State<_CreateHomeworkDialog> createState() => _CreateHomeworkDialogState();
}

class _CreateHomeworkDialogState extends State<_CreateHomeworkDialog> {
  late final TextEditingController _titleController;
  late final TextEditingController _descriptionController;
  late String _selectedClass;
  late String _selectedSubject;
  DateTime? _selectedDate;
  final List<String> _attachments = [];
  final List<PlatformFile> _attachmentFiles = [];

  String _attachmentSummary(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.pdf')) return 'PDF eklendi';
    if (lower.endsWith('.mp4') ||
        lower.endsWith('.mov') ||
        lower.endsWith('.avi')) {
      return 'Video eklendi';
    }
    if (lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png') ||
        lower.endsWith('.webp')) {
      return 'Görsel eklendi';
    }
    return 'Ek materyal eklendi';
  }

  String _attachmentTag(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.pdf')) return 'PDF';
    if (lower.endsWith('.mp4') ||
        lower.endsWith('.mov') ||
        lower.endsWith('.avi')) {
      return 'VID';
    }
    if (lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.png') ||
        lower.endsWith('.webp')) {
      return 'IMG';
    }
    return 'DOS';
  }

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController();
    _descriptionController = TextEditingController();
    _selectedClass = widget.availableClasses.first;
    _selectedSubject = widget.availableSubjects.first;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _pickAttachment() async {
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: true,
      type: FileType.custom,
      allowedExtensions: const [
        'pdf',
        'doc',
        'docx',
        'jpg',
        'jpeg',
        'png',
        'mp4',
        'mov',
        'avi',
      ],
    );
    if (result == null || !mounted) return;
    setState(() {
      _attachmentFiles.addAll(result.files);
      _attachments.addAll(
        result.files
            .where((file) => file.name.isNotEmpty)
            .map((file) => file.name),
      );
    });
  }

  Future<void> _pickDeadline() async {
    FocusScope.of(context).unfocus();
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked == null || !mounted) return;
    setState(() {
      _selectedDate = picked;
    });
  }

  @override
  Widget build(BuildContext context) {
    final pickedDate = _selectedDate;
    final deadlineLabel = pickedDate == null
        ? 'Teslim tarihi seçin'
        : '${pickedDate.day.toString().padLeft(2, '0')}.${pickedDate.month.toString().padLeft(2, '0')}.${pickedDate.year}';

    return AlertDialog(
      title: const Text('Ödev Oluştur'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _titleController,
              decoration: const InputDecoration(labelText: 'Ödev Başlığı'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _selectedClass,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Sınıf'),
              items: widget.availableClasses
                  .map(
                    (item) => DropdownMenuItem(value: item, child: Text(item)),
                  )
                  .toList(),
              onChanged: (value) {
                if (value == null) return;
                setState(() {
                  _selectedClass = value;
                });
              },
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _selectedSubject,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Ders'),
              items: widget.availableSubjects
                  .map(
                    (item) => DropdownMenuItem(value: item, child: Text(item)),
                  )
                  .toList(),
              onChanged: (value) {
                if (value == null) return;
                setState(() {
                  _selectedSubject = value;
                });
              },
            ),
            const SizedBox(height: 12),
            InkWell(
              onTap: _pickDeadline,
              borderRadius: BorderRadius.circular(12),
              child: InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Teslim Tarihi',
                  suffixIcon: Icon(Icons.calendar_today_outlined),
                ),
                child: Text(deadlineLabel),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _descriptionController,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Ödev Açıklaması',
                hintText: 'Metin, yönergeler ve teslim notlarını yazın',
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                const Text(
                  'Ekler',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: _pickAttachment,
                  icon: const Icon(Icons.attach_file_rounded),
                  label: const Text('Dosya Ekle'),
                ),
              ],
            ),
            if (_attachments.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 4),
                child: Text('PDF, resim ve belge ekleyebilirsiniz.'),
              )
            else
              ..._attachments.map(
                (item) => Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: const Color(0xFFDBEAFE),
                        foregroundColor: const Color(0xFF2563EB),
                        child: Text(_attachmentTag(item)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _attachmentSummary(item),
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(_attachmentTag(item)),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () {
                          setState(() {
                            final index = _attachments.indexOf(item);
                            if (index >= 0 && index < _attachmentFiles.length) {
                              _attachmentFiles.removeAt(index);
                            }
                            _attachments.remove(item);
                          });
                        },
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Iptal'),
        ),
        ElevatedButton(
          onPressed: () {
            if (_titleController.text.trim().isEmpty || _selectedDate == null) {
              return;
            }

            Navigator.pop(context, {
              'title': _titleController.text.trim(),
              'className': _selectedClass,
              'subject': _selectedSubject,
              'deadline': deadlineLabel,
              'description': _descriptionController.text.trim().isEmpty
                  ? 'Ödev detayları öğretmen tarafından paylaşıldı.'
                  : _descriptionController.text.trim(),
              'materials': List<String>.from(_attachments),
              'attachmentFiles': List<PlatformFile>.from(_attachmentFiles),
            });
          },
          child: const Text('Oluştur'),
        ),
      ],
    );
  }
}
