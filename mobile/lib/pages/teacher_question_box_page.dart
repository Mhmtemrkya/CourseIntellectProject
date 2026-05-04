import 'package:flutter/material.dart';
import 'package:student/pages/teacher_question_detail_page.dart';
import 'package:student/pages/teacher_question_reply_page.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/question_thread_api_service.dart';
import 'package:student/widgets/teacher_header.dart';

class QuestionBoxPage extends StatefulWidget {
  const QuestionBoxPage({super.key});

  @override
  State<QuestionBoxPage> createState() => _QuestionBoxPageState();
}

class _QuestionBoxPageState extends State<QuestionBoxPage> {
  int selectedTab = 0;
  String _teacherName = '';
  List<Map<String, dynamic>> _questions = const [];
  bool _loading = true;
  String? _error;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final session = await AuthSessionStore.instance.load();
    if (mounted && session != null) {
      setState(() => _teacherName = session.fullName);
    }
    await _loadQuestions();
  }

  Future<void> _loadQuestions() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final items = await QuestionThreadApiService.instance.fetchThreads();
      final filtered = _teacherName.trim().isEmpty
          ? items
          : items.where((item) {
              final teacherName = item['teacherName'] as String? ?? '';
              return _normalizeText(teacherName) ==
                  _normalizeText(_teacherName);
            }).toList();
      if (!mounted) return;
      setState(() {
        _questions = filtered;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _pendingQuestions {
    return _questions.where((item) => _teacherReplies(item).isEmpty).toList();
  }

  List<Map<String, dynamic>> get _answeredQuestions {
    return _questions
        .where((item) => _teacherReplies(item).isNotEmpty)
        .toList();
  }

  List<Map<String, dynamic>> _teacherReplies(Map<String, dynamic> item) {
    final replies = (item['replies'] as List<dynamic>? ?? const [])
        .map((reply) => Map<String, dynamic>.from(reply as Map))
        .toList();
    return replies.where((reply) {
      return (reply['senderRole'] as String? ?? '').toLowerCase() == 'teacher';
    }).toList();
  }

  List<Map<String, dynamic>> _visibleQuestions(
    List<Map<String, dynamic>> source,
  ) {
    if (_searchQuery.trim().isEmpty) {
      return source;
    }

    final normalizedQuery = _normalizeText(_searchQuery);
    return source.where((item) {
      final haystack = [
        item['studentName'] as String? ?? '',
        item['className'] as String? ?? '',
        item['subject'] as String? ?? '',
        item['title'] as String? ?? '',
        item['questionText'] as String? ?? '',
      ].join(' ');
      return _normalizeText(haystack).contains(normalizedQuery);
    }).toList();
  }

  double get _averageReplyHours {
    var totalMinutes = 0;
    var count = 0;

    for (final item in _answeredQuestions) {
      final createdAt = DateTime.tryParse(item['createdAt'] as String? ?? '');
      final replies = _teacherReplies(item);
      if (createdAt == null || replies.isEmpty) {
        continue;
      }
      final repliedAt = DateTime.tryParse(
        replies.last['createdAt'] as String? ?? '',
      );
      if (repliedAt == null) {
        continue;
      }
      totalMinutes += repliedAt.difference(createdAt).inMinutes;
      count += 1;
    }

    if (count == 0) {
      return 0;
    }

    return totalMinutes / count / 60;
  }

  String _normalizeText(String value) {
    return value
        .trim()
        .toLowerCase()
        .replaceAll('ç', 'c')
        .replaceAll('ğ', 'g')
        .replaceAll('ı', 'i')
        .replaceAll('ö', 'o')
        .replaceAll('ş', 's')
        .replaceAll('ü', 'u');
  }

  String _formatRelative(String? value) {
    if (value == null || value.isEmpty) return 'Simdi';
    final date = DateTime.tryParse(value)?.toLocal();
    if (date == null) return value;
    final diff = DateTime.now().difference(date);
    if (diff.inMinutes < 1) return 'Simdi';
    if (diff.inHours < 1) return '${diff.inMinutes} dk önce';
    if (diff.inDays < 1) return '${diff.inHours} saat önce';
    if (diff.inDays == 1) return 'Dun';
    return '${diff.inDays} gün önce';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final questions = _visibleQuestions(
      selectedTab == 0 ? _pendingQuestions : _answeredQuestions,
    );

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: TeacherHeader(
        title: "Soru Kutusu",
        teacherName: _teacherName.isEmpty ? 'Öğretmen' : _teacherName,
        subtitle: '${_pendingQuestions.length} bekleyen soru',
        showBackButton: true,
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: theme.colorScheme.primary,
        onPressed: _loadQuestions,
        child: const Icon(Icons.refresh_rounded, color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _topSummary(theme, isDark),
            const SizedBox(height: 18),
            _searchBox(theme),
            const SizedBox(height: 16),
            _tabBar(theme),
            const SizedBox(height: 18),
            if (_loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 48),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_error != null)
              _messageCard(
                theme,
                icon: Icons.wifi_off_rounded,
                message: _error!,
              )
            else if (questions.isEmpty)
              _messageCard(
                theme,
                icon: Icons.inbox_outlined,
                message: selectedTab == 0
                    ? 'Bekleyen soru bulunmuyor.'
                    : 'Yanıtlanmış soru bulunmuyor.',
              )
            else
              ...questions.map(
                (item) => _questionCard(
                  context,
                  theme,
                  isDark,
                  item: item,
                  answered: selectedTab == 1,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _topSummary(ThemeData theme, bool isDark) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: isDark
                ? Colors.black.withValues(alpha: 0.22)
                : Colors.black.withValues(alpha: 0.06),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "Soru Kutusu",
            style: theme.textTheme.titleMedium?.copyWith(
              fontSize: 28,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            "Öğrencilerden gelen soruları yönetin ve hızlıca yanıtlayın.",
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.textTheme.bodyMedium?.color?.withValues(alpha: 0.72),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _miniStat(
                theme,
                title: "Bekleyen",
                value: "${_pendingQuestions.length}",
                color: const Color(0xFFFFB020),
                icon: Icons.schedule_rounded,
              ),
              const SizedBox(width: 12),
              _miniStat(
                theme,
                title: "Yanitlanan",
                value: "${_answeredQuestions.length}",
                color: const Color(0xFF69C36D),
                icon: Icons.check_circle_outline_rounded,
              ),
              const SizedBox(width: 12),
              _miniStat(
                theme,
                title: "Ort. Sure",
                value: _averageReplyHours == 0
                    ? '--'
                    : '${_averageReplyHours.toStringAsFixed(1)}s',
                color: const Color(0xFF4E8DF5),
                icon: Icons.timer_outlined,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _miniStat(
    ThemeData theme, {
    required String title,
    required String value,
    required Color color,
    required IconData icon,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withValues(alpha: 0.22)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color),
            const SizedBox(height: 10),
            Text(
              value,
              style: theme.textTheme.titleMedium?.copyWith(
                fontSize: 24,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.textTheme.bodySmall?.color?.withValues(
                  alpha: 0.72,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _searchBox(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(18),
      ),
      child: TextField(
        onChanged: (value) {
          setState(() {
            _searchQuery = value;
          });
        },
        decoration: InputDecoration(
          icon: Icon(
            Icons.search_rounded,
            color: theme.iconTheme.color?.withValues(alpha: 0.7),
          ),
          hintText: "Öğrenci veya konu ara...",
          border: InputBorder.none,
        ),
      ),
    );
  }

  Widget _tabBar(ThemeData theme) {
    return Row(
      children: [
        _tabButton(theme, "Bekleyen", 0),
        const SizedBox(width: 10),
        _tabButton(theme, "Yanitlanan", 1),
      ],
    );
  }

  Widget _tabButton(ThemeData theme, String title, int index) {
    final selected = selectedTab == index;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        setState(() {
          selectedTab = index;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? theme.colorScheme.primary : theme.cardColor,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          title,
          style: TextStyle(
            color: selected ? Colors.white : theme.textTheme.bodyMedium?.color,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Widget _messageCard(
    ThemeData theme, {
    required IconData icon,
    required String message,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: theme.cardColor,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        children: [
          Icon(icon, size: 34, color: theme.colorScheme.primary),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }

  Widget _questionCard(
    BuildContext context,
    ThemeData theme,
    bool isDark, {
    required Map<String, dynamic> item,
    required bool answered,
  }) {
    final user = item['studentName'] as String? ?? 'Öğrenci';
    final className = item['className'] as String? ?? 'Sınıf';
    final subject = item['subject'] as String? ?? 'Genel';
    final text = item['questionText'] as String? ?? '';
    final initials = user
        .split(' ')
        .where((e) => e.isNotEmpty)
        .take(2)
        .map((e) => e[0])
        .join();

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
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
          Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: theme.colorScheme.primary.withValues(
                  alpha: 0.14,
                ),
                child: Text(
                  initials,
                  style: TextStyle(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$className • ${_formatRelative(item['lastActivity'] as String? ?? item['createdAt'] as String?)}',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.textTheme.bodySmall?.color?.withValues(
                          alpha: 0.7,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: answered
                      ? const Color(0xFF69C36D).withValues(alpha: 0.14)
                      : const Color(0xFFFFB020).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  answered ? "Yanitlandi" : subject,
                  style: TextStyle(
                    color: answered
                        ? const Color(0xFF69C36D)
                        : const Color(0xFFFFB020),
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              text,
              style: theme.textTheme.bodyMedium?.copyWith(height: 1.4),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () async {
                    await Navigator.push<void>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => TeacherQuestionDetailPage(thread: item),
                      ),
                    );
                  },
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text("Detay"),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: () async {
                    final refreshed = await Navigator.push<bool>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => TeacherQuestionReplyPage(thread: item),
                      ),
                    );
                    if (refreshed == true) {
                      await _loadQuestions();
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: answered
                        ? const Color(0xFF69C36D)
                        : theme.colorScheme.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: Text(answered ? "Görüntüle" : "Yanitla"),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
