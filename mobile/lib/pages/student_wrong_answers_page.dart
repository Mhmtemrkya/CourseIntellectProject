import 'package:flutter/material.dart';

import '../services/auth_session_store.dart';
import '../services/wrong_answers_api_service.dart';
import '../widgets/responsive_layout.dart';
import 'student_wrong_question_detail_page.dart';

class StudentWrongAnswersPage extends StatefulWidget {
  const StudentWrongAnswersPage({super.key});

  @override
  State<StudentWrongAnswersPage> createState() => _StudentWrongAnswersPageState();
}

class _StudentWrongAnswersPageState extends State<StudentWrongAnswersPage> {
  bool _loading = true;
  String? _error;
  List<_WeakTopicCard> _cards = const [];

  @override
  void initState() {
    super.initState();
    _loadCards();
  }

  Future<void> _loadCards() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final session = await AuthSessionStore.instance.load();
      final records = await WrongAnswersApiService.instance.fetchWrongAnswers(
        studentUsername: session?.username,
        studentName: session?.fullName,
      );
      final grouped = <String, List<WrongAnswerRecord>>{};
      for (final item in records) {
        grouped.putIfAbsent(item.subject, () => []).add(item);
      }

      final cards = grouped.entries.map((entry) {
        final subject = _decodeText(entry.key);
        final attempts = entry.value;
        final recentAttempts = attempts.take(6).toList();
        return _WeakTopicCard(
          lesson: subject,
          topic: _decodeText(recentAttempts.first.topic),
          summary: 'Toplam ${attempts.length} yanlış deneme kaydı bulundu. Son konu: ${_decodeText(recentAttempts.first.topic)}.',
          color: _colorForSubject(subject),
          questions: recentAttempts
              .map(
                (item) => {
                  'question': _decodeText(item.questionText),
                  'yourAnswer': _decodeText(item.yourAnswer),
                  'correct': _decodeText(item.correctAnswer),
                  'note': _decodeText(item.note),
                },
              )
              .toList(),
          sortScore: attempts.length,
        );
      }).toList()
        ..sort((a, b) => b.sortScore.compareTo(a.sortScore));

      if (!mounted) return;
      setState(() => _cards = cards);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Yanlış Defterim', style: TextStyle(fontWeight: FontWeight.bold))),
      body: ResponsiveContent(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        ElevatedButton(onPressed: _loadCards, child: const Text('Tekrar Dene')),
                      ],
                    ),
                  )
                : _cards.isEmpty
                ? const Center(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: Text('Henuz analiz edilecek sinav sonucu bulunmuyor.'),
                        ),
                      )
                    : ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          Container(
                            margin: const EdgeInsets.only(bottom: 16),
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFF991B1B), Color(0xFFEA580C)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(28),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.14),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: const Text(
                                    'Yanlış Analizi',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 14),
                                Text(
                                  '${_cards.length} konu tekrar bekliyor',
                                  style: theme.textTheme.headlineSmall?.copyWith(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'Cozdugun yanlis sorular ders ve konu bazinda burada toplanir. Detaya girip dogru cevabi ve notu gorebilirsin.',
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    color: Colors.white.withValues(alpha: 0.88),
                                    height: 1.45,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Align(
                            alignment: Alignment.centerRight,
                            child: OutlinedButton.icon(
                              onPressed: () async {
                                final messenger = ScaffoldMessenger.of(context);
                                final session = await AuthSessionStore.instance.load();
                                await WrongAnswersApiService.instance.clearWrongAnswers(
                                  studentUsername: session?.username,
                                  studentName: session?.fullName,
                                );
                                if (!mounted) return;
                                await _loadCards();
                                if (!mounted) return;
                                messenger.showSnackBar(
                                  const SnackBar(content: Text('Yanlış defteri temizlendi.')),
                                );
                              },
                              icon: const Icon(Icons.delete_sweep_rounded),
                              label: const Text('Yanlışlarımı Temizle'),
                            ),
                          ),
                          const SizedBox(height: 12),
                          ..._cards.map(
                              (item) => InkWell(
                                borderRadius: BorderRadius.circular(22),
                                onTap: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => StudentWrongQuestionDetailPage(
                                      lesson: item.lesson,
                                      topic: item.topic,
                                      questions: item.questions,
                                      color: item.color,
                                    ),
                                  ),
                                ),
                                child: Container(
                                  margin: const EdgeInsets.only(bottom: 12),
                                  padding: const EdgeInsets.all(18),
                                  decoration: BoxDecoration(
                                    color: Theme.of(context).cardColor,
                                    borderRadius: BorderRadius.circular(22),
                                    border: Border.all(
                                      color: item.color.withValues(alpha: 0.14),
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.05),
                                        blurRadius: 18,
                                        offset: const Offset(0, 10),
                                      ),
                                    ],
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Container(
                                            width: 46,
                                            height: 46,
                                            decoration: BoxDecoration(
                                              color: item.color.withValues(alpha: 0.12),
                                              borderRadius: BorderRadius.circular(16),
                                            ),
                                            alignment: Alignment.center,
                                            child: Text(
                                              '${item.questions.length}',
                                              style: TextStyle(
                                                color: item.color,
                                                fontWeight: FontWeight.w900,
                                                fontSize: 16,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  item.lesson,
                                                  style: TextStyle(color: item.color, fontWeight: FontWeight.w800),
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  item.topic,
                                                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      Container(
                                        padding: const EdgeInsets.all(14),
                                        decoration: BoxDecoration(
                                          color: item.color.withValues(alpha: 0.07),
                                          borderRadius: BorderRadius.circular(18),
                                        ),
                                        child: Text(
                                          item.summary,
                                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.4),
                                        ),
                                      ),
                                      const SizedBox(height: 10),
                                      Row(
                                        children: [
                                          Text(
                                            'Detayi ac',
                                            style: Theme.of(context)
                                                .textTheme
                                            .bodySmall
                                            ?.copyWith(color: item.color, fontWeight: FontWeight.w800),
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            '${item.questions.length} soru',
                                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                                  color: Theme.of(context).textTheme.bodySmall?.color?.withValues(alpha: 0.7),
                                                  fontWeight: FontWeight.w700,
                                                ),
                                          ),
                                          const Spacer(),
                                          Icon(Icons.chevron_right_rounded, color: item.color),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
      ),
    );
  }

  Color _colorForSubject(String subject) {
    final normalized = subject.toLowerCase();
    if (normalized.contains('mat')) return const Color(0xFF2563EB);
    if (normalized.contains('fiz')) return const Color(0xFF0F766E);
    if (normalized.contains('kim')) return const Color(0xFFB45309);
    return const Color(0xFF7C3AED);
  }

  String _decodeText(String? value) {
    return (value ?? '')
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
        .replaceAll('&amp;', '&')
        .trim();
  }
}

class _WeakTopicCard {
  final String lesson;
  final String topic;
  final String summary;
  final Color color;
  final List<Map<String, String>> questions;
  final int sortScore;

  const _WeakTopicCard({
    required this.lesson,
    required this.topic,
    required this.summary,
    required this.color,
    required this.questions,
    required this.sortScore,
  });
}
