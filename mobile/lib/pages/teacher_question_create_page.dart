import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../services/admin_directory_api_service.dart';
import '../services/auth_session_store.dart';
import '../services/question_bank_api_service.dart';
import '../services/question_bank_store.dart';
import '../services/student_registry_store.dart';
import '../widgets/responsive_layout.dart';

class TeacherQuestionCreatePage extends StatefulWidget {
  final QuestionBankRecord? initialQuestion;

  const TeacherQuestionCreatePage({
    super.key,
    this.initialQuestion,
  });

  @override
  State<TeacherQuestionCreatePage> createState() => _TeacherQuestionCreatePageState();
}

class _TeacherQuestionCreatePageState extends State<TeacherQuestionCreatePage> {
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
  final _topicController = TextEditingController();
  final _questionController = TextEditingController();
  final _answerKeyController = TextEditingController();
  late final List<TextEditingController> _optionControllers;

  String _subject = 'Matematik';
  String _difficulty = 'Orta';
  String _type = 'Açık Uçlu';
  String? _imagePath;
  String? _solutionAssetPath;
  String? _solutionAssetType;
  int _correctOptionIndex = 0;
  bool _revealCorrectAnswerToStudent = false;
  List<String> _classOptions = const ['Tüm Sınıflar'];
  List<String> _subjectOptions = _defaultSubjects;
  final Set<String> _selectedClasses = {'Tüm Sınıflar'};
  bool _isSaving = false;

  List<String> get _availableClassOptions {
    if (_classOptions.length > 1) {
      return _classOptions;
    }
    return ['Tüm Sınıflar', ..._fallbackClasses];
  }
  bool get _isMultipleChoice => _type == 'Çoktan Seçmeli';
  bool get _isTrueFalse => _type == 'Doğru / Yanlış';

  bool get _isEditMode => widget.initialQuestion != null;

  @override
  void initState() {
    super.initState();
    final initial = widget.initialQuestion;
    _optionControllers = List.generate(4, (_) => TextEditingController());

    if (initial != null) {
      _subject = initial.subject;
      _difficulty = initial.difficulty;
      _type = initial.type;
      _imagePath = initial.imagePath;
      _solutionAssetPath = initial.solutionAssetPath;
      _solutionAssetType = initial.solutionAssetType;
      _revealCorrectAnswerToStudent = initial.revealCorrectAnswerToStudent;
      _selectedClasses
        ..clear()
        ..addAll(initial.classTargets);
      _topicController.text = initial.topic;
      _questionController.text = initial.questionText;
      _answerKeyController.text = initial.expectedAnswer ?? '';
      for (var i = 0; i < initial.options.length && i < _optionControllers.length; i++) {
        _optionControllers[i].text = initial.options[i];
      }
      _correctOptionIndex = initial.correctOptionIndex ?? 0;
    }
    _loadClassOptions();
  }

  Future<void> _loadClassOptions() async {
    await QuestionBankStore.instance.loadQuestions();
    await StudentRegistryStore.instance.ensureLoaded();
    final apiClasses = await AdminDirectoryApiService.instance.fetchClasses().catchError((_) => <String>[]);
    final classes = {
      ...apiClasses.map((item) => item.trim()).where((item) => item.isNotEmpty && item != 'Tüm Sınıflar'),
      ...StudentRegistryStore.instance.students
          .map((item) => item.className.trim())
          .where((item) => item.isNotEmpty),
      ...QuestionBankStore.instance.questions.expand(
        (item) => item.classTargets.map((target) => target.trim()).where((target) => target.isNotEmpty && target != 'Tüm Sınıflar'),
      ),
      ..._selectedClasses.where((item) => item != 'Tüm Sınıflar'),
      ..._fallbackClasses,
    }.toList()
      ..sort();
    final subjects = {
      ..._defaultSubjects,
      ...QuestionBankStore.instance.questions
          .map((item) => item.subject.trim())
          .where((item) => item.isNotEmpty),
    }.toList()
      ..sort();
    if (!mounted) return;
    setState(() {
      _classOptions = ['Tüm Sınıflar', ...(classes.isEmpty ? _fallbackClasses : classes)];
      _subjectOptions = subjects;
      if (!_subjectOptions.contains(_subject)) {
        _subject = _subjectOptions.first;
      }
      _selectedClasses.removeWhere((item) => item != 'Tüm Sınıflar' && !classes.contains(item));
      if (_selectedClasses.isEmpty) {
        _selectedClasses.add('Tüm Sınıflar');
      }
    });
  }

  @override
  void dispose() {
    _topicController.dispose();
    _questionController.dispose();
    _answerKeyController.dispose();
    for (final controller in _optionControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _pickImage() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['jpg', 'jpeg', 'png'],
    );
    if (result == null || result.files.single.path == null) return;
    setState(() {
      _imagePath = result.files.single.path!;
    });
  }

  Future<void> _pickSolutionAsset() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'mp4', 'mov', 'ppt', 'pptx', 'doc', 'docx'],
    );
    if (result == null || result.files.single.path == null) return;
    final extension = result.files.single.extension?.toLowerCase();
    setState(() {
      _solutionAssetPath = result.files.single.path!;
      if (extension == 'pdf') {
        _solutionAssetType = 'PDF';
      } else if (extension == 'mp4' || extension == 'mov') {
        _solutionAssetType = 'Video';
      } else {
        _solutionAssetType = 'Dosya';
      }
    });
  }

  Future<void> _save() async {
    if (_isSaving) return;
    if (_topicController.text.trim().isEmpty || _questionController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Konu ve soru metni zorunludur.')),
      );
      return;
    }

    final optionValues = _optionControllers.map((item) => item.text.trim()).where((item) => item.isNotEmpty).toList();
    if (_isMultipleChoice && optionValues.length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Çoktan seçmeli sorular için en az iki seçenek girin.')),
      );
      return;
    }

    final session = await AuthSessionStore.instance.load();
    final teacherName = session?.fullName ?? 'Öğretmen';
    final setKey = widget.initialQuestion?.questionSetKey ??
        'set-${DateTime.now().microsecondsSinceEpoch}';
    final setTitle = widget.initialQuestion?.questionSetTitle ?? _topicController.text.trim();
    final expectedAnswer = _isMultipleChoice
        ? optionValues.elementAtOrNull(_correctOptionIndex)
        : (_isTrueFalse
            ? (_answerKeyController.text.trim() == 'Yanlış' ? 'Yanlış' : 'Doğru')
            : _answerKeyController.text.trim());

    setState(() {
      _isSaving = true;
    });

    try {
      String? uploadedImagePath = _imagePath;
      String? uploadedSolutionPath = _solutionAssetPath;
      if (_imagePath != null &&
          _imagePath!.isNotEmpty &&
          !_imagePath!.startsWith('http://') &&
          !_imagePath!.startsWith('https://')) {
        uploadedImagePath = await QuestionBankApiService.instance.uploadQuestionAsset(
          path: _imagePath!,
          folder: 'question-images',
        );
      }
      if (_solutionAssetPath != null &&
          _solutionAssetPath!.isNotEmpty &&
          !_solutionAssetPath!.startsWith('http://') &&
          !_solutionAssetPath!.startsWith('https://')) {
        uploadedSolutionPath = await QuestionBankApiService.instance.uploadQuestionAsset(
          path: _solutionAssetPath!,
          folder: 'question-solutions',
        );
      }

      if (_isEditMode) {
        final initial = widget.initialQuestion!;
        await QuestionBankStore.instance.updateQuestion(
          initial.copyWith(
            subject: _subject,
            topic: _topicController.text.trim(),
            difficulty: _difficulty,
            type: _type,
            questionText: _questionController.text.trim(),
            teacher: teacherName,
            imagePath: uploadedImagePath,
            options: optionValues,
            correctOptionIndex: _isMultipleChoice ? _correctOptionIndex : null,
            classTargets: _selectedClasses.toList(),
            solutionAssetPath: uploadedSolutionPath,
            solutionAssetType: _solutionAssetType,
            questionSetKey: setKey,
            questionSetTitle: setTitle,
            questionOrder: initial.questionOrder ?? 0,
            revealCorrectAnswerToStudent: _revealCorrectAnswerToStudent,
            expectedAnswer: expectedAnswer,
          ),
        );
      } else {
        await QuestionBankStore.instance.addQuestion(
          subject: _subject,
          topic: _topicController.text.trim(),
          difficulty: _difficulty,
          type: _type,
          questionText: _questionController.text.trim(),
          teacher: teacherName,
          imagePath: uploadedImagePath,
          options: optionValues,
          correctOptionIndex: _isMultipleChoice ? _correctOptionIndex : null,
          classTargets: _selectedClasses.toList(),
          solutionAssetPath: uploadedSolutionPath,
          solutionAssetType: _solutionAssetType,
          questionSetKey: setKey,
          questionSetTitle: setTitle,
          questionOrder: 0,
          revealCorrectAnswerToStudent: _revealCorrectAnswerToStudent,
          expectedAnswer: expectedAnswer,
        );
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _isSaving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
      return;
    }

    if (!mounted) return;
    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        Future<void>.delayed(const Duration(milliseconds: 1800), () {
          if (dialogContext.mounted) {
            Navigator.of(dialogContext).pop();
          }
        });
        return Dialog(
          backgroundColor: Colors.transparent,
          child: Center(
            child: Container(
              constraints: const BoxConstraints(maxWidth: 340),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Theme.of(dialogContext).cardColor,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 58,
                    height: 58,
                    decoration: BoxDecoration(
                      color: const Color(0xFFD1FAE5),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: const Icon(Icons.check_rounded, color: Color(0xFF047857), size: 30),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    _isEditMode ? 'Soru güncellendi' : 'Soru yayınlandı',
                    style: Theme.of(dialogContext).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _isEditMode
                        ? 'Güncellenen soru öğrenci soru bankasında yeni haliyle görünüyor.'
                        : 'Soru artık öğrencilerin soru bankasında görünüyor.',
                    style: Theme.of(dialogContext).textTheme.bodyMedium?.copyWith(height: 1.4),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
    await Future<void>.delayed(const Duration(milliseconds: 1850));
    if (mounted) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final fileName = _imagePath == null ? 'Henüz görsel eklenmedi.' : _imagePath!.split('/').last;
    final solutionFileName =
        _solutionAssetPath == null ? 'Henüz çözüm eki eklenmedi.' : _solutionAssetPath!.split('/').last;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(_isEditMode ? 'Soruyu Düzenle' : 'Soru Oluştur'),
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
                    colors: [Color(0xFF0F172A), Color(0xFF2563EB)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _isEditMode ? 'Soru kaydını güncelleyin' : 'Yeni soru ekleyin',
                      style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Öğrenci soru bankasına düşecek profesyonel soru kaydını hazırlayın.',
                      style: theme.textTheme.titleLarge?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        height: 1.2,
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
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final isWide = constraints.maxWidth >= 720;
                        final children = [
                          SizedBox(
                            width: isWide ? (constraints.maxWidth - 12) / 2 : double.infinity,
                            child: DropdownButtonFormField<String>(
                              initialValue: _subject,
                              decoration: const InputDecoration(labelText: 'Ders'),
                              items: _subjectOptions
                                  .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                                  .toList(),
                              onChanged: (value) => setState(() => _subject = value ?? _subject),
                            ),
                          ),
                          SizedBox(
                            width: isWide ? (constraints.maxWidth - 12) / 2 : double.infinity,
                            child: TextField(
                              controller: _topicController,
                              decoration: const InputDecoration(
                                labelText: 'Konu',
                                hintText: 'Örnek: Parabol, Türev, Organik Kimya',
                              ),
                            ),
                          ),
                        ];
                        return Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: children,
                        );
                      },
                    ),
                    const SizedBox(height: 12),
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final isWide = constraints.maxWidth >= 720;
                        final fieldWidth = isWide ? (constraints.maxWidth - 12) / 2 : double.infinity;
                        return Wrap(
                          spacing: 12,
                          runSpacing: 12,
                          children: [
                            SizedBox(
                              width: fieldWidth,
                              child: DropdownButtonFormField<String>(
                                initialValue: _difficulty,
                                decoration: const InputDecoration(labelText: 'Zorluk'),
                                items: const [
                                  DropdownMenuItem(value: 'Kolay', child: Text('Kolay')),
                                  DropdownMenuItem(value: 'Orta', child: Text('Orta')),
                                  DropdownMenuItem(value: 'Zor', child: Text('Zor')),
                                ],
                                onChanged: (value) => setState(() => _difficulty = value ?? _difficulty),
                              ),
                            ),
                            SizedBox(
                              width: fieldWidth,
                              child: DropdownButtonFormField<String>(
                                initialValue: _type,
                                decoration: const InputDecoration(labelText: 'Soru Tipi'),
                                items: const [
                                  DropdownMenuItem(value: 'Açık Uçlu', child: Text('Açık Uçlu')),
                                  DropdownMenuItem(value: 'Çoktan Seçmeli', child: Text('Çoktan Seçmeli')),
                                  DropdownMenuItem(value: 'Doğru / Yanlış', child: Text('Doğru / Yanlış')),
                                ],
                                onChanged: (value) => setState(() => _type = value ?? _type),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _questionController,
                      maxLines: 7,
                      decoration: const InputDecoration(
                        labelText: 'Soru Metni',
                        hintText: 'Soruyu tam metin olarak yazın.',
                      ),
                    ),
                    if (!_isMultipleChoice && !_isTrueFalse) ...[
                      const SizedBox(height: 12),
                      TextField(
                        controller: _answerKeyController,
                        decoration: const InputDecoration(
                          labelText: 'Cevap Anahtarı',
                          hintText: 'Öğrencinin cevabı bununla karşılaştırılır.',
                        ),
                      ),
                    ],
                    const SizedBox(height: 14),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: theme.scaffoldBackgroundColor,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Hedef Sınıflar',
                            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _availableClassOptions.map((item) {
                              final selected = _selectedClasses.contains(item);
                              return ConstrainedBox(
                                constraints: const BoxConstraints(minHeight: 36),
                                child: FilterChip(
                                  label: Text(
                                    item,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  selected: selected,
                                  onSelected: (value) {
                                    setState(() {
                                      if (item == 'Tüm Sınıflar') {
                                        _selectedClasses
                                          ..clear()
                                          ..add('Tüm Sınıflar');
                                      } else {
                                        _selectedClasses.remove('Tüm Sınıflar');
                                        if (value) {
                                          _selectedClasses.add(item);
                                        } else {
                                          _selectedClasses.remove(item);
                                        }
                                        if (_selectedClasses.isEmpty) {
                                          _selectedClasses.add('Tüm Sınıflar');
                                        }
                                      }
                                    });
                                  },
                                ),
                              );
                            }).toList(),
                          ),
                        ],
                      ),
                    ),
                    if (_isMultipleChoice) ...[
                      const SizedBox(height: 14),
                      _multipleChoiceSection(theme),
                    ],
                    if (_isTrueFalse) ...[
                      const SizedBox(height: 14),
                      _trueFalseSection(theme),
                    ],
                    const SizedBox(height: 14),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: theme.scaffoldBackgroundColor,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Soru Görseli (Opsiyonel)',
                            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 8),
                          Text(fileName, style: theme.textTheme.bodyMedium),
                          const SizedBox(height: 4),
                          Text(
                            'Görsel eklemek zorunlu değil. İstersen boş bırakıp soruyu yayınlayabilirsin.',
                            style: theme.textTheme.bodySmall,
                          ),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              OutlinedButton.icon(
                                onPressed: _pickImage,
                                icon: const Icon(Icons.image_outlined),
                                label: const Text('Görsel Ekle'),
                              ),
                              if (_imagePath != null)
                                OutlinedButton.icon(
                                  onPressed: () => setState(() => _imagePath = null),
                                  icon: const Icon(Icons.delete_outline_rounded),
                                  label: const Text('Kaldır'),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: theme.scaffoldBackgroundColor,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Çözüm Eki',
                            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 8),
                          Text(solutionFileName, style: theme.textTheme.bodyMedium),
                          if (_solutionAssetType != null) ...[
                            const SizedBox(height: 6),
                            Text(
                              'Tür: $_solutionAssetType',
                              style: theme.textTheme.bodySmall,
                            ),
                          ],
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              OutlinedButton.icon(
                                onPressed: _pickSolutionAsset,
                                icon: const Icon(Icons.playlist_add_check_circle_outlined),
                                label: const Text('Çözüm Eki Seç'),
                              ),
                              if (_solutionAssetPath != null)
                                OutlinedButton.icon(
                                  onPressed: () => setState(() {
                                    _solutionAssetPath = null;
                                    _solutionAssetType = null;
                                  }),
                                  icon: const Icon(Icons.delete_outline_rounded),
                                  label: const Text('Kaldır'),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    if (_isMultipleChoice || _isTrueFalse) ...[
                      const SizedBox(height: 14),
                      SwitchListTile.adaptive(
                        contentPadding: EdgeInsets.zero,
                        value: _revealCorrectAnswerToStudent,
                        onChanged: (value) => setState(() => _revealCorrectAnswerToStudent = value),
                        title: const Text('Doğru cevap öğrenciye görünsün'),
                        subtitle: const Text('Kapalıysa doğru seçenek sadece öğretmen detayında görünür.'),
                      ),
                    ],
                    const SizedBox(height: 18),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton.icon(
                        onPressed: _save,
                        icon: const Icon(Icons.publish_rounded),
                        label: Text(
                          _isSaving
                              ? 'Kaydediliyor...'
                              : _isEditMode
                                  ? 'Güncellemeyi Kaydet'
                                  : 'Soru Bankasına Yayınla',
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _multipleChoiceSection(ThemeData theme) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Seçenekler',
            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          RadioGroup<int>(
            groupValue: _correctOptionIndex,
            onChanged: (value) => setState(() => _correctOptionIndex = value ?? 0),
            child: Column(
              children: List.generate(_optionControllers.length, (index) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      Radio<int>(value: index),
                      Expanded(
                        child: TextField(
                          controller: _optionControllers[index],
                          decoration: InputDecoration(
                            labelText: 'Seçenek ${String.fromCharCode(65 + index)}',
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ),
          ),
          Text(
            'Doğru seçeneği soldaki seçimden işaretleyin.',
            style: theme.textTheme.bodySmall,
          ),
        ],
      ),
    );
  }

  Widget _trueFalseSection(ThemeData theme) {
    final current = _answerKeyController.text.trim() == 'Yanlış' ? 'Yanlış' : 'Doğru';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Doğru Cevap',
            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: ['Doğru', 'Yanlış'].map((item) {
              final selected = current == item;
              return ChoiceChip(
                label: Text(item),
                selected: selected,
                onSelected: (_) => setState(() => _answerKeyController.text = item),
              );
            }).toList(),
          ),
          const SizedBox(height: 10),
          Text(
            'Öğrenci bu soru için sadece Doğru veya Yanlış seçer.',
            style: theme.textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
