import 'package:flutter/material.dart';
import '../services/linked_children_service.dart';
import '../services/question_bank_store.dart';
import '../widgets/responsive_layout.dart';
import 'student_question_bank_detail_page.dart';

class QuestionBankPage extends StatefulWidget {
  const QuestionBankPage({super.key});

  @override
  State<QuestionBankPage> createState() => _QuestionBankPageState();
}

class _QuestionBankPageState extends State<QuestionBankPage>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> fadeAnim;
  late Animation<Offset> slideAnim;

  int selectedTab = 0;
  List<String> tabs = const ["Tümü"];
  final _store = QuestionBankStore.instance;
  final TextEditingController _searchController = TextEditingController();
  String _studentClass = '';
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    fadeAnim = Tween<double>(begin: 0, end: 1).animate(_controller);
    slideAnim = Tween<Offset>(
      begin: const Offset(0, 0.1),
      end: Offset.zero,
    ).animate(_controller);
    _controller.forward();
    _store.addListener(_refresh);
    _load();
  }

  @override
  void dispose() {
    _store.removeListener(_refresh);
    _searchController.dispose();
    _controller.dispose();
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
      final linkedChildren = await LinkedChildrenService.instance
          .loadLinkedChildren();
      _studentClass = linkedChildren.isNotEmpty
          ? linkedChildren.first.className
          : '';
      await _store.loadQuestions(className: _studentClass);
      final subjects =
          _store.questions
              .map((item) => item.subject.trim())
              .where((item) => item.isNotEmpty)
              .toSet()
              .toList()
            ..sort();
      tabs = ['Tümü', ...subjects];
      if (selectedTab >= tabs.length) {
        selectedTab = 0;
      }
    } catch (error) {
      _errorMessage = error.toString();
    }
    if (!mounted) return;
    setState(() {
      _isLoading = false;
    });
  }

  bool isDark(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark;

  @override
  Widget build(BuildContext context) {
    final topics = _groupedQuestions();
    return Scaffold(
      appBar: AppBar(
        title: const Text("Soru Bankası"),
        actions: const [Icon(Icons.search), SizedBox(width: 12)],
      ),
      body: FadeTransition(
        opacity: fadeAnim,
        child: SlideTransition(
          position: slideAnim,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: ResponsiveContent(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  summaryCards(),
                  const SizedBox(height: 16),
                  searchBox(),
                  const SizedBox(height: 12),
                  tabBar(),
                  const SizedBox(height: 16),
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
                    ...topics.map((item) => topicQuestionCard(item)),
                  const SizedBox(height: 20),
                  challengeCard(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// SUMMARY
  Widget summaryCards() {
    final cards = [
      summaryCard(
        "${_store.questions.length}",
        "Toplam Soru",
        Icons.lightbulb,
        Colors.orange,
      ),
      summaryCard(
        "${_store.questions.where((e) => e.imagePath != null).length}",
        "Resimli Soru",
        Icons.image,
        Colors.green,
      ),
      summaryCard(
        "${_groupedQuestions().length}",
        "Aktif Konu",
        Icons.flash_on,
        Colors.purple,
      ),
    ];

    if (ResponsiveLayout.isTablet(context)) {
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: cards
            .map(
              (card) => SizedBox(
                width: ResponsiveLayout.itemWidth(
                  context,
                  spacing: 12,
                  phone: 1,
                  tablet: 3,
                  largeTablet: 3,
                ),
                child: card,
              ),
            )
            .toList(),
      );
    }

    return Row(
      children: [
        Expanded(child: cards[0]),
        Expanded(child: cards[1]),
        Expanded(child: cards[2]),
      ],
    );
  }

  Widget summaryCard(String value, String title, IconData icon, Color color) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 4),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark(context) ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 6)],
      ),
      child: Column(
        children: [
          Icon(icon, color: color),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          Text(title, style: const TextStyle(color: Colors.grey)),
        ],
      ),
    );
  }

  /// SEARCH
  Widget searchBox() {
    return TextField(
      controller: _searchController,
      onChanged: (_) => setState(() {}),
      decoration: InputDecoration(
        hintText: "Konu veya soru ara...",
        prefixIcon: const Icon(Icons.search),
        filled: true,
        fillColor: isDark(context) ? const Color(0xFF1E1E1E) : Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }

  /// TAB BAR
  Widget tabBar() {
    return SizedBox(
      height: 40,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        itemCount: tabs.length,
        itemBuilder: (context, index) {
          final subject = tabs[index];
          final bool isSelected = selectedTab == index;
          final accent = _subjectAccent(subject);
          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {
              setState(() {
                selectedTab = index;
              });
            },
            child: Container(
              margin: const EdgeInsets.only(right: 10),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: isSelected
                    ? accent
                    : isDark(context)
                    ? const Color(0xFF1E1E1E)
                    : Colors.grey.shade200,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                _decodeSubject(subject),
                style: TextStyle(
                  color: isSelected ? Colors.white : Colors.grey,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  List<QuestionBankRecord> _filteredQuestions() {
    final selectedSubject = tabs[selectedTab];
    final query = _searchController.text.trim().toLowerCase();
    return _store.questions.where((item) {
      final subjectMatch =
          selectedSubject == 'Tümü' || item.subject == selectedSubject;
      final text = '${item.topic} ${item.questionText} ${item.teacher}'
          .toLowerCase();
      final searchMatch = query.isEmpty || text.contains(query);
      final classMatch =
          _studentClass.isEmpty ||
          item.classTargets.contains('Tüm Sınıflar') ||
          item.classTargets.contains(_studentClass);
      return subjectMatch && searchMatch && classMatch;
    }).toList();
  }

  List<_QuestionTopicGroup> _groupedQuestions() {
    final groups = <String, List<QuestionBankRecord>>{};
    for (final item in _filteredQuestions()) {
      final key = _questionSetKey(item);
      groups.putIfAbsent(key, () => []).add(item);
    }

    final mapped = groups.entries.map((entry) {
      final questions = [...entry.value]
        ..sort((a, b) {
          final aOrder = a.questionOrder ?? 9999;
          final bOrder = b.questionOrder ?? 9999;
          if (aOrder != bOrder) return aOrder.compareTo(bOrder);
          final aTime =
              DateTime.tryParse(a.createdAt) ??
              DateTime.fromMillisecondsSinceEpoch(0);
          final bTime =
              DateTime.tryParse(b.createdAt) ??
              DateTime.fromMillisecondsSinceEpoch(0);
          return aTime.compareTo(bTime);
        });
      return _QuestionTopicGroup(
        subject: questions.first.subject,
        topic: questions.first.questionSetTitle ?? questions.first.topic,
        questions: questions,
      );
    }).toList();

    mapped.sort((a, b) {
      final aTime =
          DateTime.tryParse(a.questions.first.createdAt) ??
          DateTime.fromMillisecondsSinceEpoch(0);
      final bTime =
          DateTime.tryParse(b.questions.first.createdAt) ??
          DateTime.fromMillisecondsSinceEpoch(0);
      return bTime.compareTo(aTime);
    });
    return mapped;
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

  Widget topicQuestionCard(_QuestionTopicGroup group) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () async {
        for (final question in group.questions) {
          await _store.incrementUsage(question.id);
        }
        if (!mounted) return;
        await Navigator.push<void>(
          context,
          MaterialPageRoute(
            builder: (_) => StudentQuestionBankDetailPage(
              subject: group.subject,
              topic: group.topic,
              questions: group.questions,
            ),
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark(context) ? const Color(0xFF17181D) : Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: isDark(context)
                ? Colors.white.withValues(alpha: 0.06)
                : const Color(0xFFE5E7EB),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(
                alpha: isDark(context) ? 0.18 : 0.06,
              ),
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
                        group.topic,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: isDark(context)
                              ? Colors.white
                              : const Color(0xFF111827),
                          fontWeight: FontWeight.w800,
                          fontSize: 17,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${group.questions.length} soru',
                        style: TextStyle(
                          color: isDark(context)
                              ? Colors.white70
                              : const Color(0xFF64748B),
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
                      colors: [Color(0xFF14B8A6), Color(0xFF06B6D4)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '${group.questions.length}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            _coverPreview(group.subject, group.topic, group.questions.length),
          ],
        ),
      ),
    );
  }

  Widget _coverPreview(String subject, String title, int questionCount) {
    final accent = _subjectAccent(subject);
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: SizedBox(
        height: 180,
        width: double.infinity,
        child: _autoCover(subject, title, questionCount, accent),
      ),
    );
  }

  Widget _autoCover(
    String subject,
    String title,
    int questionCount,
    Color accent,
  ) {
    final activeSubject = _decodeSubject(
      subject.trim().isEmpty ? 'Genel' : subject,
    );
    final activeTitle = _decodeSubject(title);
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: _subjectGradient(activeSubject),
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -10,
            top: -14,
            child: Container(
              width: 96,
              height: 96,
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
              _subjectMark(activeSubject),
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.10),
                fontSize: 54,
                fontWeight: FontWeight.w900,
                letterSpacing: -1.6,
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
                    color: Colors.white.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.18),
                    ),
                  ),
                  child: Icon(_subjectIcon(activeSubject), color: Colors.white),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        activeSubject,
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
                        _subjectTagline(activeSubject),
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
                        activeTitle,
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
    );
  }

  List<Color> _subjectGradient(String subject) {
    final normalized = _decodeSubject(subject).toLowerCase();
    if (normalized.contains('mat')) {
      return const [Color(0xFF2563EB), Color(0xFF1D4ED8)];
    }
    if (normalized.contains('fiz')) {
      return const [Color(0xFF7C3AED), Color(0xFF5B21B6)];
    }
    if (normalized.contains('kim')) {
      return const [Color(0xFFEA580C), Color(0xFFC2410C)];
    }
    if (normalized.contains('biy')) {
      return const [Color(0xFF16A34A), Color(0xFF15803D)];
    }
    if (normalized.contains('türk') || normalized.contains('turk')) {
      return const [Color(0xFFDC2626), Color(0xFFB91C1C)];
    }
    if (normalized.contains('ing')) {
      return const [Color(0xFF0891B2), Color(0xFF0E7490)];
    }
    return const [Color(0xFF0F766E), Color(0xFF155E75)];
  }

  Color _subjectAccent(String subject) {
    final normalized = _decodeSubject(subject).toLowerCase();
    if (normalized.contains('mat')) return const Color(0xFF2563EB);
    if (normalized.contains('fiz')) return const Color(0xFF7C3AED);
    if (normalized.contains('kim')) return const Color(0xFFEA580C);
    if (normalized.contains('biy')) return const Color(0xFF16A34A);
    if (normalized.contains('türk') || normalized.contains('turk')) {
      return const Color(0xFFDC2626);
    }
    if (normalized.contains('ing')) return const Color(0xFF0891B2);
    return const Color(0xFF0F766E);
  }

  IconData _subjectIcon(String subject) {
    final normalized = _decodeSubject(subject).toLowerCase();
    if (normalized.contains('mat')) return Icons.calculate_rounded;
    if (normalized.contains('fiz')) return Icons.bolt_rounded;
    if (normalized.contains('kim')) return Icons.science_rounded;
    if (normalized.contains('biy')) return Icons.eco_rounded;
    if (normalized.contains('türk') || normalized.contains('turk')) {
      return Icons.menu_book_rounded;
    }
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
    if (normalized.contains('türk') || normalized.contains('turk')) {
      return 'DİL • ANLAM • PARAGRAF';
    }
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

  /// CHALLENGE
  Widget challengeCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF8E2DE2), Color(0xFF4A00E0)],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          const Icon(Icons.emoji_events, color: Colors.white, size: 32),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Günlük Meydan Okuma",
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  "10 soru çöz, 500 XP kazan!",
                  style: TextStyle(color: Colors.white70),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Text(
              "Devam Et",
              style: TextStyle(
                color: Colors.deepPurple,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuestionTopicGroup {
  final String subject;
  final String topic;
  final List<QuestionBankRecord> questions;

  const _QuestionTopicGroup({
    required this.subject,
    required this.topic,
    required this.questions,
  });
}
