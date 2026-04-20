import 'package:flutter/material.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/student_registry_store.dart';
import 'package:student/widgets/teacher_header.dart';

class TeacherExamEditPage extends StatefulWidget {
  final Map<String, dynamic> exam;

  const TeacherExamEditPage({super.key, required this.exam});

  @override
  State<TeacherExamEditPage> createState() => _TeacherExamEditPageState();
}

class _TeacherExamEditPageState extends State<TeacherExamEditPage> {
  late final TextEditingController titleController;
  late final TextEditingController dateController;
  late final TextEditingController questionController;
  late final TextEditingController durationController;
  late String selectedType;
  List<String> _classOptions = const [];
  String _selectedClass = '';
  String _teacherName = '';

  @override
  void initState() {
    super.initState();
    _loadSession();
    titleController = TextEditingController(
      text: widget.exam["title"] as String,
    );
    dateController = TextEditingController(text: widget.exam["date"] as String);
    questionController = TextEditingController(
      text: widget.exam["questionCount"].toString(),
    );
    durationController = TextEditingController(
      text: widget.exam["duration"] as String,
    );
    selectedType = widget.exam["type"] as String;
    _selectedClass = widget.exam["className"] as String? ?? '';
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
      if (_selectedClass.isEmpty || !_classOptions.contains(_selectedClass)) {
        if (_classOptions.isEmpty) return;
        _selectedClass = _classOptions.first;
      }
    });
  }

  @override
  void dispose() {
    titleController.dispose();
    dateController.dispose();
    questionController.dispose();
    durationController.dispose();
    super.dispose();
  }

  void _save() {
    Navigator.pop(context, {
      ...widget.exam,
      "title": titleController.text.trim(),
      "className": _selectedClass,
      "date": dateController.text.trim(),
      "questionCount": int.tryParse(questionController.text.trim()) ?? 0,
      "duration": durationController.text.trim(),
      "type": selectedType,
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: TeacherHeader(
        title: "Sınavı Düzenle",
        teacherName: _teacherName.isEmpty ? 'Öğretmen' : _teacherName,
        subtitle: '${widget.exam["subject"] as String? ?? 'Ders'} Öğretmeni',
        showBackButton: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: theme.cardColor,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            children: [
              TextField(
                controller: titleController,
                decoration: const InputDecoration(labelText: "Sınav Başlığı"),
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                initialValue: selectedType,
                decoration: const InputDecoration(labelText: "Sınav Türü"),
                items: const [
                  DropdownMenuItem(value: "Yazılı", child: Text("Yazılı")),
                  DropdownMenuItem(value: "Quiz", child: Text("Quiz")),
                  DropdownMenuItem(value: "Deneme", child: Text("Deneme")),
                ],
                onChanged: (value) {
                  setState(() {
                    selectedType = value!;
                  });
                },
              ),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                initialValue: _selectedClass.isEmpty ? null : _selectedClass,
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
                decoration: const InputDecoration(labelText: "Tarih / Saat"),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: questionController,
                decoration: const InputDecoration(labelText: "Soru Sayisi"),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: durationController,
                decoration: const InputDecoration(labelText: "Sure"),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: _save,
                  child: const Text("Degisiklikleri Kaydet"),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
