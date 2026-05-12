import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class ExamSessionApiException implements Exception {
  final String message;

  const ExamSessionApiException(this.message);

  @override
  String toString() => message;
}

class ExamSessionQuestionRecord {
  final String id;
  final String subject;
  final String topic;
  final String questionText;
  final String? imagePath;
  final String? imagePlacement;
  final List<String> options;
  final int sortOrder;
  final int? selectedOptionIndex;
  final String? openAnswer;
  final bool requiresManualReview;

  const ExamSessionQuestionRecord({
    required this.id,
    required this.subject,
    required this.topic,
    required this.questionText,
    required this.imagePath,
    required this.imagePlacement,
    required this.options,
    required this.sortOrder,
    required this.selectedOptionIndex,
    this.openAnswer,
    this.requiresManualReview = false,
  });

  bool get isOpenEnded => options.isEmpty;

  ExamSessionQuestionRecord copyWith({
    int? selectedOptionIndex,
    String? openAnswer,
    bool? requiresManualReview,
  }) {
    return ExamSessionQuestionRecord(
      id: id,
      subject: subject,
      topic: topic,
      questionText: questionText,
      imagePath: imagePath,
      imagePlacement: imagePlacement,
      options: options,
      sortOrder: sortOrder,
      selectedOptionIndex: selectedOptionIndex,
      openAnswer: openAnswer ?? this.openAnswer,
      requiresManualReview: requiresManualReview ?? this.requiresManualReview,
    );
  }
}

class ExamSessionRecord {
  final String id;
  final String title;
  final String subject;
  final String studentName;
  final String studentUsername;
  final String className;
  final String status;
  final int durationSeconds;
  final DateTime startedAtUtc;
  final DateTime? completedAtUtc;
  final List<ExamSessionQuestionRecord> questions;

  const ExamSessionRecord({
    required this.id,
    required this.title,
    required this.subject,
    required this.studentName,
    required this.studentUsername,
    required this.className,
    required this.status,
    required this.durationSeconds,
    required this.startedAtUtc,
    required this.completedAtUtc,
    required this.questions,
  });
}

class ExamSessionCompletionRecord {
  final String sessionId;
  final String title;
  final String subject;
  final String studentName;
  final String className;
  final int score;
  final int net;
  final int correct;
  final int wrong;
  final int blank;
  final int total;

  const ExamSessionCompletionRecord({
    required this.sessionId,
    required this.title,
    required this.subject,
    required this.studentName,
    required this.className,
    required this.score,
    required this.net,
    required this.correct,
    required this.wrong,
    required this.blank,
    required this.total,
  });
}

class ExamSessionApiService {
  ExamSessionApiService._();

  static final ExamSessionApiService instance = ExamSessionApiService._();

  Future<ExamSessionRecord> startSession({
    String? plannedExamId,
    String? examTitle,
    String? subject,
    int questionCount = 10,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const ExamSessionApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/examsessions/start'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({
        'examTitle': examTitle,
        'plannedExamId': plannedExamId,
        'subject': subject,
        'studentName': session.fullName,
        'studentUsername': session.username,
        'questionCount': questionCount,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = _extractMessage(response.body);
      throw ExamSessionApiException(
        message ?? 'Sınav oturumu başlatılamadı (${response.statusCode}).',
      );
    }

    return _mapSession(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<ExamSessionRecord> submitAnswer({
    required String sessionId,
    required String questionId,
    int? selectedOptionIndex,
    String? openAnswer,
  }) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const ExamSessionApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/examsessions/$sessionId/answers'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.accessToken}',
      },
      body: jsonEncode({
        'questionId': questionId,
        'selectedOptionIndex': selectedOptionIndex ?? -1,
        if (openAnswer != null && openAnswer.isNotEmpty) 'openAnswer': openAnswer,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = _extractMessage(response.body);
      throw ExamSessionApiException(
        message ?? 'Cevap kaydedilemedi (${response.statusCode}).',
      );
    }

    return _mapSession(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<ExamSessionCompletionRecord> completeSession(String sessionId) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const ExamSessionApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/examsessions/$sessionId/complete'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = _extractMessage(response.body);
      throw ExamSessionApiException(
        message ?? 'Sınav tamamlanamadı (${response.statusCode}).',
      );
    }

    final map = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
    return ExamSessionCompletionRecord(
      sessionId: map['sessionId'] as String,
      title: map['title'] as String? ?? map['examTitle'] as String? ?? 'Sınav',
      subject: map['subject'] as String? ?? 'Genel',
      studentName: map['studentName'] as String? ?? '',
      className: map['className'] as String? ?? '',
      score: map['score'] as int? ?? 0,
      net: map['net'] as int? ?? 0,
      correct: map['correct'] as int? ?? 0,
      wrong: map['wrong'] as int? ?? 0,
      blank: map['blank'] as int? ?? 0,
      total: map['total'] as int? ?? 0,
    );
  }

  static ExamSessionRecord _mapSession(Map<String, dynamic> map) {
    return ExamSessionRecord(
      id: map['id'] as String,
      title: map['title'] as String? ?? map['examTitle'] as String? ?? 'Sınav',
      subject: map['subject'] as String? ?? 'Genel',
      studentName: map['studentName'] as String? ?? '',
      studentUsername: map['studentUsername'] as String? ?? '',
      className: map['className'] as String? ?? '',
      status: map['status'] as String? ?? 'Active',
      durationSeconds: map['durationSeconds'] as int? ?? 0,
      startedAtUtc:
          DateTime.tryParse(map['startedAtUtc'] as String? ?? '') ??
          DateTime.now(),
      completedAtUtc: DateTime.tryParse(map['completedAtUtc'] as String? ?? ''),
      questions: (map['questions'] as List<dynamic>? ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map(
            (item) => ExamSessionQuestionRecord(
              id: item['id'] as String,
              subject: item['subject'] as String? ?? '',
              topic: item['topic'] as String? ?? '',
              questionText: item['questionText'] as String? ?? '',
              imagePath: item['imagePath'] as String?,
              imagePlacement: item['imagePlacement'] as String?,
              options: (item['options'] as List<dynamic>? ?? const [])
                  .cast<String>(),
              sortOrder: item['sortOrder'] as int? ?? 0,
              selectedOptionIndex: item['selectedOptionIndex'] as int?,
              openAnswer: item['openAnswer'] as String?,
              requiresManualReview:
                  item['requiresManualReview'] as bool? ?? false,
            ),
          )
          .toList(),
    );
  }

  static String? _extractMessage(String rawBody) {
    if (rawBody.isEmpty) return null;
    try {
      final body = jsonDecode(rawBody);
      if (body is Map<String, dynamic>) {
        final direct = body['message'];
        if (direct is String && direct.trim().isNotEmpty) {
          return direct;
        }
      }
    } catch (_) {
      return null;
    }
    return null;
  }
}
