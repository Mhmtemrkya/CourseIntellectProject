import 'dart:convert';
import 'dart:io';
import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../services/auth_session_store.dart';
import '../services/api_config.dart';
import '../services/planned_exam_api_service.dart';
import '../services/question_bank_api_service.dart';
import '../services/question_bank_store.dart';
import '../services/uploads_api_service.dart';
import '../widgets/solution_drawing_canvas.dart';

class TeacherQuestionStudioPage extends StatefulWidget {
  final bool examMode;

  const TeacherQuestionStudioPage({super.key, this.examMode = false});

  @override
  State<TeacherQuestionStudioPage> createState() =>
      _TeacherQuestionStudioPageState();
}

class _TeacherQuestionStudioPageState extends State<TeacherQuestionStudioPage> {
  final _questionController = TextEditingController();
  final _solutionController = TextEditingController();
  final _expectedAnswerController = TextEditingController();
  final _topicController = TextEditingController();
  final _tagController = TextEditingController();
  final _examTitleController = TextEditingController();
  final _examClassController = TextEditingController();
  final _examDateController = TextEditingController();
  final List<TextEditingController> _optionControllers = [
    TextEditingController(),
    TextEditingController(),
    TextEditingController(),
    TextEditingController(),
  ];
  final List<String?> _optionImagePaths = [null, null, null, null];
  String _subject = 'Matematik';
  String _difficulty = 'Orta';
  String _type = 'Çoktan Seçmeli';
  String _classLevel = 'Tüm Sınıflar';
  int _correctIndex = 0;
  bool _saving = false;
  String? _imagePath;
  String? _solutionAssetPath;
  final List<QuestionBankRecord> _examQuestions = [];
  String _autosave = 'Canlı kayda hazır';
  String? _draftId;
  Timer? _autosaveTimer;

  bool get _usesOptions => {'Çoktan Seçmeli', 'Doğru / Yanlış'}.contains(_type);

  List<MapEntry<int, TextEditingController>> _filledOptionEntries() {
    final entries = <MapEntry<int, TextEditingController>>[];
    for (var index = 0; index < _optionControllers.length; index++) {
      if (_optionControllers[index].text.trim().isNotEmpty) {
        entries.add(MapEntry(index, _optionControllers[index]));
      }
    }
    return entries;
  }

  int _correctFilteredIndex(
    List<MapEntry<int, TextEditingController>> entries,
  ) {
    return entries.indexWhere((entry) => entry.key == _correctIndex);
  }

  Map<String, dynamic> _editorMetadata(
    List<MapEntry<int, TextEditingController>> entries,
  ) {
    return {
      'source': 'mobile-question-studio',
      'tags': _tagController.text
          .split(',')
          .map((item) => item.trim())
          .where((item) => item.isNotEmpty)
          .toList(),
      'optionAssets': [
        for (var index = 0; index < entries.length; index++)
          {
            'index': index,
            'originalIndex': entries[index].key,
            'imagePath': _optionImagePaths.length > entries[index].key
                ? _optionImagePaths[entries[index].key]
                : null,
          },
      ],
      'savedAt': DateTime.now().toUtc().toIso8601String(),
    };
  }

  Map<String, dynamic> _draftPayload() {
    final entries = _filledOptionEntries();
    return {
      'type': _type,
      'subject': _subject,
      'difficulty': _difficulty,
      'classLevel': _classLevel,
      'topic': _topicController.text,
      'questionText': _questionController.text,
      'solutionText': _solutionController.text,
      'expectedAnswer': _expectedAnswerController.text,
      'imagePath': _imagePath,
      'solutionAssetPath': _solutionAssetPath,
      'options': [
        for (final entry in entries)
          {
            'text': entry.value.text,
            'correct': entry.key == _correctIndex,
            'imagePath': _optionImagePaths.length > entry.key
                ? _optionImagePaths[entry.key]
                : null,
          },
      ],
      'examMode': widget.examMode,
      'examTitle': _examTitleController.text,
      'examClass': _examClassController.text,
      'examDate': _examDateController.text,
      'examQuestionIds': _examQuestions.map((item) => item.id).toList(),
    };
  }

  void _scheduleDraftSave() {
    _autosaveTimer?.cancel();
    if (!mounted) return;
    setState(() => _autosave = 'Taslak kaydediliyor...');
    _autosaveTimer = Timer(const Duration(milliseconds: 900), _saveDraft);
  }

  Future<void> _saveDraft() async {
    if (!mounted) return;
    try {
      final draft = await QuestionBankApiService.instance.saveStudioDraft(
        id: _draftId,
        title: _questionController.text.trim().isEmpty
            ? widget.examMode
                  ? _examTitleController.text.trim()
                  : 'Mobil Soru Taslağı'
            : _questionController.text.trim(),
        mode: widget.examMode ? 'MockExam' : 'QuestionBank',
        payload: _draftPayload(),
      );
      if (!mounted) return;
      setState(() {
        _draftId = draft.id;
        _autosave = 'Canlı taslak kaydedildi';
      });
    } catch (_) {
      if (mounted) setState(() => _autosave = 'Taslak daha sonra kaydedilecek');
    }
  }

  @override
  void initState() {
    super.initState();
    _questionController.addListener(_scheduleDraftSave);
    _solutionController.addListener(_scheduleDraftSave);
    _expectedAnswerController.addListener(_scheduleDraftSave);
    _topicController.addListener(_scheduleDraftSave);
    _tagController.addListener(_scheduleDraftSave);
    _examTitleController.addListener(_scheduleDraftSave);
    _examClassController.addListener(_scheduleDraftSave);
    _examDateController.addListener(_scheduleDraftSave);
    for (final controller in _optionControllers) {
      controller.addListener(_scheduleDraftSave);
    }
  }

  @override
  void dispose() {
    _autosaveTimer?.cancel();
    _questionController.dispose();
    _solutionController.dispose();
    _expectedAnswerController.dispose();
    _topicController.dispose();
    _tagController.dispose();
    _examTitleController.dispose();
    _examClassController.dispose();
    _examDateController.dispose();
    for (final controller in _optionControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _saveQuestion() async {
    final text = _questionController.text.trim();
    if (text.isEmpty || _topicController.text.trim().isEmpty) {
      _snack('Soru metni ve konu zorunlu.');
      return;
    }
    if (!_usesOptions && _expectedAnswerController.text.trim().isEmpty) {
      _snack('Açık yanıtlı sorularda beklenen cevap zorunlu.');
      return;
    }
    final filledOptionEntries = _filledOptionEntries();
    final correctFilteredIndex = _correctFilteredIndex(filledOptionEntries);
    if (_usesOptions) {
      if (filledOptionEntries.length < 2) {
        _snack('Seçenekli sorularda en az iki şık zorunlu.');
        return;
      }
      if (correctFilteredIndex < 0) {
        _snack('Doğru cevap olarak işaretlenen şık boş olamaz.');
        return;
      }
    }

    setState(() => _saving = true);
    try {
      final session = await AuthSessionStore.instance.load();
      final created = await QuestionBankStore.instance.addQuestion(
        subject: _subject,
        topic: _topicController.text.trim(),
        difficulty: _difficulty,
        type: _type,
        questionText: text,
        teacher: session?.fullName ?? 'Öğretmen',
        imagePath: _imagePath,
        options: _usesOptions
            ? filledOptionEntries
                  .map((entry) => entry.value.text.trim())
                  .toList()
            : const [],
        correctOptionIndex: _usesOptions ? correctFilteredIndex : null,
        classTargets: [_classLevel],
        solutionAssetPath: _solutionAssetPath,
        solutionAssetType: _solutionAssetPath == null ? null : 'studio-asset',
        expectedAnswer: _usesOptions
            ? null
            : _expectedAnswerController.text.trim(),
        questionSetTitle: _topicController.text.trim(),
        revealCorrectAnswerToStudent: true,
        imagePlacement: _imagePath == null ? 'None' : 'Top',
        richTextHtml: text,
        solutionTextHtml: _solutionController.text.trim().isEmpty
            ? null
            : _solutionController.text.trim(),
        editorMetadataJson: jsonEncode(_editorMetadata(filledOptionEntries)),
        publicationStatus: 'Published',
      );
      if (!mounted) return;
      if (widget.examMode) {
        setState(() {
          _examQuestions.add(created);
          _questionController.clear();
          _solutionController.clear();
          _expectedAnswerController.clear();
          for (final controller in _optionControllers) {
            controller.clear();
          }
          for (var index = 0; index < _optionImagePaths.length; index++) {
            _optionImagePaths[index] = null;
          }
          _imagePath = null;
          _solutionAssetPath = null;
          _autosave = '${_examQuestions.length} soru denemeye eklendi';
        });
        _snack('Soru canlı olarak denemeye eklendi.');
      } else {
        _snack('Soru bankasına kaydedildi.');
        Navigator.pop(context);
      }
    } catch (error) {
      _snack(error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickAsset({required bool solution}) async {
    final result = await FilePicker.platform.pickFiles(
      type: solution ? FileType.any : FileType.image,
    );
    final path = result?.files.single.path;
    if (path == null) return;
    setState(() => _saving = true);
    try {
      final uploaded = await UploadsApiService.instance.uploadFile(
        file: File(path),
        folder: solution
            ? 'question-studio/solutions'
            : 'question-studio/images',
      );
      setState(() {
        if (solution) {
          _solutionAssetPath = uploaded.fileUrl;
        } else {
          _imagePath = uploaded.fileUrl;
        }
        _autosave = 'Dosya canlı depolamaya yüklendi';
      });
      _scheduleDraftSave();
    } catch (error) {
      _snack(error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickOptionAsset(int index) async {
    final result = await FilePicker.platform.pickFiles(type: FileType.image);
    final path = result?.files.single.path;
    if (path == null) return;
    setState(() => _saving = true);
    try {
      final uploaded = await UploadsApiService.instance.uploadFile(
        file: File(path),
        folder: 'question-studio/options',
      );
      setState(() {
        while (_optionImagePaths.length <= index) {
          _optionImagePaths.add(null);
        }
        _optionImagePaths[index] = uploaded.fileUrl;
        _autosave = 'Şık görseli canlı depolamaya yüklendi';
      });
      _scheduleDraftSave();
    } catch (error) {
      _snack(error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _saveCanvasSnapshot(String dataUrl) async {
    try {
      final encoded = dataUrl.split(',').last;
      final uploaded = await UploadsApiService.instance.uploadBytes(
        bytes: base64Decode(encoded),
        fileName: 'cozum-${DateTime.now().millisecondsSinceEpoch}.png',
        folder: 'question-studio/solutions',
        contentType: 'image/png',
      );
      if (!mounted) return;
      setState(() {
        _solutionAssetPath = uploaded.fileUrl;
        _autosave = 'Çizim canlı depolamaya kaydedildi';
      });
      _scheduleDraftSave();
    } catch (error) {
      if (mounted) _snack(error.toString());
    }
  }

  Future<void> _publishExam() async {
    if (_examTitleController.text.trim().isEmpty ||
        _examClassController.text.trim().isEmpty ||
        _examDateController.text.trim().isEmpty ||
        _examQuestions.isEmpty) {
      _snack('Deneme adı, sınıf, tarih ve en az bir soru zorunlu.');
      return;
    }
    setState(() => _saving = true);
    try {
      final session = await AuthSessionStore.instance.load();
      await PlannedExamApiService.instance.createPlannedExam({
        'title': _examTitleController.text.trim(),
        'type': 'MockExam',
        'className': _examClassController.text.trim(),
        'subject': _subject,
        'dateLabel': _examDateController.text.trim(),
        'duration': '40 dk',
        'questionCount': _examQuestions.length,
        'teacherName': session?.fullName ?? 'Öğretmen',
        'sourceType': 'Soru Bankası',
        'sources': _examQuestions
            .map(
              (item) => {
                'questionId': item.id,
                'title': item.questionText,
                'type': item.type,
                'subject': item.subject,
                'imagePath': item.imagePath,
                'imagePlacement': 'Top',
              },
            )
            .toList(),
      });
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (error) {
      _snack(error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _showPreview() {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Soru Önizleme'),
        content: SizedBox(
          width: 560,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _questionController.text.trim().isEmpty
                      ? 'Soru metni henüz yazılmadı.'
                      : _questionController.text,
                ),
                if (_imagePath != null) ...[
                  const SizedBox(height: 16),
                  Image.network(
                    _imagePath!,
                    errorBuilder: (context, error, stackTrace) =>
                        const Text('Görsel yüklenemedi.'),
                  ),
                ],
                if (_usesOptions) ...[
                  const SizedBox(height: 16),
                  ...List.generate(
                    _optionControllers.length,
                    (index) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              '${String.fromCharCode(65 + index)}) ${_optionControllers[index].text}',
                            ),
                          ),
                          if (_optionImagePaths.length > index &&
                              (_optionImagePaths[index] ?? '').isNotEmpty)
                            ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: Image.network(
                                ApiConfig.resolveAssetUrl(
                                  _optionImagePaths[index],
                                ),
                                width: 52,
                                height: 52,
                                fit: BoxFit.cover,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
                if (_solutionController.text.trim().isNotEmpty) ...[
                  const Divider(height: 28),
                  const Text(
                    'Çözüm',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  Text(_solutionController.text),
                ],
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Kapat'),
          ),
        ],
      ),
    );
  }

  void _addOption() {
    final controller = TextEditingController()..addListener(_scheduleDraftSave);
    setState(() {
      _optionControllers.add(controller);
      _optionImagePaths.add(null);
    });
    _scheduleDraftSave();
  }

  void _removeOption(int index) {
    if (_optionControllers.length <= 2) return;
    setState(() {
      _optionControllers.removeAt(index).dispose();
      if (_optionImagePaths.length > index) {
        _optionImagePaths.removeAt(index);
      }
      if (_correctIndex >= _optionControllers.length) _correctIndex = 0;
    });
    _scheduleDraftSave();
  }

  void _changeQuestionType(String type) {
    setState(() {
      final wasTrueFalse = _type == 'Doğru / Yanlış';
      _type = type;
      if (type == 'Doğru / Yanlış') {
        while (_optionControllers.length < 2) {
          _optionControllers.add(
            TextEditingController()..addListener(_scheduleDraftSave),
          );
          _optionImagePaths.add(null);
        }
        _optionControllers[0].text = 'Doğru';
        _optionControllers[1].text = 'Yanlış';
        for (var index = 2; index < _optionControllers.length; index++) {
          _optionControllers[index].clear();
          if (_optionImagePaths.length > index) _optionImagePaths[index] = null;
        }
        _correctIndex = 0;
      } else if (wasTrueFalse) {
        for (final controller in _optionControllers) {
          controller.clear();
        }
        for (var index = 0; index < _optionImagePaths.length; index++) {
          _optionImagePaths[index] = null;
        }
        _correctIndex = 0;
      }
    });
    _scheduleDraftSave();
  }

  void _snack(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final isTablet = width >= 820;

    return Theme(
      data: Theme.of(context).copyWith(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF050B16),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFFF8A1C),
          secondary: Color(0xFF7C3AED),
          surface: Color(0xFF081426),
        ),
      ),
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            widget.examMode ? 'Deneme Sınavları' : 'Soru Bankası',
            style: const TextStyle(fontWeight: FontWeight.w900),
          ),
          actions: [
            IconButton(
              tooltip: 'Önizleme',
              onPressed: _showPreview,
              icon: const Icon(Icons.visibility_outlined),
            ),
            TextButton.icon(
              onPressed: _saving ? null : _saveQuestion,
              icon: _saving
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.check_rounded),
              label: const Text('Kaydet'),
            ),
            const SizedBox(width: 8),
          ],
        ),
        body: SafeArea(
          child: isTablet
              ? Row(
                  children: [
                    Expanded(flex: 3, child: _editorPane()),
                    SizedBox(width: 350, child: _settingsPane()),
                  ],
                )
              : DefaultTabController(
                  length: 3,
                  child: Column(
                    children: [
                      const TabBar(
                        tabs: [
                          Tab(text: 'Editör'),
                          Tab(text: 'Ayarlar'),
                          Tab(text: 'Çizim'),
                        ],
                      ),
                      Expanded(
                        child: TabBarView(
                          children: [
                            _editorPane(),
                            _settingsPane(),
                            Padding(
                              padding: const EdgeInsets.all(16),
                              child: SolutionDrawingCanvas(
                                onStrokeSaved: (_) =>
                                    setState(() => _autosave = 'Stroke hazır'),
                                onSnapshotSaved: _saveCanvasSnapshot,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
        ),
      ),
    );
  }

  Widget _editorPane() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (widget.examMode) ...[
          _GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Deneme Sınavı Oluştur',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: _saving ? null : _publishExam,
                      icon: const Icon(Icons.publish_rounded),
                      label: const Text('Yayınla'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _examTitleController,
                  decoration: _input('Deneme adı'),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _examClassController,
                        decoration: _input('Sınıf'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: _examDateController,
                        decoration: _input('Tarih'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  '${_examQuestions.length} soru canlı olarak sınava eklendi',
                  style: const TextStyle(color: Color(0xFFFFC08A)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
        ],
        _GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.examMode
                    ? 'Deneme İçin Soru Oluştur'
                    : 'Yeni Soru Oluştur',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Rich editor, seçenek yönetimi, çözüm ve çizim tek akışta.',
                style: TextStyle(color: Colors.white60),
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children:
                    [
                      'Çoktan Seçmeli',
                      'Açık Uçlu',
                      'Doğru / Yanlış',
                      'Boşluk Doldurma',
                      'Grafik Yorumlama',
                      'Kod Sorusu',
                      'Matematik Sorusu',
                    ].map((item) {
                      return ChoiceChip(
                        selected: _type == item,
                        label: Text(item),
                        onSelected: (_) => _changeQuestionType(item),
                      );
                    }).toList(),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _questionController,
                minLines: 8,
                maxLines: 14,
                decoration: _input('Soru metni, LaTeX veya açıklama yaz...'),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  OutlinedButton.icon(
                    onPressed: _saving
                        ? null
                        : () => _pickAsset(solution: false),
                    icon: const Icon(Icons.add_photo_alternate_outlined),
                    label: const Text('Görsel Yükle'),
                  ),
                  if (_imagePath != null) ...[
                    const SizedBox(width: 8),
                    IconButton(
                      onPressed: () {
                        setState(() => _imagePath = null);
                        _scheduleDraftSave();
                      },
                      icon: const Icon(Icons.delete_outline_rounded),
                    ),
                  ],
                ],
              ),
              if (_imagePath != null) ...[
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: Image.network(
                    _imagePath!,
                    height: 180,
                    width: double.infinity,
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stackTrace) =>
                        const Text('Görsel gösterilemedi.'),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 14),
        if (_usesOptions)
          _GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Seçenekler',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    TextButton.icon(
                      onPressed: _addOption,
                      icon: const Icon(Icons.add_rounded),
                      label: const Text('Ekle'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ...List.generate(_optionControllers.length, (index) {
                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: _correctIndex == index
                          ? const Color(0xFF10B981).withValues(alpha: 0.12)
                          : Colors.white.withValues(alpha: 0.04),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: _correctIndex == index
                            ? const Color(0xFF10B981)
                            : Colors.white.withValues(alpha: 0.08),
                      ),
                    ),
                    child: Row(
                      children: [
                        IconButton(
                          onPressed: () {
                            setState(() => _correctIndex = index);
                            _scheduleDraftSave();
                          },
                          icon: CircleAvatar(
                            radius: 16,
                            backgroundColor: _correctIndex == index
                                ? const Color(0xFF10B981)
                                : Colors.white10,
                            child: Text(String.fromCharCode(65 + index)),
                          ),
                        ),
                        Expanded(
                          child: TextField(
                            controller: _optionControllers[index],
                            decoration: _input('Seçenek metni'),
                          ),
                        ),
                        if (_optionImagePaths.length > index &&
                            (_optionImagePaths[index] ?? '').isNotEmpty) ...[
                          const SizedBox(width: 8),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.network(
                              ApiConfig.resolveAssetUrl(
                                _optionImagePaths[index],
                              ),
                              width: 44,
                              height: 44,
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) =>
                                  const Icon(Icons.broken_image_outlined),
                            ),
                          ),
                        ],
                        IconButton(
                          tooltip: 'Şık görseli',
                          onPressed: _saving
                              ? null
                              : () => _pickOptionAsset(index),
                          icon: const Icon(Icons.image_outlined),
                        ),
                        IconButton(
                          onPressed: () => _removeOption(index),
                          icon: const Icon(Icons.delete_outline_rounded),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),
        const SizedBox(height: 14),
        _GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Çözüm',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _solutionController,
                minLines: 5,
                maxLines: 10,
                decoration: _input(
                  'Detaylı çözüm, video notu veya ipucu yaz...',
                ),
              ),
              if (!_usesOptions) ...[
                const SizedBox(height: 12),
                TextField(
                  controller: _expectedAnswerController,
                  decoration: _input(
                    'Değerlendirmede kullanılacak kısa doğru cevap',
                  ),
                ),
              ],
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: _saving ? null : () => _pickAsset(solution: true),
                icon: const Icon(Icons.attach_file_rounded),
                label: Text(
                  _solutionAssetPath == null
                      ? 'Çözüm Dosyası Yükle'
                      : 'Çözüm Dosyası Yüklendi',
                ),
              ),
              const SizedBox(height: 10),
              Text(
                _autosave,
                style: const TextStyle(color: Color(0xFFFFC08A), fontSize: 12),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _settingsPane() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Soru Ayarları',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 16),
              _dropdown(
                'Ders',
                _subject,
                [
                  'Matematik',
                  'Türkçe',
                  'Fizik',
                  'Kimya',
                  'Biyoloji',
                  'İngilizce',
                ],
                (v) {
                  setState(() => _subject = v);
                  _scheduleDraftSave();
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _topicController,
                decoration: _input('Konu'),
              ),
              const SizedBox(height: 12),
              _dropdown('Zorluk', _difficulty, ['Kolay', 'Orta', 'Zor'], (v) {
                setState(() => _difficulty = v);
                _scheduleDraftSave();
              }),
              const SizedBox(height: 12),
              _dropdown(
                'Sınıf',
                _classLevel,
                [
                  'Tüm Sınıflar',
                  '9. Sınıf',
                  '10. Sınıf',
                  '11. Sınıf',
                  '12. Sınıf',
                ],
                (v) {
                  setState(() => _classLevel = v);
                  _scheduleDraftSave();
                },
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _tagController,
                decoration: _input('Etiketler'),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: _saveQuestion,
                icon: _saving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_rounded),
                label: const Text('Soruyu Kaydet'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  InputDecoration _input(String label) {
    return InputDecoration(
      labelText: label,
      filled: true,
      fillColor: Colors.white.withValues(alpha: 0.05),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
      ),
    );
  }

  Widget _dropdown(
    String label,
    String value,
    List<String> items,
    ValueChanged<String> onChanged,
  ) {
    return DropdownButtonFormField<String>(
      initialValue: value,
      decoration: _input(label),
      items: items
          .map((item) => DropdownMenuItem(value: item, child: Text(item)))
          .toList(),
      onChanged: (value) {
        if (value != null) onChanged(value);
      },
    );
  }
}

class _GlassCard extends StatelessWidget {
  final Widget child;

  const _GlassCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.white.withValues(alpha: 0.075),
            Colors.white.withValues(alpha: 0.035),
          ],
        ),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 28,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: child,
    );
  }
}
