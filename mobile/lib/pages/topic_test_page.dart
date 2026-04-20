import 'package:flutter/material.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/question_bank_api_service.dart';
import 'package:student/services/question_bank_store.dart';
import 'package:student/services/student_xp_service.dart';

class TopicTestPage extends StatefulWidget {
  const TopicTestPage({super.key});

  @override
  State<TopicTestPage> createState() => _TopicTestPageState();
}

class _TopicTestPageState extends State<TopicTestPage>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> fadeAnim;

  int currentQuestion = 0;
  int selectedOption = -1;
  int correctCount = 0;
  int wrongCount = 0;
  bool _loading = true;
  String? _error;
  List<QuestionBankRecord> _questions = const [];
  final List<Map<String, dynamic>> _wrongQuestions = [];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    fadeAnim = Tween<double>(begin: 0, end: 1).animate(_controller);
    _controller.forward();
    _loadQuestions();
  }

  Future<void> _loadQuestions() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await QuestionBankStore.instance.loadQuestions();
      final items = QuestionBankStore.instance.questions
          .where(
            (item) =>
                item.options.isNotEmpty && item.correctOptionIndex != null,
          )
          .take(5)
          .toList();
      if (!mounted) return;
      setState(() => _questions = items);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool isDark(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> checkAnswer(int index) async {
    if (selectedOption != -1 || _questions.isEmpty) return;

    final question = _questions[currentQuestion];
    final selectedText = question.options[index];
    setState(() {
      selectedOption = index;

      if (index == question.correctOptionIndex) {
        correctCount++;
      } else {
        wrongCount++;
        _wrongQuestions.add({
          "question": question.questionText,
          "selected": selectedText,
          "correct": question.options[question.correctOptionIndex!],
          "note": 'Konu: ${question.topic} • Zorluk: ${question.difficulty}',
        });
      }
    });

    try {
      final session = await AuthSessionStore.instance.load();
      if (session == null) return;
      await QuestionBankApiService.instance.submitAttempt(
        questionId: question.id,
        studentName: session.fullName,
        studentUsername: session.username,
        answerText: selectedText,
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cevap kaydı senkronize edilemedi.')),
      );
    }
  }

  void nextQuestion() {
    if (_questions.isEmpty) return;

    if (currentQuestion < _questions.length - 1) {
      setState(() {
        currentQuestion++;
        selectedOption = -1;
      });
    } else {
      final reward = StudentXpService.buildTopicTestReward(
        correctCount: correctCount,
        totalQuestions: _questions.length,
      );

      showDialog(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text("Test Bitti"),
          content: Text(
            "Doğru: $correctCount\nYanlis: $wrongCount\nKazanilan XP: ${reward.amount}"
            "${reward.bonuses.isEmpty ? "" : "\nBonus: ${reward.bonuses.join(" • ")}"}",
          ),
          actions: [
            TextButton(
              onPressed: () async {
                final dialogNavigator = Navigator.of(dialogContext);
                final pageNavigator = Navigator.of(context);
                await StudentXpService.addXp(reward.amount);
                if (!mounted) return;
                dialogNavigator.pop();
                pageNavigator.pop(reward.amount);
              },
              child: const Text("Tamam"),
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final question = _questions.isEmpty ? null : _questions[currentQuestion];
    final options = question?.options ?? const <String>[];
    final progress = _questions.isEmpty
        ? 0.0
        : (currentQuestion + 1) / _questions.length;

    return Scaffold(
      appBar: AppBar(title: Text(question?.topic ?? "Konu Testi")),
      body: FadeTransition(
        opacity: fadeAnim,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: _loadQuestions,
                      child: const Text('Tekrar Dene'),
                    ),
                  ],
                ),
              )
            : _questions.isEmpty
            ? const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'Konu testi için uygun soru bankası kaydı bulunmuyor.',
                  ),
                ),
              )
            : Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    progressCard(progress),
                    const SizedBox(height: 16),
                    questionCard(question!),
                    const SizedBox(height: 16),
                    optionList(options),
                    const Spacer(),
                    nextButton(),
                  ],
                ),
              ),
      ),
    );
  }

  Widget progressCard(double progress) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark(context) ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const Icon(Icons.quiz, color: Colors.orange),
          const SizedBox(width: 10),
          Text("Soru ${currentQuestion + 1} / ${_questions.length}"),
          const Spacer(),
          Text(
            "Doğru: $correctCount",
            style: const TextStyle(color: Colors.green),
          ),
        ],
      ),
    );
  }

  Widget questionCard(QuestionBankRecord question) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark(context) ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LinearProgressIndicator(value: progressValue()),
          const SizedBox(height: 12),
          Text(
            question.questionText,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  double progressValue() =>
      _questions.isEmpty ? 0 : (currentQuestion + 1) / _questions.length;

  Widget optionList(List<String> options) {
    return Column(
      children: List.generate(options.length, (index) {
        final isSelected = selectedOption == index;
        final isCorrect =
            _questions[currentQuestion].correctOptionIndex == index;

        var color = Colors.white;
        if (selectedOption != -1) {
          if (isCorrect) {
            color = Colors.green;
          } else if (isSelected) {
            color = Colors.red;
          }
        }

        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => checkAnswer(index),
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: selectedOption == -1
                  ? (isDark(context) ? const Color(0xFF1E1E1E) : Colors.white)
                  : color,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: Row(
              children: [
                CircleAvatar(child: Text(String.fromCharCode(65 + index))),
                const SizedBox(width: 12),
                Expanded(child: Text(options[index])),
              ],
            ),
          ),
        );
      }),
    );
  }

  Widget nextButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: selectedOption == -1 ? null : nextQuestion,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFFFF7A45),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        child: Text(
          currentQuestion == _questions.length - 1
              ? "Testi Bitir"
              : "Sonraki Soru",
          style: const TextStyle(fontSize: 16),
        ),
      ),
    );
  }
}
