import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/content_api_service.dart';
import 'package:student/services/student_registry_store.dart';
import 'package:student/widgets/teacher_header.dart';

class TeacherCreateLiveLessonPage extends StatefulWidget {
  const TeacherCreateLiveLessonPage({super.key});

  @override
  State<TeacherCreateLiveLessonPage> createState() =>
      _TeacherCreateLiveLessonPageState();
}

class _TeacherCreateLiveLessonPageState
    extends State<TeacherCreateLiveLessonPage> {
  final TextEditingController topicController = TextEditingController();
  final TextEditingController descriptionController = TextEditingController();
  final TextEditingController urlController = TextEditingController();
  final TextEditingController timeController = TextEditingController();
  final TextEditingController dateController = TextEditingController();

  final List<String> materials = [];
  String selectedPlatform = "Zoom";
  String _teacherName = '';
  List<String> _classOptions = const [];
  String _selectedClass = '';
  bool _uploadingMaterial = false;

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    await StudentRegistryStore.instance.ensureLoaded();
    final session = await AuthSessionStore.instance.load();
    final classes =
        StudentRegistryStore.instance.students
            .map((item) => item.className)
            .toSet()
            .toList()
          ..sort();
    if (!mounted) return;
    setState(() {
      _teacherName = session?.fullName ?? _teacherName;
      _classOptions = classes;
      _selectedClass = classes.isEmpty ? '' : classes.first;
    });
  }

  Future<void> _pickMaterial() async {
    final result = await FilePicker.platform.pickFiles();

    if (result != null && result.files.single.name.isNotEmpty) {
      setState(() => _uploadingMaterial = true);
      try {
        final uploaded = await ContentApiService.instance.uploadContentAsset(
          file: result.files.single,
          folder: 'live-lesson-materials',
        );
        if (!mounted) return;
        setState(() {
          materials.add('${uploaded.fileName}::${uploaded.fileUrl}');
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${uploaded.fileName} yüklendi.')),
        );
      } on ContentApiException catch (error) {
        if (!mounted) return;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      } catch (_) {
        if (!mounted) return;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Materyal yüklenemedi.')));
      } finally {
        if (mounted) {
          setState(() => _uploadingMaterial = false);
        }
      }
    }
  }

  String _materialName(String raw) {
    final value = raw.trim();
    if (value.contains('::')) {
      return value.split('::').first.trim();
    }
    return value.split('/').last;
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: now.subtract(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked == null || !mounted) return;
    dateController.text =
        '${picked.day.toString().padLeft(2, '0')}.${picked.month.toString().padLeft(2, '0')}.${picked.year}';
  }

  void _saveLesson() {
    if (topicController.text.trim().isEmpty ||
        urlController.text.trim().isEmpty ||
        timeController.text.trim().isEmpty ||
        dateController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Konu, sınıf, saat ve bağlantı alanları zorunludur."),
        ),
      );
      return;
    }

    Navigator.pop(context, {
      "title": topicController.text.trim(),
      "subtitle": descriptionController.text.trim().isEmpty
          ? "Canlı ders açıklaması"
          : descriptionController.text.trim(),
      "date": dateController.text.trim(),
      "time": timeController.text.trim(),
      "className": _selectedClass,
      "platform": selectedPlatform,
      "status": "Planlandı",
      "meetingUrl": urlController.text.trim(),
      "materials": List<String>.from(materials),
    });
  }

  @override
  void dispose() {
    topicController.dispose();
    descriptionController.dispose();
    urlController.dispose();
    timeController.dispose();
    dateController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: TeacherHeader(
        title: "Canlı Ders Oluştur",
        teacherName: _teacherName.isEmpty ? 'Öğretmen' : _teacherName,
        subtitle: "Canlı Ders Planlama",
        showBackButton: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
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
                    "Ders Bilgileri",
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: topicController,
                    decoration: const InputDecoration(labelText: "Konu Adı"),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: descriptionController,
                    maxLines: 3,
                    decoration: const InputDecoration(labelText: "Açıklama"),
                  ),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<String>(
                    initialValue: _selectedClass.isEmpty
                        ? null
                        : _selectedClass,
                    decoration: const InputDecoration(labelText: "Sınıf"),
                    items: _classOptions
                        .map(
                          (item) =>
                              DropdownMenuItem(value: item, child: Text(item)),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() {
                        _selectedClass = value;
                      });
                    },
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: dateController,
                    readOnly: true,
                    decoration: const InputDecoration(
                      labelText: "Tarih",
                      hintText: "Takvimden seçin",
                      suffixIcon: Icon(Icons.calendar_today_rounded),
                    ),
                    onTap: _pickDate,
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: timeController,
                    decoration: const InputDecoration(
                      labelText: "Saat",
                      hintText: "Örnek: 14:00 - 14:40",
                    ),
                  ),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<String>(
                    initialValue: selectedPlatform,
                    decoration: const InputDecoration(labelText: "Platform"),
                    items: const [
                      DropdownMenuItem(value: "Zoom", child: Text("Zoom")),
                      DropdownMenuItem(
                        value: "Microsoft Teams",
                        child: Text("Microsoft Teams"),
                      ),
                    ],
                    onChanged: (value) {
                      setState(() {
                        selectedPlatform = value!;
                      });
                    },
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: urlController,
                    decoration: InputDecoration(
                      labelText: "$selectedPlatform URL",
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
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
                  Row(
                    children: [
                      Text(
                        "İndirilebilir Materyaller",
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const Spacer(),
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: _uploadingMaterial ? null : _pickMaterial,
                        child: Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: theme.colorScheme.primary.withValues(
                              alpha: 0.12,
                            ),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: _uploadingMaterial
                              ? Padding(
                                  padding: const EdgeInsets.all(10),
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: theme.colorScheme.primary,
                                  ),
                                )
                              : Icon(
                                  Icons.add,
                                  color: theme.colorScheme.primary,
                                ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  if (materials.isEmpty)
                    Text(
                      "Henüz materyal eklenmedi.",
                      style: theme.textTheme.bodyMedium,
                    ),
                  ...materials.map(
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
                          Icon(
                            Icons.insert_drive_file_rounded,
                            color: theme.colorScheme.primary,
                          ),
                          const SizedBox(width: 10),
                          Expanded(child: Text(_materialName(item))),
                          IconButton(
                            onPressed: () {
                              setState(() {
                                materials.remove(item);
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
                onPressed: _uploadingMaterial ? null : _saveLesson,
                icon: const Icon(Icons.check_circle_outline_rounded),
                label: const Text("Canlı Dersi Oluştur"),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
