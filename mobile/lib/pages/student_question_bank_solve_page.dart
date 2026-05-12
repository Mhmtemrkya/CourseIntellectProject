import 'package:flutter/material.dart';

import '../services/auth_session_store.dart';
import '../services/api_config.dart';
import '../services/question_bank_api_service.dart';
import '../services/question_bank_store.dart';
import '../services/student_xp_service.dart';
import '../widgets/responsive_layout.dart';
import '../widgets/responsive_overlays.dart';

class StudentQuestionBankSolvePage extends StatefulWidget {
  final String subject;
  final String topic;
  final List<QuestionBankRecord> questions;

  const StudentQuestionBankSolvePage({
    super.key,
    required this.subject,
    required this.topic,
    required this.questions,
  });

  @override
  State<StudentQuestionBankSolvePage> createState() =>
      _StudentQuestionBankSolvePageState();
}

class _StudentQuestionBankSolvePageState
    extends State<StudentQuestionBankSolvePage> {
  final TextEditingController _answerController = TextEditingController();
  final Map<String, int> _selectedOptions = {};
  final Map<String, String> _typedAnswers = {};
  final Set<String> _submittedAttemptIds = <String>{};
  int _currentIndex = 0;
  bool _finished = false;

  QuestionBankRecord get _currentQuestion => widget.questions[_currentIndex];

  @override
  void initState() {
    super.initState();
    _answerController.addListener(_syncTypedAnswer);
    _loadCurrentAnswer();
  }

  @override
  void dispose() {
    _answerController
      ..removeListener(_syncTypedAnswer)
      ..dispose();
    super.dispose();
  }

  void _syncTypedAnswer() {
    if (_currentQuestion.type == 'Çoktan Seçmeli') return;
    _typedAnswers[_currentQuestion.id] = _answerController.text;
  }

  void _loadCurrentAnswer() {
    if (_currentQuestion.type == 'Çoktan Seçmeli') {
      _answerController.text = '';
      return;
    }

    final saved = _typedAnswers[_currentQuestion.id] ?? '';
    if (_answerController.text == saved) return;
    _answerController.value = TextEditingValue(
      text: saved,
      selection: TextSelection.collapsed(offset: saved.length),
    );
  }

  Future<void> _goNext() async {
    await _submitCurrentAttemptIfNeeded();

    if (_currentIndex < widget.questions.length - 1) {
      setState(() {
        _currentIndex++;
      });
      _loadCurrentAnswer();
      return;
    }

    await _finishSet();
  }

  Future<void> _skipQuestion() async {
    _typedAnswers[_currentQuestion.id] = '';
    if (_currentQuestion.type == 'Çoktan Seçmeli') {
      _selectedOptions.remove(_currentQuestion.id);
    }

    if (_currentIndex < widget.questions.length - 1) {
      setState(() {
        _currentIndex++;
      });
      _loadCurrentAnswer();
      return;
    }

    await _finishSet();
  }

  void _goPrevious() {
    if (_currentIndex == 0) return;
    setState(() {
      _currentIndex--;
    });
    _loadCurrentAnswer();
  }

  Future<void> _finishSet() async {
    if (_finished) return;
    _finished = true;

    int correctCount = 0;
    int totalXp = 0;
    final bonuses = <String>[];
    final wrongQuestions = <QuestionBankRecord>[];

    for (final question in widget.questions) {
      final isCorrect = _isCorrectFor(question);
      if (isCorrect) {
        correctCount++;
      } else {
        wrongQuestions.add(question);
      }

      final reward = StudentXpService.buildQuestionBankSolveReward(
        isCorrect: isCorrect,
        hasImage: question.imagePath != null,
        hasSolutionAsset: question.solutionAssetPath != null,
      );
      totalXp += reward.amount;
      bonuses.addAll(reward.bonuses);
    }

    bonuses.sort();
    final uniqueBonuses = bonuses.toSet().toList();

    await StudentXpService.addXp(totalXp);
    if (!mounted) return;

    _showResultDialog(
      correctCount: correctCount,
      wrongQuestions: wrongQuestions,
      totalXp: totalXp,
      bonuses: uniqueBonuses,
    );
  }

  Future<void> _submitCurrentAttemptIfNeeded() async {
    if (_submittedAttemptIds.contains(_currentQuestion.id)) {
      return;
    }

    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      return;
    }

    final answerText = _currentQuestion.type == 'Çoktan Seçmeli'
        ? (_selectedOptions[_currentQuestion.id] != null
              ? _currentQuestion.options[_selectedOptions[_currentQuestion.id]!]
              : '')
        : (_typedAnswers[_currentQuestion.id] ?? '').trim();

    if (answerText.isEmpty) {
      return;
    }

    try {
      await QuestionBankApiService.instance.submitAttempt(
        questionId: _currentQuestion.id,
        studentName: session.fullName,
        studentUsername: session.username,
        answerText: answerText,
      );
      _submittedAttemptIds.add(_currentQuestion.id);
    } catch (_) {
      // ignore sync failures for now
    }
  }

  bool _isCorrectFor(QuestionBankRecord question) {
    final expected = (question.expectedAnswer ?? '').trim().toLowerCase();
    if (question.type == 'Çoktan Seçmeli') {
      return _selectedOptions[question.id] == question.correctOptionIndex;
    }

    final given = (_typedAnswers[question.id] ?? '').trim().toLowerCase();
    return given.isNotEmpty && given == expected;
  }

  void _showResultDialog({
    required int correctCount,
    required List<QuestionBankRecord> wrongQuestions,
    required int totalXp,
    required List<String> bonuses,
  }) {
    final total = widget.questions.length;
    final isSuccessful = correctCount >= (total / 2).ceil();

    showDialog<void>(
      context: context,
      builder: (dialogContext) {
        final theme = Theme.of(dialogContext);
        final resultColor = isSuccessful
            ? const Color(0xFF059669)
            : const Color(0xFFDC2626);

        return Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.all(24),
          child: ResponsiveDialogContainer(
            maxWidth: 500,
            child: Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(dialogContext).size.height * 0.82,
              ),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: theme.cardColor,
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(
                      alpha: theme.brightness == Brightness.dark ? 0.28 : 0.12,
                    ),
                    blurRadius: 24,
                    offset: const Offset(0, 14),
                  ),
                ],
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: isSuccessful
                              ? const [Color(0xFF065F46), Color(0xFF10B981)]
                              : const [Color(0xFF7F1D1D), Color(0xFFEF4444)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 54,
                                height: 54,
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.14),
                                  borderRadius: BorderRadius.circular(18),
                                ),
                                child: Icon(
                                  isSuccessful
                                      ? Icons.check_rounded
                                      : Icons.flag_outlined,
                                  color: Colors.white,
                                  size: 30,
                                ),
                              ),
                              const Spacer(),
                              Icon(
                                Icons.auto_awesome_rounded,
                                color: Colors.white.withValues(alpha: 0.84),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          Text(
                            isSuccessful
                                ? 'Konu seti tamamlandı'
                                : 'Set tamamlandı, tekrar gerekli',
                            style: theme.textTheme.titleLarge?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '${widget.topic} konusu için $correctCount/$total doğru yaptın.',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: Colors.white.withValues(alpha: 0.9),
                              height: 1.45,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: _resultMetric(
                            theme,
                            label: 'Doğru',
                            value: '$correctCount / $total',
                            valueColor: resultColor,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _resultMetric(
                            theme,
                            label: 'Kazanılan XP',
                            value: '+$totalXp',
                            valueColor: const Color(0xFF7C3AED),
                          ),
                        ),
                      ],
                    ),
                    if (bonuses.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text(
                        'XP Özeti',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 10),
                      ...bonuses.map(
                        (bonus) => Container(
                          width: double.infinity,
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: theme.scaffoldBackgroundColor,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.bolt_rounded,
                                color: theme.colorScheme.primary,
                              ),
                              const SizedBox(width: 8),
                              Expanded(child: Text(bonus)),
                            ],
                          ),
                        ),
                      ),
                    ],
                    if (wrongQuestions.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text(
                        'Tekrar Etmen Gerekenler',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 10),
                      ...wrongQuestions
                          .take(3)
                          .map(
                            (question) => Container(
                              width: double.infinity,
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: theme.scaffoldBackgroundColor,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Row(
                                children: [
                                  const Icon(
                                    Icons.refresh_rounded,
                                    color: Color(0xFFDC2626),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      question.questionText,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                    ],
                    const SizedBox(height: 18),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        SizedBox(
                          width: 180,
                          child: OutlinedButton(
                            onPressed: () {
                              Navigator.pop(dialogContext);
                              setState(() {
                                _currentIndex = 0;
                                _selectedOptions.clear();
                                _typedAnswers.clear();
                              });
                              _loadCurrentAnswer();
                            },
                            child: const Text('Tekrar Çöz'),
                          ),
                        ),
                        SizedBox(
                          width: 180,
                          child: FilledButton(
                            onPressed: () {
                              Navigator.pop(dialogContext);
                              Navigator.pop(context);
                            },
                            child: const Text('Soru Bankasına Dön'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final hasImage =
        _currentQuestion.imagePath != null &&
        _currentQuestion.imagePath!.isNotEmpty;
    final progress = (_currentIndex + 1) / widget.questions.length;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(title: const Text('Soru Seti')),
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
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _tag(widget.subject),
                        _tag(widget.topic),
                        _tag('${_currentIndex + 1}/${widget.questions.length}'),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'Soru ${_currentIndex + 1}',
                      style: theme.textTheme.headlineSmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Bu setteki soruları sırayla çöz. Sonunda genel başarı durumunu göreceksin.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.9),
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 14),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 10,
                        backgroundColor: Colors.white.withValues(alpha: 0.18),
                        valueColor: const AlwaysStoppedAnimation<Color>(
                          Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              _panel(
                theme,
                isDark,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _currentQuestion.questionText,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        height: 1.45,
                      ),
                    ),
                    if (hasImage) ...[
                      const SizedBox(height: 16),
                      _questionImage(theme),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),
              _panel(
                theme,
                isDark,
                child: _currentQuestion.type == 'Çoktan Seçmeli'
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Seçenekler',
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 12),
                          ..._currentQuestion.options.asMap().entries.map((
                            entry,
                          ) {
                            final selected =
                                _selectedOptions[_currentQuestion.id] ==
                                entry.key;
                            return GestureDetector(
                              behavior: HitTestBehavior.opaque,
                              onTap: () => setState(
                                () => _selectedOptions[_currentQuestion.id] =
                                    entry.key,
                              ),
                              child: Container(
                                width: double.infinity,
                                margin: const EdgeInsets.only(bottom: 10),
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: selected
                                      ? theme.colorScheme.primary.withValues(
                                          alpha: 0.12,
                                        )
                                      : theme.scaffoldBackgroundColor,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: selected
                                        ? theme.colorScheme.primary
                                        : Colors.transparent,
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    CircleAvatar(
                                      radius: 14,
                                      backgroundColor: selected
                                          ? theme.colorScheme.primary
                                          : theme.colorScheme.primary
                                                .withValues(alpha: 0.12),
                                      foregroundColor: selected
                                          ? Colors.white
                                          : theme.colorScheme.primary,
                                      child: Text(
                                        String.fromCharCode(65 + entry.key),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(child: Text(entry.value)),
                                  ],
                                ),
                              ),
                            );
                          }),
                        ],
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Cevabın',
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _answerController,
                            maxLines: 5,
                            decoration: const InputDecoration(
                              hintText: 'Cevabını yaz...',
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ],
                      ),
              ),
              const SizedBox(height: 14),
              Align(
                alignment: Alignment.centerRight,
                child: OutlinedButton(
                  onPressed: _skipQuestion,
                  child: const Text('Soruyu Atla'),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _currentIndex == 0 ? null : _goPrevious,
                      child: const Text('Önceki'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: _goNext,
                      icon: Icon(
                        _currentIndex == widget.questions.length - 1
                            ? Icons.flag_rounded
                            : Icons.arrow_forward_rounded,
                      ),
                      label: Text(
                        _currentIndex == widget.questions.length - 1
                            ? 'Seti Bitir'
                            : 'Sonraki Soru',
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _panel(ThemeData theme, bool isDark, {required Widget child}) {
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
      child: child,
    );
  }

  Widget _tag(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _resultMetric(
    ThemeData theme, {
    required String label,
    required String value,
    required Color valueColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 14),
      decoration: BoxDecoration(
        color: theme.scaffoldBackgroundColor,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w900,
              color: valueColor,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _questionImage(ThemeData theme) {
    final resolved = ApiConfig.resolveAssetUrl(_currentQuestion.imagePath);
    final isNetwork =
        resolved.startsWith('http://') || resolved.startsWith('https://');
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: Container(
        height: 220,
        width: double.infinity,
        color: theme.scaffoldBackgroundColor,
        child: isNetwork
            ? Image.network(
                resolved,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) =>
                    _imageFallback(theme),
              )
            : _imageFallback(theme),
      ),
    );
  }

  Widget _imageFallback(ThemeData theme) {
    return Container(
      alignment: Alignment.center,
      padding: const EdgeInsets.all(16),
      child: Text(
        'Soru görseli yüklenemedi',
        style: theme.textTheme.bodyMedium?.copyWith(
          color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
