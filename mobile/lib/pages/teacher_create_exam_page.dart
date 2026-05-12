import 'package:flutter/material.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/question_bank_store.dart';
import 'package:student/services/school_feed_api_service.dart';
import 'package:student/services/student_registry_store.dart';
import 'package:student/widgets/teacher_header.dart';

class TeacherCreateExamPage extends StatefulWidget {
  const TeacherCreateExamPage({super.key});

  @override
  State<TeacherCreateExamPage> createState() => _TeacherCreateExamPageState();
}

class _TeacherCreateExamPageState extends State<TeacherCreateExamPage> {
  final TextEditingController titleController = TextEditingController();
  final TextEditingController dateController = TextEditingController();
  final TextEditingController durationController = TextEditingController();
  final TextEditingController questionCountController = TextEditingController(
    text: "20",
  );

  bool _loadingSources = true;
  String selectedType = "Yazılı";
  String selectedSource = "Manuel Ekle";
  String selectedClass = '';
  String selectedSubject = 'Matematik';
  String _teacherName = '';
  final List<_ManualExamQuestionDraft> _manualQuestions = [];

  final List<Map<String, dynamic>> selectedItems = [];

  List<String> _classOptions = const [];
  List<String> _subjectOptions = const ['Matematik'];
  List<Map<String, dynamic>> questionBankItems = [];
  List<Map<String, dynamic>> mockExamItems = [];
  List<Map<String, dynamic>> _allQuestionBankItems = [];
  List<Map<String, dynamic>> _allExamItems = [];

  @override
  void initState() {
    super.initState();
    _loadSession();
    _loadSourceData();
  }

  Future<void> _loadSession() async {
    final session = await AuthSessionStore.instance.load();
    if (!mounted || session == null) return;
    setState(() => _teacherName = session.fullName);
  }

  Future<void> _loadSourceData() async {
    await StudentRegistryStore.instance.ensureLoaded();
    await QuestionBankStore.instance.loadQuestions();

    final classes =
        StudentRegistryStore.instance.students
            .map((item) => item.className)
            .where((item) => item.trim().isNotEmpty)
            .toSet()
            .toList()
          ..sort();
    final subjects =
        QuestionBankStore.instance.questions
            .map((item) => item.subject.trim())
            .where((item) => item.isNotEmpty)
            .toSet()
            .toList()
          ..sort();
    final examResults = await SchoolFeedApiService.instance.fetchExamResults();
    final groupedExams = <String, Map<String, String>>{};
    for (final item in examResults) {
      groupedExams[item.examTitle] = {
        'title': item.examTitle,
        'type': 'Deneme',
        'subject': item.subject,
      };
    }
    final allQuestionItems = QuestionBankStore.instance.questions
        .map(
          (item) => {
            'title': '${item.topic} • ${item.difficulty}',
            'type': 'Soru Bankası',
            'subject': item.subject,
            'className': item.classTargets.join(','),
            'questionId': item.id,
            'imagePath': item.imagePath,
            'imagePlacement': 'Top',
          },
        )
        .toList();

    if (!mounted) return;
    setState(() {
      _classOptions = classes;
      selectedClass = classes.isNotEmpty ? classes.first : '';
      _subjectOptions = subjects.isEmpty ? const ['Matematik'] : subjects;
      selectedSubject = _subjectOptions.first;
      _allQuestionBankItems = allQuestionItems;
      _allExamItems = groupedExams.values.toList();
      _applyFilters();
      _loadingSources = false;
    });
  }

  void _applyFilters() {
    questionBankItems = _allQuestionBankItems
        .where((item) {
          final matchesSubject = (item['subject'] ?? '') == selectedSubject;
          final classTargets = (item['className'] ?? '').split(',');
          final matchesClass =
              selectedClass.isEmpty ||
              classTargets.contains('Tüm Sınıflar') ||
              classTargets.contains(selectedClass);
          return matchesSubject && matchesClass;
        })
        .take(20)
        .toList();
    mockExamItems = _allExamItems
        .where(
          (item) => (item['subject'] ?? selectedSubject) == selectedSubject,
        )
        .toList();
    selectedItems.removeWhere(
      (item) => (item['subject'] ?? selectedSubject) != selectedSubject,
    );
    if (selectedSource != 'Manuel Ekle') {
      questionCountController.text = selectedItems.length.toString();
    }
  }

  @override
  void dispose() {
    titleController.dispose();
    dateController.dispose();
    durationController.dispose();
    questionCountController.dispose();
    for (final item in _manualQuestions) {
      item.dispose();
    }
    super.dispose();
  }

  void _addSourceItem(Map<String, dynamic> item) {
    final exists = selectedItems.any((e) => e["title"] == item["title"]);
    if (exists) return;

    setState(() {
      selectedItems.add(item);
      questionCountController.text = selectedItems.length.toString();
    });
  }

  void _removeSourceItem(Map<String, dynamic> item) {
    setState(() {
      selectedItems.remove(item);
      questionCountController.text = selectedItems.length.toString();
    });
  }

  void _addManualQuestion() {
    setState(() {
      _manualQuestions.add(_ManualExamQuestionDraft(subject: selectedSubject));
      questionCountController.text = _manualQuestions.length.toString();
    });
  }

  void _removeManualQuestion(_ManualExamQuestionDraft draft) {
    setState(() {
      draft.dispose();
      _manualQuestions.remove(draft);
      questionCountController.text = _manualQuestions.length.toString();
    });
  }

  void _openSourcePicker() {
    final items = selectedSource == "Denemelerden"
        ? mockExamItems
        : selectedSource == "Soru Bankasından"
        ? questionBankItems
        : [...questionBankItems, ...mockExamItems];

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.all(20),
          child: ListView(
            shrinkWrap: true,
            children: [
              const Text(
                "İçerik Seç",
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 14),
              ...items.map(
                (item) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                    backgroundColor: const Color(
                      0xFFFF7A00,
                    ).withValues(alpha: 0.12),
                    child: Icon(
                      item["type"] == "Deneme"
                          ? Icons.fact_check_rounded
                          : Icons.quiz_rounded,
                      color: const Color(0xFFFF7A00),
                    ),
                  ),
                  title: Text(item["title"]!),
                  subtitle: Text(item["type"]!),
                  trailing: const Icon(Icons.add_circle_outline_rounded),
                  onTap: () {
                    _addSourceItem(item);
                    Navigator.pop(context);
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _saveExam() async {
    if (titleController.text.trim().isEmpty ||
        dateController.text.trim().isEmpty ||
        durationController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Başlık, tarih ve süre zorunludur.")),
      );
      return;
    }

    try {
      await _saveExamAsync();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Sınav oluşturulamadı: $error'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _saveExamAsync() async {
    if (selectedSource == 'Manuel Ekle' &&
        _manualQuestions.any(
          (item) =>
              item.questionController.text.trim().isEmpty ||
              item.topicController.text.trim().isEmpty,
        )) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Manuel soru kartlarında konu ve soru metni zorunludur.',
          ),
        ),
      );
      return;
    }

    var sources = List<Map<String, dynamic>>.from(selectedItems);
    if (selectedSource == 'Manuel Ekle' && _manualQuestions.isNotEmpty) {
      final teacherName = _teacherName.isEmpty ? 'Öğretmen' : _teacherName;
      for (final draft in _manualQuestions) {
        final options = draft.optionControllers
            .map((item) => item.text.trim())
            .where((item) => item.isNotEmpty)
            .toList();
        final created = await QuestionBankStore.instance.addQuestion(
          subject: selectedSubject,
          topic: draft.topicController.text.trim(),
          difficulty: draft.difficulty,
          type: draft.type,
          questionText: draft.questionController.text.trim(),
          teacher: teacherName,
          imagePath: draft.imagePath,
          options: options,
          correctOptionIndex: draft.type == 'Çoktan Seçmeli'
              ? draft.correctOptionIndex
              : null,
          classTargets: [
            if (selectedClass.isNotEmpty) selectedClass else 'Tüm Sınıflar',
          ],
          solutionAssetPath: draft.solutionAssetPath,
          solutionAssetType: draft.solutionAssetType,
          revealCorrectAnswerToStudent: false,
          expectedAnswer: draft.type == 'Çoktan Seçmeli'
              ? options.elementAtOrNull(draft.correctOptionIndex)
              : draft.answerController.text.trim(),
        );
        sources.add({
          'questionId': created.id,
          'title': created.questionText,
          'type': created.type,
          'subject': created.subject,
          'imagePath': created.imagePath,
          'imagePlacement': 'Top',
        });
      }
    }

    if (!mounted) return;
    Navigator.pop(context, {
      "title": titleController.text.trim(),
      "type": selectedType,
      "className": selectedClass,
      "subject": selectedSubject,
      "date": dateController.text.trim(),
      "questionCount": selectedSource == 'Manuel Ekle'
          ? _manualQuestions.length
          : (int.tryParse(questionCountController.text.trim()) ?? 0),
      "duration": durationController.text.trim(),
      "status": "Planlandı",
      "statusColor": const Color(0xFF4E8DF5),
      "accentColor": const Color(0xFFFF7A00),
      "sourceType": selectedSource,
      "sources": sources,
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: TeacherHeader(
        title: "Sınav Oluştur",
        teacherName: _teacherName.isEmpty ? 'Öğretmen' : _teacherName,
        subtitle: selectedSubject.isEmpty
            ? "Öğretmen"
            : "$selectedSubject Öğretmeni",
        showBackButton: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: Column(
          children: [
            if (_loadingSources)
              const Padding(
                padding: EdgeInsets.only(bottom: 16),
                child: LinearProgressIndicator(),
              ),
            _card(
              theme,
              isDark,
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Sınav Bilgileri",
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: titleController,
                    decoration: const InputDecoration(
                      labelText: "Sınav Başlığı",
                    ),
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
                    initialValue: selectedClass.isEmpty ? null : selectedClass,
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
                        selectedClass = value;
                        _applyFilters();
                      });
                    },
                  ),
                  const SizedBox(height: 14),
                  DropdownButtonFormField<String>(
                    initialValue: selectedSubject,
                    decoration: const InputDecoration(labelText: "Ders"),
                    items: _subjectOptions
                        .map(
                          (item) =>
                              DropdownMenuItem(value: item, child: Text(item)),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() {
                        selectedSubject = value;
                        selectedItems.clear();
                        if (selectedSource != 'Manuel Ekle') {
                          questionCountController.text = '0';
                        }
                        _applyFilters();
                      });
                    },
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: dateController,
                    readOnly: true,
                    decoration: const InputDecoration(
                      labelText: "Tarih / Saat",
                      hintText: "Örnek: 30 Mart • 10:00",
                    ),
                    onTap: _pickDateTime,
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: durationController,
                    decoration: const InputDecoration(
                      labelText: "Süre",
                      hintText: "Örnek: 40 dk",
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
                    "Soru Kaynağı",
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: selectedSource,
                    decoration: const InputDecoration(labelText: "Kaynak Türü"),
                    items: const [
                      DropdownMenuItem(
                        value: "Manuel Ekle",
                        child: Text("Manuel Ekle"),
                      ),
                      DropdownMenuItem(
                        value: "Soru Bankasından",
                        child: Text("Soru Bankasından"),
                      ),
                      DropdownMenuItem(
                        value: "Denemelerden",
                        child: Text("Denemelerden"),
                      ),
                      DropdownMenuItem(
                        value: "Karisik",
                        child: Text("Karışık"),
                      ),
                    ],
                    onChanged: (value) {
                      setState(() {
                        selectedSource = value!;
                        selectedItems.clear();
                        if (selectedSource != "Manuel Ekle") {
                          _manualQuestions.clear();
                        }
                        questionCountController.text = "0";
                      });
                    },
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: questionCountController,
                    readOnly: selectedSource != "Manuel Ekle",
                    decoration: const InputDecoration(labelText: "Soru Sayısı"),
                  ),
                  const SizedBox(height: 16),
                  if (selectedSource != "Manuel Ekle")
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: OutlinedButton.icon(
                        onPressed: _openSourcePicker,
                        icon: const Icon(Icons.add_circle_outline_rounded),
                        label: const Text("Kaynaktan İçerik Seç"),
                      ),
                    ),
                  if (selectedSource == "Manuel Ekle")
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Bu seçimde her soruyu tek tek tanımlayıp sınavla birlikte kaydedebilirsin.",
                          style: theme.textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          onPressed: _addManualQuestion,
                          icon: const Icon(Icons.add_circle_outline_rounded),
                          label: const Text("Soru Kartı Ekle"),
                        ),
                        if (_manualQuestions.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          ..._manualQuestions.map(
                            (item) => Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: theme.scaffoldBackgroundColor,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Text(
                                        "Manuel Soru",
                                        style: TextStyle(
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      const Spacer(),
                                      IconButton(
                                        onPressed: () =>
                                            _removeManualQuestion(item),
                                        icon: const Icon(
                                          Icons.delete_outline_rounded,
                                        ),
                                      ),
                                    ],
                                  ),
                                  DropdownButtonFormField<String>(
                                    initialValue: item.type,
                                    decoration: const InputDecoration(
                                      labelText: "Soru Tipi",
                                    ),
                                    items: const [
                                      DropdownMenuItem(
                                        value: "Açık Uçlu",
                                        child: Text("Açık Uçlu"),
                                      ),
                                      DropdownMenuItem(
                                        value: "Çoktan Seçmeli",
                                        child: Text("Çoktan Seçmeli"),
                                      ),
                                      DropdownMenuItem(
                                        value: "Doğru / Yanlış",
                                        child: Text("Doğru / Yanlış"),
                                      ),
                                    ],
                                    onChanged: (value) {
                                      if (value == null) return;
                                      setState(() => item.type = value);
                                    },
                                  ),
                                  const SizedBox(height: 10),
                                  TextField(
                                    controller: item.topicController,
                                    decoration: const InputDecoration(
                                      labelText: "Konu",
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  TextField(
                                    controller: item.questionController,
                                    maxLines: 4,
                                    decoration: const InputDecoration(
                                      labelText: "Soru Metni",
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  if (item.type == 'Çoktan Seçmeli') ...[
                                    ...List.generate(
                                      item.optionControllers.length,
                                      (optionIndex) => Padding(
                                        padding: const EdgeInsets.only(
                                          bottom: 8,
                                        ),
                                        child: TextField(
                                          controller: item
                                              .optionControllers[optionIndex],
                                          decoration: InputDecoration(
                                            labelText: "Şık ${optionIndex + 1}",
                                          ),
                                        ),
                                      ),
                                    ),
                                    DropdownButtonFormField<int>(
                                      initialValue: item.correctOptionIndex,
                                      decoration: const InputDecoration(
                                        labelText: "Doğru Şık",
                                      ),
                                      items: List.generate(
                                        item.optionControllers.length,
                                        (index) => DropdownMenuItem(
                                          value: index,
                                          child: Text("Şık ${index + 1}"),
                                        ),
                                      ),
                                      onChanged: (value) {
                                        setState(
                                          () => item.correctOptionIndex =
                                              value ?? 0,
                                        );
                                      },
                                    ),
                                  ] else ...[
                                    TextField(
                                      controller: item.answerController,
                                      decoration: const InputDecoration(
                                        labelText: "Beklenen Cevap",
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  if (selectedItems.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    ...selectedItems.map(
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
                              item["type"] == "Deneme"
                                  ? Icons.fact_check_rounded
                                  : Icons.quiz_rounded,
                              color: theme.colorScheme.primary,
                            ),
                            const SizedBox(width: 10),
                            Expanded(child: Text(item["title"]!)),
                            IconButton(
                              onPressed: () => _removeSourceItem(item),
                              icon: const Icon(Icons.delete_outline_rounded),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              height: 54,
              child: ElevatedButton.icon(
                onPressed: _saveExam,
                icon: const Icon(Icons.check_circle_outline_rounded),
                label: const Text("Sınavı Oluştur"),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickDateTime() async {
    final now = DateTime.now();
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: now.subtract(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (pickedDate == null || !mounted) return;
    final pickedTime = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(now),
    );
    if (pickedTime == null) return;
    final hour = pickedTime.hour.toString().padLeft(2, '0');
    final minute = pickedTime.minute.toString().padLeft(2, '0');
    dateController.text =
        '${pickedDate.day.toString().padLeft(2, '0')} ${_monthName(pickedDate.month)} • $hour:$minute';
  }

  String _monthName(int month) {
    const months = [
      'Ocak',
      'Şubat',
      'Mart',
      'Nisan',
      'Mayıs',
      'Haziran',
      'Temmuz',
      'Ağustos',
      'Eylül',
      'Ekim',
      'Kasım',
      'Aralık',
    ];
    return months[month - 1];
  }

  Widget _card(ThemeData theme, bool isDark, Widget child) {
    return Container(
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
      child: child,
    );
  }
}

class _ManualExamQuestionDraft {
  _ManualExamQuestionDraft({required this.subject});

  final String subject;
  final TextEditingController topicController = TextEditingController();
  final TextEditingController questionController = TextEditingController();
  final TextEditingController answerController = TextEditingController();
  final List<TextEditingController> optionControllers = List.generate(
    4,
    (_) => TextEditingController(),
  );
  String type = 'Açık Uçlu';
  String difficulty = 'Orta';
  String? imagePath;
  String? solutionAssetPath;
  String? solutionAssetType;
  int correctOptionIndex = 0;

  void dispose() {
    topicController.dispose();
    questionController.dispose();
    answerController.dispose();
    for (final item in optionControllers) {
      item.dispose();
    }
  }
}
