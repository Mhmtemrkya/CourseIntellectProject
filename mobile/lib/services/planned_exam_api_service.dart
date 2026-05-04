import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class PlannedExamApiException implements Exception {
  final String message;

  const PlannedExamApiException(this.message);

  @override
  String toString() => message;
}

class PlannedExamSourceRecord {
  final String? questionId;
  final String title;
  final String type;
  final String? subject;
  final String? imagePath;
  final String? imagePlacement;

  const PlannedExamSourceRecord({
    required this.questionId,
    required this.title,
    required this.type,
    required this.subject,
    required this.imagePath,
    required this.imagePlacement,
  });
}

class PlannedExamRecord {
  final String id;
  final String title;
  final String type;
  final String className;
  final String subject;
  final String date;
  final String duration;
  final int questionCount;
  final String status;
  final String teacherName;
  final String sourceType;
  final List<PlannedExamSourceRecord> sources;

  const PlannedExamRecord({
    required this.id,
    required this.title,
    required this.type,
    required this.className,
    required this.subject,
    required this.date,
    required this.duration,
    required this.questionCount,
    required this.status,
    required this.teacherName,
    required this.sourceType,
    required this.sources,
  });

  factory PlannedExamRecord.fromMap(Map<String, dynamic> map) {
    return PlannedExamRecord(
      id: map['id'] as String,
      title: map['title'] as String,
      type: map['type'] as String,
      className: map['className'] as String,
      subject: map['subject'] as String,
      date: map['date'] as String? ?? map['dateLabel'] as String? ?? '',
      duration: map['duration'] as String? ?? '',
      questionCount: map['questionCount'] as int? ?? 0,
      status: map['status'] as String? ?? 'Planlandi',
      teacherName: map['teacherName'] as String? ?? '',
      sourceType: map['sourceType'] as String? ?? '',
      sources: (map['sources'] as List<dynamic>? ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map(
            (item) => PlannedExamSourceRecord(
              questionId: item['questionId'] as String?,
              title: item['title'] as String? ?? '',
              type: item['type'] as String? ?? '',
              subject: item['subject'] as String?,
              imagePath: item['imagePath'] as String?,
              imagePlacement: item['imagePlacement'] as String?,
            ),
          )
          .toList(),
    );
  }
}

class PlannedExamAnswerRecord {
  final String questionId;
  final String? questionBankItemId;
  final int sortOrder;
  final String topic;
  final String questionText;
  final List<String> options;
  final int? selectedOptionIndex;
  final String selectedAnswerText;
  final int correctOptionIndex;
  final String correctAnswerText;
  final bool? isCorrect;

  const PlannedExamAnswerRecord({
    required this.questionId,
    required this.questionBankItemId,
    required this.sortOrder,
    required this.topic,
    required this.questionText,
    required this.options,
    required this.selectedOptionIndex,
    required this.selectedAnswerText,
    required this.correctOptionIndex,
    required this.correctAnswerText,
    required this.isCorrect,
  });

  factory PlannedExamAnswerRecord.fromMap(Map<String, dynamic> map) {
    return PlannedExamAnswerRecord(
      questionId: map['questionId'] as String? ?? '',
      questionBankItemId: map['questionBankItemId'] as String?,
      sortOrder: map['sortOrder'] as int? ?? 0,
      topic: map['topic'] as String? ?? '',
      questionText: map['questionText'] as String? ?? '',
      options: (map['options'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      selectedOptionIndex: map['selectedOptionIndex'] as int?,
      selectedAnswerText: map['selectedAnswerText'] as String? ?? '',
      correctOptionIndex: map['correctOptionIndex'] as int? ?? 0,
      correctAnswerText: map['correctAnswerText'] as String? ?? '',
      isCorrect: map['isCorrect'] as bool?,
    );
  }
}

class PlannedExamSubmissionRecord {
  final String id;
  final String? sessionId;
  final String studentName;
  final String studentUsername;
  final int score;
  final int net;
  final int correct;
  final int wrong;
  final int blank;
  final int total;
  final String status;
  final List<PlannedExamAnswerRecord> answers;

  const PlannedExamSubmissionRecord({
    required this.id,
    required this.sessionId,
    required this.studentName,
    required this.studentUsername,
    required this.score,
    required this.net,
    required this.correct,
    required this.wrong,
    required this.blank,
    required this.total,
    required this.status,
    required this.answers,
  });

  factory PlannedExamSubmissionRecord.fromMap(Map<String, dynamic> map) {
    return PlannedExamSubmissionRecord(
      id: map['id'] as String? ?? '',
      sessionId: map['sessionId'] as String?,
      studentName: map['studentName'] as String? ?? '',
      studentUsername: map['studentUsername'] as String? ?? '',
      score: map['score'] as int? ?? 0,
      net: map['net'] as int? ?? 0,
      correct: map['correct'] as int? ?? 0,
      wrong: map['wrong'] as int? ?? 0,
      blank: map['blank'] as int? ?? 0,
      total: map['total'] as int? ?? 0,
      status: map['status'] as String? ?? 'Teslim Edildi',
      answers: (map['answers'] as List<dynamic>? ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map(PlannedExamAnswerRecord.fromMap)
          .toList(),
    );
  }
}

class PlannedExamApiService {
  PlannedExamApiService._();

  static final PlannedExamApiService instance = PlannedExamApiService._();

  Future<List<PlannedExamRecord>> fetchPlannedExams({
    String? className,
    String? teacherName,
    String? studentName,
    String? studentUsername,
  }) async {
    final session = await _session();
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/plannedexams').replace(
        queryParameters: {
          if (className != null && className.trim().isNotEmpty)
            'className': className.trim(),
          if (teacherName != null && teacherName.trim().isNotEmpty)
            'teacherName': teacherName.trim(),
          if (studentName != null && studentName.trim().isNotEmpty)
            'studentName': studentName.trim(),
          if (studentUsername != null && studentUsername.trim().isNotEmpty)
            'studentUsername': studentUsername.trim(),
        },
      ),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PlannedExamApiException(
        'Planlı sınavlar alınamadı (${response.statusCode}).',
      );
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map(
          (item) =>
              PlannedExamRecord.fromMap(Map<String, dynamic>.from(item as Map)),
        )
        .toList();
  }

  Future<PlannedExamRecord> createPlannedExam(
    Map<String, dynamic> payload,
  ) async {
    final session = await _session();
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/plannedexams'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode(payload),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PlannedExamApiException(
        'Planlı sınav oluşturulamadı (${response.statusCode}).',
      );
    }

    return PlannedExamRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<void> deletePlannedExam(String id) async {
    final session = await _session();
    final response = await http.delete(
      Uri.parse('${ApiConfig.baseUrl}/api/plannedexams/$id'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PlannedExamApiException(
        'Planlı sınav silinemedi (${response.statusCode}).',
      );
    }
  }

  Future<List<PlannedExamSubmissionRecord>> fetchSubmissions(String id) async {
    final session = await _session();
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/plannedexams/$id/submissions'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PlannedExamApiException(
        'Sınav sonuçları alınamadı (${response.statusCode}).',
      );
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map((item) => Map<String, dynamic>.from(item as Map))
        .map(PlannedExamSubmissionRecord.fromMap)
        .toList();
  }

  Future<AuthSession> _session() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const PlannedExamApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }
    return session;
  }
}
