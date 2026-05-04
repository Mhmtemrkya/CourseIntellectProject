import 'dart:async';

import 'package:flutter/material.dart';
import 'package:student/services/api_config.dart';
import 'package:student/services/exam_session_api_service.dart';
import 'package:student/services/student_xp_service.dart';

import 'exam_result_page.dart';

class ExamSolvePage extends StatefulWidget {
  final String? plannedExamId;
  final String? examTitle;
  final String? subject;
  final int questionCount;

  const ExamSolvePage({
    super.key,
    this.plannedExamId,
    this.examTitle,
    this.subject,
    this.questionCount = 10,
  });

  @override
  State<ExamSolvePage> createState() => _ExamSolvePageState();
}

class _ExamSolvePageState extends State<ExamSolvePage> {
  int currentQuestion = 0;
  int remainingSeconds = 0;
  Timer? timer;
  bool _loading = true;
  bool _submitting = false;
  String? _error;
  ExamSessionRecord? _session;
  final Map<String, TextEditingController> _openControllers = {};

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  @override
  void dispose() {
    timer?.cancel();
    for (final controller in _openControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  TextEditingController _controllerFor(ExamSessionQuestionRecord question) {
    return _openControllers.putIfAbsent(
      question.id,
      () => TextEditingController(text: question.openAnswer ?? ''),
    );
  }

  Future<void> _loadSession() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final session = await ExamSessionApiService.instance.startSession(
        plannedExamId: widget.plannedExamId,
        examTitle: widget.examTitle,
        subject: widget.subject,
        questionCount: widget.questionCount,
      );
      if (!mounted) return;
      setState(() {
        _session = session;
        remainingSeconds = session.durationSeconds;
        _loading = false;
      });
      _startTimer();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  void _startTimer() {
    timer?.cancel();
    timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }

      if (remainingSeconds <= 0) {
        t.cancel();
        _finishExam();
        return;
      }

      setState(() {
        remainingSeconds--;
      });
    });
  }

  Future<void> _selectAnswer(int index) async {
    final session = _session;
    if (session == null || _submitting) return;

    final question = session.questions[currentQuestion];
    setState(() => _submitting = true);
    try {
      final updated = await ExamSessionApiService.instance.submitAnswer(
        sessionId: session.id,
        questionId: question.id,
        selectedOptionIndex: index,
      );
      if (!mounted) return;
      setState(() {
        _session = updated;
      });
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Future<void> _saveOpenAnswer() async {
    final session = _session;
    if (session == null || _submitting) return;

    final question = session.questions[currentQuestion];
    final text = _controllerFor(question).text.trim();
    if (text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cevap boş olamaz.')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final updated = await ExamSessionApiService.instance.submitAnswer(
        sessionId: session.id,
        questionId: question.id,
        openAnswer: text,
      );
      if (!mounted) return;
      setState(() {
        _session = updated;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cevabın kaydedildi.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Future<void> _finishExam() async {
    final session = _session;
    if (session == null || _submitting) return;

    timer?.cancel();
    setState(() => _submitting = true);

    try {
      final result = await ExamSessionApiService.instance.completeSession(
        session.id,
      );
      final reward = StudentXpService.buildExamReward(
        correctCount: result.correct,
        totalQuestions: result.total,
        remainingSeconds: remainingSeconds,
      );
      await StudentXpService.addXp(reward.amount);
      if (!mounted) return;

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => ExamResultPage(
            exam: {
              "title": result.title,
              "score": result.score,
              "correct": result.correct,
              "wrong": result.wrong,
              "blank": result.blank,
              "total": result.total,
              "earnedXp": reward.amount,
              "xpBonuses": reward.bonuses,
            },
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _submitting = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
      _startTimer();
    }
  }

  String _formatTime(int seconds) {
    final min = seconds ~/ 60;
    final sec = seconds % 60;
    return "${min.toString().padLeft(2, '0')}:${sec.toString().padLeft(2, '0')}";
  }

  bool _isDark(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark;
  }

  String? _resolveImageUrl(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    return '${ApiConfig.baseUrl}/${raw.replaceFirst(RegExp(r'^/+'), '')}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(
          _session == null
              ? "Sınav Oturumu"
              : "${_session!.title} ${currentQuestion + 1}/${_session!.questions.length}",
        ),
        actions: [
          if (_session != null)
            Container(
              margin: const EdgeInsets.only(right: 12, top: 10, bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Center(
                child: Text(
                  _formatTime(remainingSeconds),
                  style: TextStyle(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: _loadSession,
                      child: const Text('Tekrar Dene'),
                    ),
                  ],
                ),
              ),
            )
          : _buildContent(context, theme),
    );
  }

  Widget _buildContent(BuildContext context, ThemeData theme) {
    final session = _session!;
    final question = session.questions[currentQuestion];
    final selectedAnswer = question.selectedOptionIndex;
    final progress = session.questions.isEmpty
        ? 0.0
        : (currentQuestion + 1) / session.questions.length;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: theme.colorScheme.primary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Text(
              "${session.subject} • ${session.className} • ${session.questions.length} soru",
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: theme.cardColor,
              borderRadius: BorderRadius.circular(18),
              boxShadow: [
                BoxShadow(
                  color: _isDark(context)
                      ? Colors.black.withValues(alpha: 0.24)
                      : Colors.black.withValues(alpha: 0.08),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    const Icon(Icons.assignment_outlined),
                    const SizedBox(width: 8),
                    const Text(
                      "İlerleme",
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    const Spacer(),
                    Text("%${(progress * 100).toInt()}"),
                  ],
                ),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 10,
                    color: theme.colorScheme.primary,
                    backgroundColor: Colors.grey.shade300,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: theme.cardColor,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: _isDark(context)
                              ? Colors.black.withValues(alpha: 0.24)
                              : Colors.black.withValues(alpha: 0.08),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          question.topic,
                          style: theme.textTheme.labelLarge?.copyWith(
                            color: theme.colorScheme.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          question.questionText,
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if ((question.imagePath ?? '').isNotEmpty) ...[
                          const SizedBox(height: 14),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(18),
                            child: Image.network(
                              _resolveImageUrl(question.imagePath)!,
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) =>
                                  Container(
                                    height: 180,
                                    decoration: BoxDecoration(
                                      color: theme.colorScheme.primary
                                          .withValues(alpha: 0.08),
                                      borderRadius: BorderRadius.circular(18),
                                    ),
                                    alignment: Alignment.center,
                                    child: const Text('Görsel yüklenemedi'),
                                  ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (question.options.isEmpty) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primary.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: theme.colorScheme.primary.withValues(
                            alpha: 0.25,
                          ),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.edit_note_rounded,
                            color: theme.colorScheme.primary,
                          ),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Text(
                              'Açık uçlu soru: cevabını aşağıya yaz ve "Cevabı Kaydet"e bas. İstersen "Atla" ile geç, sonra "Geri" ile dönüp düzenleyebilirsin.',
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _controllerFor(question),
                      maxLines: 5,
                      enabled: !_submitting,
                      decoration: InputDecoration(
                        hintText: 'Cevabını buraya yaz...',
                        filled: true,
                        fillColor: theme.cardColor,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        if (question.openAnswer != null &&
                            question.openAnswer!.isNotEmpty)
                          Expanded(
                            child: Text(
                              'Kayıtlı cevabın var. Düzenleyip tekrar kaydedebilirsin.',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.primary,
                              ),
                            ),
                          )
                        else
                          const Spacer(),
                        ElevatedButton.icon(
                          onPressed: _submitting ? null : _saveOpenAnswer,
                          icon: const Icon(Icons.save_rounded, size: 18),
                          label: const Text('Cevabı Kaydet'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                  ],
                  ...List.generate(question.options.length, (index) {
                    final option = question.options[index];
                    final selected = selectedAnswer == index;
                    return GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: _submitting ? null : () => _selectAnswer(index),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: selected
                              ? theme.colorScheme.primary.withValues(
                                  alpha: 0.14,
                                )
                              : theme.cardColor,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: selected
                                ? theme.colorScheme.primary
                                : Colors.grey.shade300,
                          ),
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              child: Text(String.fromCharCode(65 + index)),
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Text(option)),
                            if (selected)
                              Icon(
                                Icons.check_circle_rounded,
                                color: theme.colorScheme.primary,
                              ),
                          ],
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              if (currentQuestion > 0)
                Expanded(
                  child: OutlinedButton(
                    onPressed: _submitting
                        ? null
                        : () {
                            setState(() {
                              currentQuestion--;
                            });
                          },
                    child: const Text('Geri'),
                  ),
                ),
              if (currentQuestion > 0) const SizedBox(width: 10),
              if (currentQuestion < session.questions.length - 1) ...[
                Expanded(
                  child: OutlinedButton(
                    onPressed: _submitting
                        ? null
                        : () {
                            setState(() {
                              currentQuestion++;
                            });
                          },
                    child: const Text('Atla'),
                  ),
                ),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: ElevatedButton(
                  onPressed: _submitting
                      ? null
                      : () {
                          if (currentQuestion < session.questions.length - 1) {
                            setState(() {
                              currentQuestion++;
                            });
                          } else {
                            _finishExam();
                          }
                        },
                  child: Text(
                    currentQuestion < session.questions.length - 1
                        ? 'Sonraki Soru'
                        : 'Sınavı Bitir',
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
