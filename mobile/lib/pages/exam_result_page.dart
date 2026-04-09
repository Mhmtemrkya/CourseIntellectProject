import 'package:flutter/material.dart';

class ExamResultPage extends StatefulWidget {
  final Map<String, dynamic> exam;

  const ExamResultPage({
    super.key,
    required this.exam,
  });

  @override
  State<ExamResultPage> createState() => _ExamResultPageState();
}

class _ExamResultPageState extends State<ExamResultPage> {
  bool _xpToastShown = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_xpToastShown) return;

    final earnedXp = widget.exam["earnedXp"] as int? ?? 0;
    if (earnedXp <= 0) return;

    _xpToastShown = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          content: Text("Sinav tamamlandi • +$earnedXp XP"),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final score = widget.exam["score"] as int? ?? 0;
    final correct = widget.exam["correct"] as int? ?? 0;
    final wrong = widget.exam["wrong"] as int? ?? 0;
    final blank = widget.exam["blank"] as int? ?? 0;
    final earnedXp = widget.exam["earnedXp"] as int? ?? 0;
    final xpBonuses =
        (widget.exam["xpBonuses"] as List?)?.cast<String>() ?? const <String>[];

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text("Sinav Sonucu"),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(28),
                gradient: const LinearGradient(
                  colors: [
                    Color(0xFFFF7A00),
                    Color(0xFFFFA24A),
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: isDark
                        ? Colors.black.withValues(alpha: 0.24)
                        : const Color(0xFFFF7A00).withValues(alpha: 0.22),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                children: [
                  const Text(
                    "Sinav Sonucun",
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    "$score",
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 40,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    widget.exam["title"] as String? ?? "Sinav",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.92),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _statCard(
              theme,
              isDark,
              correct: correct,
              wrong: wrong,
              blank: blank,
              score: score,
              earnedXp: earnedXp,
              xpBonuses: xpBonuses,
            ),
          ],
        ),
      ),
    );
  }

  Widget _statCard(
    ThemeData theme,
    bool isDark, {
    required int correct,
    required int wrong,
    required int blank,
    required int score,
    required int earnedXp,
    required List<String> xpBonuses,
  }) {
    return Container(
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
          _row("Dogru", "$correct"),
          _row("Yanlis", "$wrong"),
          _row("Bos", "$blank"),
          _row("Basari", "%$score"),
          _row("XP", "+$earnedXp"),
          if (xpBonuses.isNotEmpty) ...[
            const SizedBox(height: 6),
            ...xpBonuses.map(
              (bonus) => Align(
                alignment: Alignment.centerLeft,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    bonus,
                    style: TextStyle(
                      color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.72),
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          const Spacer(),
          Text(value),
        ],
      ),
    );
  }
}
