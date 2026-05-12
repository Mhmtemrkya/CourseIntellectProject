import 'package:flutter/material.dart';

class TopicTestResultPage extends StatelessWidget {
  final int total;
  final int correct;
  final int wrong;

  final List<Map<String, dynamic>> wrongQuestions;

  const TopicTestResultPage({
    super.key,
    required this.total,
    required this.correct,
    required this.wrong,
    required this.wrongQuestions,
  });

  @override
  Widget build(BuildContext context) {
    int score = ((correct / total) * 100).round();

    return Scaffold(
      appBar: AppBar(title: const Text("Test Sonuçu")),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            const SizedBox(height: 20),
            Text(
              "Puanın",
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),
            CircleAvatar(
              radius: 60,
              backgroundColor: Colors.orange,
              child: Text(
                "$score",
                style: const TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(height: 20),
            statRow("Doğru", correct, Colors.green),
            statRow("Yanlış", wrong, Colors.red),
            statRow("Toplam", total, Colors.blue),
            const Spacer(),
            ElevatedButton(
              onPressed: wrongQuestions.isEmpty
                  ? null
                  : () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => WrongQuestionsPage(
                            wrongQuestions: wrongQuestions,
                          ),
                        ),
                      );
                    },
              child: const Text("Yanlış Soruları Tekrar Çöz"),
            ),

            const SizedBox(height: 10),

            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Geri Dön"),
            ),
          ],
        ),
      ),
    );
  }

  Widget statRow(String title, int value, Color color) {
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: color.withValues(alpha: 0.1),
      ),
      child: Row(
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const Spacer(),
          Text(
            "$value",
            style: TextStyle(
              fontSize: 16,
              color: color,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

class WrongQuestionsPage extends StatelessWidget {
  final List<Map<String, dynamic>> wrongQuestions;

  const WrongQuestionsPage({super.key, required this.wrongQuestions});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Yanlış Sorular")),
      body: ListView.builder(
        itemCount: wrongQuestions.length,
        itemBuilder: (context, index) {
          final question = wrongQuestions[index];
          return ListTile(
            title: Text("Soru ${index + 1}: ${question['question']}"),
            subtitle: Text(
              "Seçilen: ${question['selected']} • Doğru: ${question['correct']}",
            ),
          );
        },
      ),
    );
  }
}
