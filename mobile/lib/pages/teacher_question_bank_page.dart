import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:share_plus/share_plus.dart';
import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';

import '../services/question_bank_store.dart';
import '../services/student_registry_store.dart';
import 'teacher_question_batch_create_page.dart';
import 'teacher_question_create_page.dart';
import 'teacher_question_bank_detail_page.dart';

class TeacherQuestionBankPage extends StatefulWidget {
  const TeacherQuestionBankPage({super.key});

  @override
  State<TeacherQuestionBankPage> createState() => _TeacherQuestionBankPageState();
}

class _TeacherQuestionBankPageState extends State<TeacherQuestionBankPage> {
  final _store = QuestionBankStore.instance;
  final TextEditingController _searchController = TextEditingController();
  String _subjectFilter = 'Tümü';
  String _classFilter = 'Tüm Sınıflar';
  List<String> _subjectOptions = const ['Tümü'];
  List<String> _classOptions = const ['Tüm Sınıflar'];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _store.addListener(_refresh);
    _load();
  }

  @override
  void dispose() {
    _store.removeListener(_refresh);
    _searchController.dispose();
    super.dispose();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      await StudentRegistryStore.instance.ensureLoaded();
      await _store.loadQuestions();
      final subjects = _store.questions
          .map((item) => item.subject.trim())
          .where((item) => item.isNotEmpty)
          .toSet()
          .toList()
        ..sort();
      final classes = StudentRegistryStore.instance.students
          .map((item) => item.className.trim())
          .where((item) => item.isNotEmpty)
          .toSet()
          .toList()
        ..sort();
      _subjectOptions = ['Tümü', ...subjects];
      _classOptions = ['Tüm Sınıflar', ...classes];
      if (!_subjectOptions.contains(_subjectFilter)) {
        _subjectFilter = 'Tümü';
      }
      if (!_classOptions.contains(_classFilter)) {
        _classFilter = 'Tüm Sınıflar';
      }
    } catch (error) {
      _errorMessage = error.toString();
    }
    if (!mounted) return;
    setState(() {
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final questions = _filteredQuestions();
    final questionSets = _groupQuestionSets(questions);
    final monthlyCount = questions.where((item) => item.createdAt.contains('Mart 2026')).length;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F0F14) : const Color(0xFFF3F3F3),

      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: Text(
          "Soru Bankası",
          style: TextStyle(
              color: isDark ? Colors.white : Colors.black,
              fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.file_download),
            tooltip: "Dışa Aktar",
            onPressed: _exportQuestions,
          ),
          IconButton(
            icon: const Icon(Icons.file_upload),
            tooltip: "İçe Aktar",
            onPressed: _importQuestions,
          ),
          IconButton(
            icon: const Icon(Icons.filter_list),
            tooltip: "Filtre",
            onPressed: () {},
          ),
        ],
      ),

      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FloatingActionButton.extended(
            heroTag: 'batch-question-create',
            backgroundColor: const Color(0xFF2563EB),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const TeacherQuestionBatchCreatePage()),
              ).then((_) => _load());
            },
            icon: const Icon(Icons.layers_outlined),
            label: const Text('Soru Seti'),
          ),
          const SizedBox(height: 10),
          FloatingActionButton(
            heroTag: 'single-question-create',
            backgroundColor: Colors.green,
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const TeacherQuestionCreatePage()),
              ).then((_) => _load());
            },
            child: const Icon(Icons.add),
          ),
        ],
      ),

      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [

            /// STATS
            Row(
              children: [
                StatCard('${questions.length}', "Toplam Soru", Icons.quiz, Colors.blue),
                StatCard('$monthlyCount', "Bu Ay Eklenen", Icons.add_circle, Colors.green),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: const [
                StatCard("85%", "Çözüm Oranı", Icons.percent, Colors.purple),
                StatCard("72%", "Ort. Başarı", Icons.emoji_events, Colors.orange),
              ],
            ),

            const SizedBox(height: 16),

            /// SEARCH
            TextField(
              controller: _searchController,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: "Soru veya konu ara...",
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none),
              ),
            ),

            const SizedBox(height: 16),
            SizedBox(
              height: 42,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _subjectOptions.length,
                separatorBuilder: (context, index) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final subject = _subjectOptions[index];
                  final selected = _subjectFilter == subject;
                  final accent = _subjectAccent(subject);
                  return ChoiceChip(
                    label: Text(subject),
                    selected: selected,
                    selectedColor: accent,
                    labelStyle: TextStyle(
                      color: selected ? Colors.white : accent,
                      fontWeight: FontWeight.w700,
                    ),
                    side: BorderSide(color: accent.withValues(alpha: 0.35)),
                    onSelected: (selectedValue) => setState(() => _subjectFilter = subject),
                  );
                },
              ),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _classFilter,
              decoration: const InputDecoration(labelText: 'Sınıf Filtresi'),
              items: _classOptions
                  .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                  .toList(),
              onChanged: (value) => setState(() => _classFilter = value ?? _classFilter),
            ),
            const SizedBox(height: 16),

            const Text("Sorular",
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),

            const SizedBox(height: 10),

            if (_isLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_errorMessage != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Column(
                    children: [
                      Text(_errorMessage!, textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: _load,
                        child: const Text('Tekrar Dene'),
                      ),
                    ],
                  ),
                ),
              )
            else
              ...questionSets.map(
                (item) => questionTile(item),
              ),
          ],
        ),
      ),
    );
  }

  /// QUESTION TILE
  Widget questionTile(_QuestionSetView set) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final lead = set.questions.first;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => TeacherQuestionBankDetailPage(question: lead),
          ),
        ).then((_) => _load());
      },
      child: Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF17181D) : Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.06) : const Color(0xFFE5E7EB),
        ),
        boxShadow: isDark ? [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.18),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ] : [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.05),
            blurRadius: 18,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      set.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isDark ? Colors.white : const Color(0xFF111827),
                        fontWeight: FontWeight.w800,
                        fontSize: 17,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${set.questions.length} soru',
                      style: TextStyle(
                        color: isDark ? Colors.white70 : const Color(0xFF64748B),
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  gradient: const LinearGradient(
                    colors: [Color(0xFF2563EB), Color(0xFF0EA5E9)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                alignment: Alignment.center,
                child: Text(
                  '${set.questions.length}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _questionCover(isDark, lead.subject, set.title, set.questions.length),
        ],
      ),
    ));
  }

  Widget _questionCover(bool isDark, String subject, String title, int questionCount) {
    final accent = _subjectAccent(subject);
    final safeTitle = _decodeSubject(title);
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: SizedBox(
        height: 180,
        width: double.infinity,
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: _subjectGradient(subject),
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Stack(
            children: [
              Positioned(
                left: -18,
                top: -20,
                child: Container(
                  width: 112,
                  height: 112,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              Positioned(
                left: 24,
                top: 22,
                child: Text(
                  _subjectMark(subject),
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.10),
                    fontSize: 54,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -1.6,
                  ),
                ),
              ),
              Positioned(
                right: -24,
                bottom: -26,
                child: Container(
                  width: 148,
                  height: 148,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: isDark ? 0.16 : 0.10),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              Positioned(
                right: 18,
                top: 18,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
                  ),
                  child: Text(
                    '$questionCount soru',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 18,
                right: 18,
                bottom: 18,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.16),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
                      ),
                      child: Icon(_subjectIcon(subject), color: Colors.white),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _decodeSubject(subject),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _subjectTagline(subject),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.78),
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.3,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            safeTitle,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.4,
                              height: 1.05,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      width: 10,
                      height: 56,
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.55),
                        borderRadius: BorderRadius.circular(999),
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

  List<Color> _subjectGradient(String subject) {
    final normalized = _decodeSubject(subject).toLowerCase();
    if (normalized.contains('mat')) return const [Color(0xFF2563EB), Color(0xFF1D4ED8)];
    if (normalized.contains('fiz')) return const [Color(0xFF7C3AED), Color(0xFF5B21B6)];
    if (normalized.contains('kim')) return const [Color(0xFFEA580C), Color(0xFFC2410C)];
    if (normalized.contains('biy')) return const [Color(0xFF16A34A), Color(0xFF15803D)];
    if (normalized.contains('türk') || normalized.contains('turk')) return const [Color(0xFFDC2626), Color(0xFFB91C1C)];
    if (normalized.contains('ing')) return const [Color(0xFF0891B2), Color(0xFF0E7490)];
    return const [Color(0xFF0F766E), Color(0xFF155E75)];
  }

  Color _subjectAccent(String subject) {
    final normalized = _decodeSubject(subject).toLowerCase();
    if (normalized.contains('mat')) return const Color(0xFF2563EB);
    if (normalized.contains('fiz')) return const Color(0xFF7C3AED);
    if (normalized.contains('kim')) return const Color(0xFFEA580C);
    if (normalized.contains('biy')) return const Color(0xFF16A34A);
    if (normalized.contains('türk') || normalized.contains('turk')) return const Color(0xFFDC2626);
    if (normalized.contains('ing')) return const Color(0xFF0891B2);
    return const Color(0xFF0F766E);
  }

  IconData _subjectIcon(String subject) {
    final normalized = _decodeSubject(subject).toLowerCase();
    if (normalized.contains('mat')) return Icons.calculate_rounded;
    if (normalized.contains('fiz')) return Icons.bolt_rounded;
    if (normalized.contains('kim')) return Icons.science_rounded;
    if (normalized.contains('biy')) return Icons.eco_rounded;
    if (normalized.contains('türk') || normalized.contains('turk')) return Icons.menu_book_rounded;
    if (normalized.contains('ing')) return Icons.translate_rounded;
    return Icons.auto_awesome_rounded;
  }

  String _subjectMark(String subject) {
    final normalized = _decodeSubject(subject).toLowerCase();
    if (normalized.contains('mat')) return 'x²';
    if (normalized.contains('fiz')) return 'F';
    if (normalized.contains('kim')) return 'H₂O';
    if (normalized.contains('biy')) return 'DNA';
    if (normalized.contains('türk') || normalized.contains('turk')) return 'Aa';
    if (normalized.contains('ing')) return 'EN';
    return 'QB';
  }

  String _subjectTagline(String subject) {
    final normalized = _decodeSubject(subject).toLowerCase();
    if (normalized.contains('mat')) return 'FORMÜL • PROBLEM • MANTIK';
    if (normalized.contains('fiz')) return 'HAREKET • ENERJİ • KUVVET';
    if (normalized.contains('kim')) return 'TEPKİME • MADDE • BAĞ';
    if (normalized.contains('biy')) return 'CANLI • HÜCRE • SİSTEM';
    if (normalized.contains('türk') || normalized.contains('turk')) return 'DİL • ANLAM • PARAGRAF';
    if (normalized.contains('ing')) return 'VOCAB • GRAMMAR • READING';
    return 'SET • PRATİK • TEKRAR';
  }

  String _decodeSubject(String subject) {
    return subject
        .replaceAll('&#xFC;', 'ü')
        .replaceAll('&#xDC;', 'Ü')
        .replaceAll('&#xE7;', 'ç')
        .replaceAll('&#xC7;', 'Ç')
        .replaceAll('&#x131;', 'ı')
        .replaceAll('&#x130;', 'İ')
        .replaceAll('&#xF6;', 'ö')
        .replaceAll('&#xD6;', 'Ö')
        .replaceAll('&#x15F;', 'ş')
        .replaceAll('&#x15E;', 'Ş')
        .replaceAll('&#x11F;', 'ğ')
        .replaceAll('&#x11E;', 'Ğ')
        .replaceAll('&uuml;', 'ü')
        .replaceAll('&Uuml;', 'Ü')
        .replaceAll('&ccedil;', 'ç')
        .replaceAll('&Ccedil;', 'Ç')
        .replaceAll('&ouml;', 'ö')
        .replaceAll('&Ouml;', 'Ö')
        .replaceAll('&scedil;', 'ş')
        .replaceAll('&Scedil;', 'Ş')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&');
  }

  Future<void> _exportQuestions() async {
    final tempDir = await getTemporaryDirectory();
    final file = File('${tempDir.path}/question-bank-export.json');
    final payload = _filteredQuestions().map((item) => item.toMap()).toList();
    await file.writeAsString(const JsonEncoder.withIndent('  ').convert(payload));
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(file.path)],
        text: 'Soru bankası dışa aktarma',
      ),
    );
  }

  Future<void> _importQuestions() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['json'],
    );
    final file = result?.files.single;
    if (file == null || file.path == null) return;
    final raw = await File(file.path!).readAsString();
    final parsed = jsonDecode(raw) as List<dynamic>;
    for (final item in parsed) {
      final map = Map<String, dynamic>.from(item as Map);
      await _store.addQuestion(
        subject: map['subject'] as String? ?? 'Genel',
        topic: map['topic'] as String? ?? 'Genel',
        difficulty: map['difficulty'] as String? ?? 'Orta',
        type: map['type'] as String? ?? 'Açık Uçlu',
        questionText: map['questionText'] as String? ?? map['question'] as String? ?? '',
        teacher: map['teacher'] as String? ?? 'Ogretmen',
        imagePath: map['imagePath'] as String?,
        options: (map['options'] as List<dynamic>? ?? const []).cast<String>(),
        correctOptionIndex: map['correctOptionIndex'] as int?,
        classTargets: (map['classTargets'] as List<dynamic>? ?? const ['Tüm Sınıflar']).cast<String>(),
        solutionAssetPath: map['solutionAssetPath'] as String?,
        solutionAssetType: map['solutionAssetType'] as String?,
        revealCorrectAnswerToStudent: map['revealCorrectAnswerToStudent'] as bool? ?? false,
        expectedAnswer: map['expectedAnswer'] as String?,
      );
    }
    await _load();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Soru bankası içe aktarıldı.')),
    );
  }

  List<QuestionBankRecord> _filteredQuestions() {
    final query = _searchController.text.trim().toLowerCase();
    return _store.questions.where((item) {
      final subjectMatch = _subjectFilter == 'Tümü' || item.subject == _subjectFilter;
      final classMatch = _classFilter == 'Tüm Sınıflar' ||
          item.classTargets.contains('Tüm Sınıflar') ||
          item.classTargets.contains(_classFilter);
      final searchText =
          '${item.topic} ${item.questionText} ${item.teacher} ${item.classTargets.join(' ')}'
              .toLowerCase();
      final searchMatch = query.isEmpty || searchText.contains(query);
      return subjectMatch && classMatch && searchMatch;
    }).toList();
  }

  List<_QuestionSetView> _groupQuestionSets(List<QuestionBankRecord> items) {
    final groups = <String, List<QuestionBankRecord>>{};
    final sortedItems = [...items]
      ..sort((a, b) {
        final aTime = DateTime.tryParse(a.createdAt) ?? DateTime.fromMillisecondsSinceEpoch(0);
        final bTime = DateTime.tryParse(b.createdAt) ?? DateTime.fromMillisecondsSinceEpoch(0);
        return bTime.compareTo(aTime);
      });

    for (final item in sortedItems) {
      final key = _questionSetKey(item);
      groups.putIfAbsent(key, () => <QuestionBankRecord>[]).add(item);
    }
    return groups.entries.map((entry) {
      final questions = [...entry.value]
        ..sort((a, b) {
          final aOrder = a.questionOrder ?? 9999;
          final bOrder = b.questionOrder ?? 9999;
          if (aOrder != bOrder) return aOrder.compareTo(bOrder);
          final aTime = DateTime.tryParse(a.createdAt) ?? DateTime.fromMillisecondsSinceEpoch(0);
          final bTime = DateTime.tryParse(b.createdAt) ?? DateTime.fromMillisecondsSinceEpoch(0);
          return aTime.compareTo(bTime);
        });
      return _QuestionSetView(
        key: entry.key,
        title: questions.first.questionSetTitle ?? questions.first.topic,
        questions: questions,
      );
    }).toList()
      ..sort((a, b) {
        final aTime = DateTime.tryParse(a.questions.first.createdAt) ?? DateTime.fromMillisecondsSinceEpoch(0);
        final bTime = DateTime.tryParse(b.questions.first.createdAt) ?? DateTime.fromMillisecondsSinceEpoch(0);
        return bTime.compareTo(aTime);
      });
  }

  String _questionSetKey(QuestionBankRecord item) {
    if (item.questionSetKey != null && item.questionSetKey!.isNotEmpty) {
      return item.questionSetKey!;
    }
    final createdAt = DateTime.tryParse(item.createdAt);
    final bucket = createdAt == null
        ? item.createdAt
        : '${createdAt.year}-${createdAt.month.toString().padLeft(2, '0')}-${createdAt.day.toString().padLeft(2, '0')} ${createdAt.hour.toString().padLeft(2, '0')}:${(createdAt.minute ~/ 10).toString()}';
    final classes = [...item.classTargets]..sort();
    return '${item.teacher}|${item.subject}|${item.topic}|$bucket|${classes.join(",")}';
  }
}

class _QuestionSetView {
  final String key;
  final String title;
  final List<QuestionBankRecord> questions;

  const _QuestionSetView({
    required this.key,
    required this.title,
    required this.questions,
  });
}

/// STAT CARD
class StatCard extends StatelessWidget {
  final String value;
  final String label;
  final IconData icon;
  final Color color;

  const StatCard(this.value, this.label, this.icon, this.color, {super.key});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF1E1E1E),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Icon(icon, color: color),
            const SizedBox(height: 6),
            Text(value,
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold)),
            Text(label,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70)),
          ],
        ),
      ),
    );
  }
}
