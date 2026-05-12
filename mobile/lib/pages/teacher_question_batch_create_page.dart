import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../services/admin_directory_api_service.dart';
import '../services/auth_session_store.dart';
import '../services/question_bank_api_service.dart';
import '../services/question_bank_store.dart';
import '../services/student_registry_store.dart';

class TeacherQuestionBatchCreatePage extends StatefulWidget {
  const TeacherQuestionBatchCreatePage({super.key});

  @override
  State<TeacherQuestionBatchCreatePage> createState() =>
      _TeacherQuestionBatchCreatePageState();
}

class _TeacherQuestionBatchCreatePageState
    extends State<TeacherQuestionBatchCreatePage> {
  static const List<String> _fallbackClasses = [
    '9-A',
    '9-B',
    '10-A',
    '10-B',
    '11-A',
    '11-B',
    '12-A',
    '12-B',
  ];
  static const List<String> _defaultSubjects = [
    'Matematik',
    'Türkçe',
    'Fizik',
    'Kimya',
    'Biyoloji',
    'İngilizce',
  ];
  final List<_QuestionDraft> _drafts = [_QuestionDraft()];
  bool _isSaving = false;
  List<String> _classOptions = const ['Tüm Sınıflar'];
  List<String> _subjectOptions = _defaultSubjects;

  List<String> get _availableClassOptions {
    if (_classOptions.length > 1) {
      return _classOptions;
    }
    return ['Tüm Sınıflar', ..._fallbackClasses];
  }

  @override
  void initState() {
    super.initState();
    _loadClasses();
  }

  Future<void> _loadClasses() async {
    await QuestionBankStore.instance.loadQuestions();
    await StudentRegistryStore.instance.ensureLoaded();
    final apiClasses = await AdminDirectoryApiService.instance
        .fetchClasses()
        .catchError((_) => <String>[]);
    final classes = {
      ...apiClasses
          .map((item) => item.trim())
          .where((item) => item.isNotEmpty && item != 'Tüm Sınıflar'),
      ...StudentRegistryStore.instance.students
          .map((item) => item.className.trim())
          .where((item) => item.isNotEmpty),
      ...QuestionBankStore.instance.questions.expand(
        (item) => item.classTargets
            .map((target) => target.trim())
            .where((target) => target.isNotEmpty && target != 'Tüm Sınıflar'),
      ),
      ..._drafts.expand(
        (draft) =>
            draft.selectedClasses.where((item) => item != 'Tüm Sınıflar'),
      ),
      ..._fallbackClasses,
    }.toList()..sort();
    final subjects = {
      ..._defaultSubjects,
      ...QuestionBankStore.instance.questions
          .map((item) => item.subject.trim())
          .where((item) => item.isNotEmpty),
    }.toList()..sort();
    if (!mounted) return;
    setState(() {
      _classOptions = [
        'Tüm Sınıflar',
        ...(classes.isEmpty ? _fallbackClasses : classes),
      ];
      _subjectOptions = subjects;
      for (final draft in _drafts) {
        draft.selectedClasses.removeWhere(
          (item) => item != 'Tüm Sınıflar' && !classes.contains(item),
        );
        if (draft.selectedClasses.isEmpty) {
          draft.selectedClasses.add('Tüm Sınıflar');
        }
        if (!_subjectOptions.contains(draft.subject)) {
          draft.subject = _subjectOptions.first;
        }
      }
    });
  }

  @override
  void dispose() {
    for (final draft in _drafts) {
      draft.dispose();
    }
    super.dispose();
  }

  Future<void> _pickFile(_QuestionDraft draft, {required bool image}) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: image
          ? ['jpg', 'jpeg', 'png']
          : ['pdf', 'mp4', 'mov', 'ppt', 'pptx', 'doc', 'docx'],
    );
    if (result == null || result.files.single.path == null || !mounted) return;
    setState(() {
      if (image) {
        draft.imagePath = result.files.single.path!;
      } else {
        draft.solutionAssetPath = result.files.single.path!;
        final extension = result.files.single.extension?.toLowerCase();
        if (extension == 'pdf') {
          draft.solutionAssetType = 'PDF';
        } else if (extension == 'mp4' || extension == 'mov') {
          draft.solutionAssetType = 'Video';
        } else {
          draft.solutionAssetType = 'Dosya';
        }
      }
    });
  }

  void _addDraft() {
    setState(() => _drafts.add(_QuestionDraft()));
  }

  void _removeDraft(_QuestionDraft draft) {
    if (_drafts.length == 1) return;
    setState(() {
      _drafts.remove(draft);
      draft.dispose();
    });
  }

  Future<void> _saveAll() async {
    if (_isSaving) return;
    final hasInvalid = _drafts.any(
      (item) =>
          item.questionController.text.trim().isEmpty ||
          item.topicController.text.trim().isEmpty,
    );
    if (hasInvalid) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Her soru kartında konu ve soru metni zorunludur.'),
        ),
      );
      return;
    }
    final hasInvalidMultipleChoice = _drafts.any(
      (item) =>
          item.type == 'Çoktan Seçmeli' &&
          item.optionControllers
                  .map((entry) => entry.text.trim())
                  .where((entry) => entry.isNotEmpty)
                  .length <
              2,
    );
    if (hasInvalidMultipleChoice) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Çoktan seçmeli soru kartlarında en az iki şık girin.'),
        ),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      final session = await AuthSessionStore.instance.load();
      final teacherName = session?.fullName ?? 'Öğretmen';
      final setKey = 'set-${DateTime.now().microsecondsSinceEpoch}';
      final setTitle = _drafts.first.topicController.text.trim().isEmpty
          ? 'Soru Seti'
          : _drafts.first.topicController.text.trim();
      for (final draft in _drafts) {
        final options = draft.optionControllers
            .map((item) => item.text.trim())
            .where((item) => item.isNotEmpty)
            .toList();
        String? uploadedImagePath = draft.imagePath;
        String? uploadedSolutionPath = draft.solutionAssetPath;
        if (draft.imagePath != null &&
            draft.imagePath!.isNotEmpty &&
            !draft.imagePath!.startsWith('http://') &&
            !draft.imagePath!.startsWith('https://')) {
          uploadedImagePath = await QuestionBankApiService.instance
              .uploadQuestionAsset(
                path: draft.imagePath!,
                folder: 'question-images',
              );
        }
        if (draft.solutionAssetPath != null &&
            draft.solutionAssetPath!.isNotEmpty &&
            !draft.solutionAssetPath!.startsWith('http://') &&
            !draft.solutionAssetPath!.startsWith('https://')) {
          uploadedSolutionPath = await QuestionBankApiService.instance
              .uploadQuestionAsset(
                path: draft.solutionAssetPath!,
                folder: 'question-solutions',
              );
        }
        await QuestionBankStore.instance.addQuestion(
          subject: draft.subject,
          topic: draft.topicController.text.trim(),
          difficulty: draft.difficulty,
          type: draft.type,
          questionText: draft.questionController.text.trim(),
          teacher: teacherName,
          imagePath: uploadedImagePath,
          options: draft.type == 'Çoktan Seçmeli'
              ? options
              : (draft.type == 'Doğru / Yanlış'
                    ? const ['Doğru', 'Yanlış']
                    : const <String>[]),
          correctOptionIndex: draft.type == 'Çoktan Seçmeli'
              ? draft.correctOptionIndex
              : (draft.type == 'Doğru / Yanlış'
                    ? (draft.answerController.text.trim() == 'Yanlış' ? 1 : 0)
                    : null),
          classTargets: draft.selectedClasses.toList(),
          solutionAssetPath: uploadedSolutionPath,
          solutionAssetType: draft.solutionAssetType,
          questionSetKey: setKey,
          questionSetTitle: setTitle,
          questionOrder: _drafts.indexOf(draft),
          revealCorrectAnswerToStudent: draft.revealCorrectAnswerToStudent,
          expectedAnswer: draft.type == 'Çoktan Seçmeli'
              ? options.elementAtOrNull(draft.correctOptionIndex)
              : (draft.type == 'Doğru / Yanlış'
                    ? (draft.answerController.text.trim() == 'Yanlış'
                          ? 'Yanlış'
                          : 'Doğru')
                    : draft.answerController.text.trim()),
        );
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${_drafts.length} soru soru bankasına kaydedildi.'),
        ),
      );
      Navigator.pop(context, true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Soru Seti Oluştur'),
        actions: [
          TextButton.icon(
            onPressed: _isSaving ? null : _addDraft,
            icon: const Icon(Icons.add_circle_outline_rounded),
            label: const Text('Kart Ekle'),
          ),
        ],
      ),
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
        itemCount: _drafts.length,
        separatorBuilder: (context, index) => const SizedBox(height: 16),
        itemBuilder: (context, index) {
          final draft = _drafts[index];
          return Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: theme.cardColor,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 12,
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
                      'Soru ${index + 1}',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed: _drafts.length == 1
                          ? null
                          : () => _removeDraft(draft),
                      icon: const Icon(Icons.delete_outline_rounded),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: draft.subject,
                  decoration: const InputDecoration(labelText: 'Ders'),
                  items: _subjectOptions
                      .map(
                        (item) =>
                            DropdownMenuItem(value: item, child: Text(item)),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setState(() => draft.subject = value ?? draft.subject),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: draft.topicController,
                  decoration: const InputDecoration(labelText: 'Konu'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: draft.difficulty,
                  decoration: const InputDecoration(labelText: 'Zorluk'),
                  items: const [
                    DropdownMenuItem(value: 'Kolay', child: Text('Kolay')),
                    DropdownMenuItem(value: 'Orta', child: Text('Orta')),
                    DropdownMenuItem(value: 'Zor', child: Text('Zor')),
                  ],
                  onChanged: (value) => setState(
                    () => draft.difficulty = value ?? draft.difficulty,
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: draft.type,
                  decoration: const InputDecoration(labelText: 'Soru Tipi'),
                  items: const [
                    DropdownMenuItem(
                      value: 'Açık Uçlu',
                      child: Text('Açık Uçlu'),
                    ),
                    DropdownMenuItem(
                      value: 'Çoktan Seçmeli',
                      child: Text('Çoktan Seçmeli'),
                    ),
                    DropdownMenuItem(
                      value: 'Doğru / Yanlış',
                      child: Text('Doğru / Yanlış'),
                    ),
                  ],
                  onChanged: (value) =>
                      setState(() => draft.type = value ?? draft.type),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: draft.imagePlacement,
                  decoration: const InputDecoration(labelText: 'Görsel Konumu'),
                  items: const [
                    DropdownMenuItem(value: 'Top', child: Text('Görsel Üstte')),
                    DropdownMenuItem(
                      value: 'Bottom',
                      child: Text('Görsel Altta'),
                    ),
                  ],
                  onChanged: (value) => setState(
                    () => draft.imagePlacement = value ?? draft.imagePlacement,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: draft.questionController,
                  maxLines: 6,
                  decoration: const InputDecoration(labelText: 'Soru Metni'),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _availableClassOptions.map((item) {
                    final selected = draft.selectedClasses.contains(item);
                    return FilterChip(
                      label: Text(item),
                      selected: selected,
                      onSelected: (value) {
                        setState(() {
                          if (item == 'Tüm Sınıflar') {
                            draft.selectedClasses
                              ..clear()
                              ..add('Tüm Sınıflar');
                          } else {
                            draft.selectedClasses.remove('Tüm Sınıflar');
                            if (value) {
                              draft.selectedClasses.add(item);
                            } else {
                              draft.selectedClasses.remove(item);
                            }
                            if (draft.selectedClasses.isEmpty) {
                              draft.selectedClasses.add('Tüm Sınıflar');
                            }
                          }
                        });
                      },
                    );
                  }).toList(),
                ),
                if (draft.type == 'Çoktan Seçmeli') ...[
                  const SizedBox(height: 12),
                  ...List.generate(
                    draft.optionControllers.length,
                    (optionIndex) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: TextField(
                        controller: draft.optionControllers[optionIndex],
                        decoration: InputDecoration(
                          labelText: 'Şık ${optionIndex + 1}',
                        ),
                      ),
                    ),
                  ),
                  DropdownButtonFormField<int>(
                    initialValue: draft.correctOptionIndex,
                    decoration: const InputDecoration(labelText: 'Doğru Şık'),
                    items: List.generate(
                      draft.optionControllers.length,
                      (index) => DropdownMenuItem(
                        value: index,
                        child: Text('Şık ${index + 1}'),
                      ),
                    ),
                    onChanged: (value) =>
                        setState(() => draft.correctOptionIndex = value ?? 0),
                  ),
                ] else if (draft.type == 'Doğru / Yanlış') ...[
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: ['Doğru', 'Yanlış'].map((item) {
                      final selected =
                          (draft.answerController.text.trim() == 'Yanlış'
                              ? 'Yanlış'
                              : 'Doğru') ==
                          item;
                      return ChoiceChip(
                        label: Text(item),
                        selected: selected,
                        onSelected: (_) =>
                            setState(() => draft.answerController.text = item),
                      );
                    }).toList(),
                  ),
                ] else ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: draft.answerController,
                    decoration: const InputDecoration(
                      labelText: 'Beklenen Cevap',
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: draft.revealCorrectAnswerToStudent,
                  title: const Text('Doğru cevabı öğrenciye göster'),
                  onChanged: (value) => setState(
                    () => draft.revealCorrectAnswerToStudent = value,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => _pickFile(draft, image: true),
                      icon: const Icon(Icons.image_outlined),
                      label: Text(
                        draft.imagePath == null
                            ? 'Görsel Ekle'
                            : draft.imagePath!.split('/').last,
                      ),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => _pickFile(draft, image: false),
                      icon: const Icon(Icons.attach_file_rounded),
                      label: Text(
                        draft.solutionAssetPath == null
                            ? 'Çözüm Eki'
                            : draft.solutionAssetPath!.split('/').last,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: SizedBox(
          height: 54,
          child: ElevatedButton.icon(
            onPressed: _isSaving ? null : _saveAll,
            icon: const Icon(Icons.check_circle_outline_rounded),
            label: Text(_isSaving ? 'Kaydediliyor...' : 'Soru Setini Kaydet'),
          ),
        ),
      ),
    );
  }
}

class _QuestionDraft {
  _QuestionDraft();

  final TextEditingController topicController = TextEditingController();
  final TextEditingController questionController = TextEditingController();
  final TextEditingController answerController = TextEditingController();
  final List<TextEditingController> optionControllers = List.generate(
    4,
    (_) => TextEditingController(),
  );

  String subject = 'Matematik';
  String difficulty = 'Orta';
  String type = 'Açık Uçlu';
  String imagePlacement = 'Top';
  String? imagePath;
  String? solutionAssetPath;
  String? solutionAssetType;
  int correctOptionIndex = 0;
  bool revealCorrectAnswerToStudent = false;
  final Set<String> selectedClasses = {'Tüm Sınıflar'};

  void dispose() {
    topicController.dispose();
    questionController.dispose();
    answerController.dispose();
    for (final controller in optionControllers) {
      controller.dispose();
    }
  }
}
