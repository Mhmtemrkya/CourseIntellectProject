import 'package:flutter/material.dart';

class ExamScoreRecord {
  final String examTitle;
  final String type;
  final String subject;
  final String date;
  final String studentName;
  final String className;
  int score;
  int net;

  ExamScoreRecord({
    required this.examTitle,
    required this.type,
    required this.subject,
    required this.date,
    required this.studentName,
    required this.className,
    required this.score,
    required this.net,
  });
}

class ExamResultsStore extends ChangeNotifier {
  ExamResultsStore._();

  static final ExamResultsStore instance = ExamResultsStore._();

  final List<ExamScoreRecord> _records = [];

  List<ExamScoreRecord> get records => List.unmodifiable(_records);

  List<String> get classes => [
    ...{for (final item in _records) item.className},
  ]..sort();

  List<String> get students => [
    ...{for (final item in _records) item.studentName},
  ]..sort();

  void replaceRecords(List<ExamScoreRecord> records) {
    _records
      ..clear()
      ..addAll(records);
    notifyListeners();
  }

  List<ExamScoreRecord> recordsForStudent(String studentName) {
    final list = _records
        .where((item) => item.studentName == studentName)
        .toList();
    list.sort((a, b) => b.date.compareTo(a.date));
    return list;
  }

  List<ExamScoreRecord> recordsForClass(String className) {
    return _records.where((item) => item.className == className).toList();
  }

  double averageForStudent(String studentName) {
    final list = recordsForStudent(studentName);
    if (list.isEmpty) return 0;
    final total = list.fold<int>(0, (sum, item) => sum + item.score);
    return total / list.length;
  }

  void upsertScore({
    required String examTitle,
    required String type,
    required String subject,
    required String date,
    required String studentName,
    required String className,
    required int score,
    required int net,
  }) {
    final existing = _records
        .where(
          (item) =>
              item.examTitle == examTitle && item.studentName == studentName,
        )
        .firstOrNull;

    if (existing != null) {
      existing.score = score;
      existing.net = net;
    } else {
      _records.insert(
        0,
        ExamScoreRecord(
          examTitle: examTitle,
          type: type,
          subject: subject,
          date: date,
          studentName: studentName,
          className: className,
          score: score,
          net: net,
        ),
      );
    }

    notifyListeners();
  }
}
