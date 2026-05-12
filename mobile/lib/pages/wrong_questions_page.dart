import 'package:flutter/material.dart';

class WrongQuestionsPage extends StatefulWidget {
  final List<Map<String, dynamic>> wrongQuestions;

  const WrongQuestionsPage({super.key, required this.wrongQuestions});

  @override
  State<WrongQuestionsPage> createState() => _WrongQuestionsPageState();
}

class _WrongQuestionsPageState extends State<WrongQuestionsPage> {
  int currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    var q = widget.wrongQuestions[currentIndex];

    return Scaffold(
      appBar: AppBar(
        title: Text(
          "Yanlış Sorular ${currentIndex + 1}/${widget.wrongQuestions.length}",
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            questionCard(q["question"]),
            const SizedBox(height: 16),
            optionsList(q),
            const Spacer(),
            nextButton(),
          ],
        ),
      ),
    );
  }

  Widget questionCard(String question) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: Colors.white,
      ),
      child: Text(
        question,
        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget optionsList(Map q) {
    return Column(
      children: List.generate(q["options"].length, (index) {
        bool isCorrect = index == q["correct"];
        bool isSelected = index == q["selected"];

        Color bgColor = isCorrect
            ? Colors.green
            : isSelected
            ? Colors.red
            : Colors.white;

        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              Icon(
                isCorrect
                    ? Icons.check_circle
                    : isSelected
                    ? Icons.close
                    : Icons.radio_button_off,
                color: isCorrect || isSelected ? Colors.white : Colors.grey,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  q["options"][index],
                  style: TextStyle(
                    color: isCorrect || isSelected
                        ? Colors.white
                        : Colors.black,
                  ),
                ),
              ),
            ],
          ),
        );
      }),
    );
  }

  Widget nextButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: () {
          if (currentIndex < widget.wrongQuestions.length - 1) {
            setState(() {
              currentIndex++;
            });
          } else {
            Navigator.pop(context);
          }
        },
        child: Text(
          currentIndex == widget.wrongQuestions.length - 1
              ? "Bitir"
              : "Sonraki",
        ),
      ),
    );
  }
}
