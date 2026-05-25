import 'package:flutter/material.dart';

import '../services/auth_session_store.dart';
import '../services/question_bank_store.dart';
import '../widgets/solution_drawing_canvas.dart';

class TeacherQuestionStudioPage extends StatefulWidget {
  const TeacherQuestionStudioPage({super.key});

  @override
  State<TeacherQuestionStudioPage> createState() =>
      _TeacherQuestionStudioPageState();
}

class _TeacherQuestionStudioPageState extends State<TeacherQuestionStudioPage> {
  final _questionController = TextEditingController(
    text:
        'Aşağıdaki şekilde f(x) = x² - 4 fonksiyonunun grafiği verilmiştir. Buna göre fonksiyonun sıfırları hangisidir?',
  );
  final _solutionController = TextEditingController(
    text:
        'x² - 4 = 0 denklemi (x - 2)(x + 2) = 0 olarak çarpanlara ayrılır. Kökler -2 ve 2 olur.',
  );
  final _topicController = TextEditingController(
    text: '2. Dereceden Denklemler',
  );
  final _tagController = TextEditingController(text: 'fonksiyonlar, parabol');
  final List<TextEditingController> _optionControllers = [
    TextEditingController(text: 'x = -2 ve x = 2'),
    TextEditingController(text: 'x = -4 ve x = 4'),
    TextEditingController(text: 'x = -2 ve x = 4'),
    TextEditingController(text: 'x = -4 ve x = 2'),
  ];
  String _subject = 'Matematik';
  String _difficulty = 'Orta';
  String _type = 'Çoktan Seçmeli';
  String _classLevel = '10. Sınıf';
  int _correctIndex = 0;
  bool _saving = false;
  String _autosave = 'Taslak hazır';

  @override
  void dispose() {
    _questionController.dispose();
    _solutionController.dispose();
    _topicController.dispose();
    _tagController.dispose();
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

    setState(() => _saving = true);
    try {
      final session = await AuthSessionStore.instance.load();
      await QuestionBankStore.instance.addQuestion(
        subject: _subject,
        topic: _topicController.text.trim(),
        difficulty: _difficulty,
        type: _type,
        questionText: text,
        teacher: session?.fullName ?? 'Öğretmen',
        options: _type == 'Çoktan Seçmeli'
            ? _optionControllers
                  .map((item) => item.text.trim())
                  .where((item) => item.isNotEmpty)
                  .toList()
            : const [],
        correctOptionIndex: _type == 'Çoktan Seçmeli' ? _correctIndex : null,
        classTargets: [_classLevel],
        expectedAnswer: _type == 'Çoktan Seçmeli'
            ? null
            : _solutionController.text.trim(),
        questionSetTitle: _topicController.text.trim(),
        revealCorrectAnswerToStudent: true,
      );
      if (!mounted) return;
      _snack('Soru bankasına kaydedildi.');
      Navigator.pop(context);
    } catch (error) {
      _snack(error.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _addOption() {
    setState(() => _optionControllers.add(TextEditingController()));
  }

  void _removeOption(int index) {
    if (_optionControllers.length <= 2) return;
    setState(() {
      _optionControllers.removeAt(index).dispose();
      if (_correctIndex >= _optionControllers.length) _correctIndex = 0;
    });
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
          title: const Text(
            'Soru Stüdyosu',
            style: TextStyle(fontWeight: FontWeight.w900),
          ),
          actions: [
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
                    SizedBox(width: 240, child: _leftRail()),
                    Expanded(flex: 2, child: _editorPane()),
                    SizedBox(width: 330, child: _settingsPane()),
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
                                onSnapshotSaved: (_) => setState(
                                  () => _autosave = 'Çizim snapshot hazır',
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
      ),
    );
  }

  Widget _leftRail() {
    final items = [
      [Icons.dashboard_outlined, 'Dashboard'],
      [Icons.quiz_outlined, 'Soru Bankam'],
      [Icons.description_outlined, 'Deneme Sınavları'],
      [Icons.analytics_outlined, 'Analizler'],
      [Icons.auto_awesome_rounded, 'AI Araçları'],
    ];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF07111F),
        border: Border(
          right: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _StudioLogo(),
          const SizedBox(height: 28),
          ...items.map((item) {
            final active = item[1] == 'Soru Bankam';
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: active
                    ? const Color(0xFFFF8A1C).withValues(alpha: 0.14)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(18),
                border: active
                    ? Border.all(
                        color: const Color(0xFFFF8A1C).withValues(alpha: 0.35),
                      )
                    : null,
              ),
              child: ListTile(
                leading: Icon(item[0] as IconData),
                title: Text(
                  item[1] as String,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                textColor: active ? const Color(0xFFFFC08A) : Colors.white70,
                iconColor: active ? const Color(0xFFFF8A1C) : Colors.white70,
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _editorPane() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Yeni Soru Oluştur',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900),
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
                      'AI Destekli Soru',
                    ].map((item) {
                      return ChoiceChip(
                        selected: _type == item,
                        label: Text(item),
                        onSelected: (_) => setState(() => _type = item),
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
            ],
          ),
        ),
        const SizedBox(height: 14),
        if (_type == 'Çoktan Seçmeli')
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
                          onPressed: () =>
                              setState(() => _correctIndex = index),
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
              _dropdown('Ders', _subject, [
                'Matematik',
                'Türkçe',
                'Fizik',
                'Kimya',
                'Biyoloji',
                'İngilizce',
              ], (v) => setState(() => _subject = v)),
              const SizedBox(height: 12),
              TextField(
                controller: _topicController,
                decoration: _input('Konu'),
              ),
              const SizedBox(height: 12),
              _dropdown('Zorluk', _difficulty, [
                'Kolay',
                'Orta',
                'Zor',
              ], (v) => setState(() => _difficulty = v)),
              const SizedBox(height: 12),
              _dropdown('Sınıf', _classLevel, [
                'Tüm Sınıflar',
                '9. Sınıf',
                '10. Sınıf',
                '11. Sınıf',
                '12. Sınıf',
              ], (v) => setState(() => _classLevel = v)),
              const SizedBox(height: 12),
              TextField(
                controller: _tagController,
                decoration: _input('Etiketler'),
              ),
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: () {
                  setState(() {
                    _questionController.text =
                        '${_topicController.text} kazanımını ölçen $_difficulty seviyede bir soru oluşturuldu. Aşağıdaki seçeneklerden hangisi doğrudur?';
                    _solutionController.text =
                        'Önce kazanımı belirle, sonra verilen bilgiyi adım adım uygula. Doğru seçenek kavramı eksiksiz karşılayan ifadedir.';
                    _autosave = 'AI önerisi editöre aktarıldı';
                  });
                },
                icon: const Icon(Icons.auto_awesome_rounded),
                label: const Text('AI ile İyileştir'),
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

class _StudioLogo extends StatelessWidget {
  const _StudioLogo();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFFFA233), Color(0xFFF97316)],
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Icon(Icons.school_rounded, color: Colors.white),
        ),
        const SizedBox(width: 12),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Course Intellect',
                style: TextStyle(fontWeight: FontWeight.w900),
              ),
              Text(
                'Öğretmen Paneli',
                style: TextStyle(color: Colors.white54, fontSize: 12),
              ),
            ],
          ),
        ),
      ],
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
