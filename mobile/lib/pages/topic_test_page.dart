import 'package:flutter/material.dart';
import 'package:student/i18n/app_locale.dart';
import 'package:student/services/auth_session_store.dart';
import 'package:student/services/api_config.dart';
import 'package:student/services/question_bank_api_service.dart';
import 'package:student/services/question_bank_store.dart';
import 'package:student/utils/question_media.dart';

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
  // Sunucunun değerlendirmesi; doğru şık öğrenciye gönderilmez.
  bool? _lastAnswerCorrect;
  // Sunucunun verdiği toplam XP (her sorunun ilk denemesinde).
  int _earnedXp = 0;
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
                !item.isExamOnly && item.options.isNotEmpty,
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
    final knownCorrect = question.correctOptionIndex;
    setState(() => selectedOption = index);

    // Puanlama sunucudadır; ağ hatasında yalnız öğretmen cevabı açtıysa yerel
    // kontrole düşülür.
    var isCorrect = knownCorrect != null && knownCorrect == index;
    try {
      final session = await AuthSessionStore.instance.load();
      if (session != null) {
        final result = await QuestionBankApiService.instance.submitAttempt(
          questionId: question.id,
          studentName: session.fullName,
          studentUsername: session.username,
          answerText: selectedText,
        );
        isCorrect = result.isCorrect;
        _earnedXp += result.xpAwarded;
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Cevap kaydı senkronize edilemedi.'.tr)),
        );
      }
    }

    if (!mounted) return;
    setState(() {
      _lastAnswerCorrect = isCorrect;
      if (isCorrect) {
        correctCount++;
      } else {
        wrongCount++;
        _wrongQuestions.add({
          "question": question.questionText,
          "selected": selectedText,
          "correct": knownCorrect != null
              ? question.options[knownCorrect]
              : 'Öğretmen açıklayacak',
          "note": 'Konu: ${question.topic} • Zorluk: ${question.difficulty}',
        });
      }
    });
  }

  void nextQuestion() {
    if (_questions.isEmpty) return;

    if (currentQuestion < _questions.length - 1) {
      setState(() {
        currentQuestion++;
        selectedOption = -1;
        _lastAnswerCorrect = null;
      });
    } else {
      showDialog(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text("Test Bitti"),
          content: Text(
            "Doğru: $correctCount\nYanlis: $wrongCount\nKazanilan XP: $_earnedXp",
          ),
          actions: [
            TextButton(
              onPressed: () async {
                final dialogNavigator = Navigator.of(dialogContext);
                final pageNavigator = Navigator.of(context);
                dialogNavigator.pop();
                pageNavigator.pop(_earnedXp);
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
            ? Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'Konu testi için uygun soru bankası kaydı bulunmuyor.'.tr,
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
        color: isDark(context) ? const Color(0xFF0E1A2F) : Colors.white,
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
        color: isDark(context) ? const Color(0xFF0E1A2F) : Colors.white,
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
        final knownCorrect = _questions[currentQuestion].correctOptionIndex;

        var color = Colors.white;
        if (selectedOption != -1) {
          if (knownCorrect != null && knownCorrect == index) {
            color = Colors.green;
          } else if (isSelected) {
            // Doğru şık bilinmiyorsa seçilen şık sunucu sonucuna göre boyanır.
            color = _lastAnswerCorrect == null
                ? Colors.white
                : (_lastAnswerCorrect! ? Colors.green : Colors.red);
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
                  ? (isDark(context) ? const Color(0xFF0E1A2F) : Colors.white)
                  : color,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: Row(
              children: [
                CircleAvatar(child: Text(String.fromCharCode(65 + index))),
                const SizedBox(width: 12),
                Expanded(child: _optionContent(options[index])),
              ],
            ),
          ),
        );
      }),
    );
  }

  // Şık görselse (ehliyet vb.) metin yerine görseli göster.
  Widget _optionContent(String option) {
    final raw = stripOptionPrefix(option);
    if (isImageOptionValue(raw)) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 160),
          child: Image.network(
            ApiConfig.resolveAssetUrl(raw),
            fit: BoxFit.contain,
            alignment: Alignment.centerLeft,
            errorBuilder: (context, error, stackTrace) => Text(option),
          ),
        ),
      );
    }
    return Text(option);
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
