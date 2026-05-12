import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class WrongAnswersApiException implements Exception {
  final String message;

  const WrongAnswersApiException(this.message);

  @override
  String toString() => message;
}

class WrongAnswerRecord {
  final String attemptId;
  final String questionId;
  final String studentName;
  final String studentUsername;
  final String subject;
  final String topic;
  final String difficulty;
  final String questionText;
  final String yourAnswer;
  final String correctAnswer;
  final String note;
  final DateTime submittedAtUtc;

  const WrongAnswerRecord({
    required this.attemptId,
    required this.questionId,
    required this.studentName,
    required this.studentUsername,
    required this.subject,
    required this.topic,
    required this.difficulty,
    required this.questionText,
    required this.yourAnswer,
    required this.correctAnswer,
    required this.note,
    required this.submittedAtUtc,
  });

  factory WrongAnswerRecord.fromMap(Map<String, dynamic> map) {
    return WrongAnswerRecord(
      attemptId: map['attemptId'] as String,
      questionId: map['questionId'] as String,
      studentName: map['studentName'] as String? ?? '',
      studentUsername: map['studentUsername'] as String? ?? '',
      subject: map['subject'] as String? ?? '',
      topic: map['topic'] as String? ?? '',
      difficulty: map['difficulty'] as String? ?? '',
      questionText: map['questionText'] as String? ?? '',
      yourAnswer: map['yourAnswer'] as String? ?? '',
      correctAnswer: map['correctAnswer'] as String? ?? '',
      note: map['note'] as String? ?? '',
      submittedAtUtc:
          DateTime.tryParse(map['submittedAtUtc'] as String? ?? '') ??
          DateTime.now(),
    );
  }
}

class WrongAnswersApiService {
  WrongAnswersApiService._();

  static final WrongAnswersApiService instance = WrongAnswersApiService._();

  Future<List<WrongAnswerRecord>> fetchWrongAnswers({
    String? studentUsername,
    String? studentName,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const WrongAnswersApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/wronganswers').replace(
        queryParameters: {
          if (studentUsername != null && studentUsername.trim().isNotEmpty)
            'studentUsername': studentUsername.trim(),
          if (studentName != null && studentName.trim().isNotEmpty)
            'studentName': studentName.trim(),
        },
      ),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw WrongAnswersApiException(
        'Yanlış soru kayıtları alınamadı (${response.statusCode}).',
      );
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map(
          (item) =>
              WrongAnswerRecord.fromMap(Map<String, dynamic>.from(item as Map)),
        )
        .toList();
  }

  Future<void> clearWrongAnswers({
    String? studentUsername,
    String? studentName,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const WrongAnswersApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.delete(
      Uri.parse('${ApiConfig.baseUrl}/api/wronganswers').replace(
        queryParameters: {
          if (studentUsername != null && studentUsername.trim().isNotEmpty)
            'studentUsername': studentUsername.trim(),
          if (studentName != null && studentName.trim().isNotEmpty)
            'studentName': studentName.trim(),
        },
      ),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw WrongAnswersApiException(
        'Yanlış soru kayıtları temizlenemedi (${response.statusCode}).',
      );
    }
  }
}
