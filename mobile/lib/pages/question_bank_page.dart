import 'package:flutter/material.dart';
import '../services/question_bank_store.dart';
import '../widgets/premium_resource_card.dart';
import '../widgets/responsive_layout.dart';
import '../widgets/student_empty_state_panel.dart';
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
      _studentClass = '';
      await _store.loadQuestions();
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
                  else if (topics.isEmpty)
                    StudentEmptyStatePanel(
                      title: 'Henüz soru çözmedin',
                      description:
                          'Soru bankamızdan konu çalışmaya başlayın. Sana özel sorular ve çözümler burada olacak.',
                      accentColor: const Color(0xFF2563EB),
                      icon: Icons.help_outline_rounded,
                      primaryLabel: 'Soru Çözmeye Başla',
                      onPrimary: _load,
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
        color: isDark(context) ? const Color(0xFF0E1A2F) : Colors.white,
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
        fillColor: isDark(context) ? const Color(0xFF0E1A2F) : Colors.white,
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
                    ? const Color(0xFF0E1A2F)
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
    final studentClassKey = _normalizeFilterText(_studentClass);
    return _store.questions.where((item) {
      final subjectMatch =
          selectedSubject == 'Tümü' || item.subject == selectedSubject;
      final text = '${item.topic} ${item.questionText} ${item.teacher}'
          .toLowerCase();
      final searchMatch = query.isEmpty || text.contains(query);
      final classMatch =
          _studentClass.isEmpty ||
          item.classTargets.any((target) {
            final targetKey = _normalizeFilterText(target);
            return targetKey == 'tum siniflar' || targetKey == studentClassKey;
          });
      return subjectMatch && searchMatch && classMatch;
    }).toList();
  }

  String _normalizeFilterText(String value) {
    return value
        .trim()
        .toLowerCase()
        .replaceAll('ı', 'i')
        .replaceAll('ğ', 'g')
        .replaceAll('ü', 'u')
        .replaceAll('ş', 's')
        .replaceAll('ö', 'o')
        .replaceAll('ç', 'c');
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
    final teacher = group.questions.first.teacher;
    return PremiumResourceCard(
      subject: _decodeSubject(group.subject),
      title: _decodeSubject(group.topic),
      subtitle: teacher.isEmpty ? null : teacher,
      badge: '${group.questions.length} soru',
      footer: CardPrimaryButton(
        label: 'Seti Başlat',
        icon: Icons.play_arrow_rounded,
        onTap: () => _openTopicGroup(group),
      ),
      onTap: () => _openTopicGroup(group),
    );
  }

  Future<void> _openTopicGroup(_QuestionTopicGroup group) async {
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
