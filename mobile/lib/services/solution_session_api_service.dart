import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_session_store.dart';

class SolutionSessionApiException implements Exception {
  final String message;

  const SolutionSessionApiException(this.message);

  @override
  String toString() => message;
}

class SolutionAnswerRecord {
  final String id;
  final int selectedOptionIndex;
  final String? openAnswer;
  final bool isCorrect;

  const SolutionAnswerRecord({
    required this.id,
    required this.selectedOptionIndex,
    this.openAnswer,
    required this.isCorrect,
  });

  factory SolutionAnswerRecord.fromMap(Map<String, dynamic> map) {
    return SolutionAnswerRecord(
      id: map['id'] as String? ?? '',
      selectedOptionIndex: map['selectedOptionIndex'] as int? ?? -1,
      openAnswer: map['openAnswer'] as String?,
      isCorrect: map['isCorrect'] as bool? ?? false,
    );
  }
}

class SolutionQuestionRecord {
  final String attemptId;
  final String questionBankItemId;
  final int sortOrder;
  final String subject;
  final String topic;
  final String difficulty;
  final String type;
  final String questionText;
  final String? imagePath;
  final List<String> options;
  final String status;
  final bool isFlagged;
  final String flagType;
  final int timeSpentSeconds;
  final SolutionAnswerRecord? answer;
  final String? note;
  final String? snapshotUrl;

  const SolutionQuestionRecord({
    required this.attemptId,
    required this.questionBankItemId,
    required this.sortOrder,
    required this.subject,
    required this.topic,
    required this.difficulty,
    required this.type,
    required this.questionText,
    this.imagePath,
    required this.options,
    required this.status,
    required this.isFlagged,
    required this.flagType,
    required this.timeSpentSeconds,
    this.answer,
    this.note,
    this.snapshotUrl,
  });

  factory SolutionQuestionRecord.fromMap(Map<String, dynamic> map) {
    return SolutionQuestionRecord(
      attemptId: map['attemptId'] as String? ?? '',
      questionBankItemId: map['questionBankItemId'] as String? ?? '',
      sortOrder: map['sortOrder'] as int? ?? 0,
      subject: map['subject'] as String? ?? '',
      topic: map['topic'] as String? ?? '',
      difficulty: map['difficulty'] as String? ?? 'Orta',
      type: map['type'] as String? ?? 'Çoktan Seçmeli',
      questionText: map['questionText'] as String? ?? '',
      imagePath: map['imagePath'] as String?,
      options: (map['options'] as List<dynamic>? ?? const []).cast<String>(),
      status: map['status'] as String? ?? 'Unanswered',
      isFlagged: map['isFlagged'] as bool? ?? false,
      flagType: map['flagType'] as String? ?? '',
      timeSpentSeconds: map['timeSpentSeconds'] as int? ?? 0,
      answer: map['answer'] is Map
          ? SolutionAnswerRecord.fromMap(
              Map<String, dynamic>.from(map['answer'] as Map),
            )
          : null,
      note: map['note'] as String?,
      snapshotUrl: map['snapshotUrl'] as String?,
    );
  }
}

class PdfReportRecord {
  final String id;
  final String status;
  final String? downloadUrl;

  const PdfReportRecord({
    required this.id,
    required this.status,
    this.downloadUrl,
  });

  factory PdfReportRecord.fromMap(Map<String, dynamic> map) {
    return PdfReportRecord(
      id: map['id'] as String? ?? '',
      status: map['status'] as String? ?? '',
      downloadUrl: map['downloadUrl'] as String?,
    );
  }
}

class SolutionSessionRecord {
  final String id;
  final String title;
  final String subject;
  final String studentName;
  final String studentUsername;
  final String className;
  final int durationSeconds;
  final bool isTeacherPreview;
  final String status;
  final List<SolutionQuestionRecord> questions;
  final PdfReportRecord? latestReport;

  const SolutionSessionRecord({
    required this.id,
    required this.title,
    required this.subject,
    required this.studentName,
    required this.studentUsername,
    required this.className,
    required this.durationSeconds,
    required this.isTeacherPreview,
    required this.status,
    required this.questions,
    this.latestReport,
  });

  factory SolutionSessionRecord.fromMap(Map<String, dynamic> map) {
    return SolutionSessionRecord(
      id: map['id'] as String? ?? '',
      title: map['title'] as String? ?? 'Sınav',
      subject: map['subject'] as String? ?? 'Genel',
      studentName: map['studentName'] as String? ?? '',
      studentUsername: map['studentUsername'] as String? ?? '',
      className: map['className'] as String? ?? '',
      durationSeconds: map['durationSeconds'] as int? ?? 3600,
      isTeacherPreview: map['isTeacherPreview'] as bool? ?? false,
      status: map['status'] as String? ?? 'Active',
      questions: (map['questions'] as List<dynamic>? ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .map(SolutionQuestionRecord.fromMap)
          .toList(),
      latestReport: map['latestReport'] is Map
          ? PdfReportRecord.fromMap(
              Map<String, dynamic>.from(map['latestReport'] as Map),
            )
          : null,
    );
  }
}

class SolutionSummaryRecord {
  final String sessionId;
  final int total;
  final int correct;
  final int wrong;
  final int empty;
  final num net;
  final int successPercent;
  final PdfReportRecord? report;

  const SolutionSummaryRecord({
    required this.sessionId,
    required this.total,
    required this.correct,
    required this.wrong,
    required this.empty,
    required this.net,
    required this.successPercent,
    this.report,
  });

  factory SolutionSummaryRecord.fromMap(Map<String, dynamic> map) {
    return SolutionSummaryRecord(
      sessionId: map['sessionId'] as String? ?? '',
      total: map['total'] as int? ?? 0,
      correct: map['correct'] as int? ?? 0,
      wrong: map['wrong'] as int? ?? 0,
      empty: map['empty'] as int? ?? 0,
      net: map['net'] as num? ?? 0,
      successPercent: map['successPercent'] as int? ?? 0,
      report: map['report'] is Map
          ? PdfReportRecord.fromMap(
              Map<String, dynamic>.from(map['report'] as Map),
            )
          : null,
    );
  }
}

class SolutionSessionApiService {
  SolutionSessionApiService._();

  static final SolutionSessionApiService instance =
      SolutionSessionApiService._();

  Future<Map<String, String>> _headers({bool json = true}) async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const SolutionSessionApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }
    return {
      if (json) 'Content-Type': 'application/json',
      'Authorization': 'Bearer ${session.accessToken}',
    };
  }

  Future<SolutionSessionRecord> startSession({
    String? plannedExamId,
    String? title,
    String? subject,
    String? className,
    List<String>? questionIds,
    int questionCount = 10,
    int durationSeconds = 5400,
    bool isTeacherPreview = false,
  }) async {
    final auth = await AuthSessionStore.instance.load();
    if (auth == null) {
      throw const SolutionSessionApiException(
        'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/solution-sessions/start'),
      headers: await _headers(),
      body: jsonEncode({
        'title': title ?? 'Deneme Sınavı',
        'subject': subject ?? 'Genel',
        'studentUsername': auth.username,
        'studentName': auth.fullName,
        'className': className ?? '',
        'durationSeconds': durationSeconds,
        'isTeacherPreview': isTeacherPreview,
        'plannedExamId': plannedExamId,
        'questionIds': questionIds,
        'questionCount': questionCount,
      }),
    );
    return _decodeSession(response, 'Çözüm oturumu başlatılamadı');
  }

  Future<SolutionSessionRecord> saveAnswer({
    required String sessionId,
    required String questionAttemptId,
    required int selectedOptionIndex,
    String? openAnswer,
    int timeSpentSeconds = 0,
  }) async {
    final response = await http.post(
      Uri.parse(
        '${ApiConfig.baseUrl}/api/solution-sessions/$sessionId/answers',
      ),
      headers: await _headers(),
      body: jsonEncode({
        'questionAttemptId': questionAttemptId,
        'selectedOptionIndex': selectedOptionIndex,
        'openAnswer': openAnswer,
        'timeSpentSeconds': timeSpentSeconds,
      }),
    );
    return _decodeSession(response, 'Cevap kaydedilemedi');
  }

  Future<SolutionSessionRecord> saveFlag({
    required String sessionId,
    required String questionAttemptId,
    required bool isFlagged,
    String flagType = 'Marked',
  }) async {
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/solution-sessions/$sessionId/flags'),
      headers: await _headers(),
      body: jsonEncode({
        'questionAttemptId': questionAttemptId,
        'isFlagged': isFlagged,
        'flagType': flagType,
      }),
    );
    return _decodeSession(response, 'Soru işareti kaydedilemedi');
  }

  Future<SolutionSessionRecord> saveNote({
    required String sessionId,
    required String questionAttemptId,
    required String note,
  }) async {
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/solution-sessions/$sessionId/notes'),
      headers: await _headers(),
      body: jsonEncode({'questionAttemptId': questionAttemptId, 'note': note}),
    );
    return _decodeSession(response, 'Not kaydedilemedi');
  }

  Future<SolutionSessionRecord> getSession(String sessionId) async {
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/solution-sessions/$sessionId'),
      headers: await _headers(),
    );
    return _decodeSession(response, 'Çözüm oturumu alınamadı');
  }

  Future<void> saveStroke({
    required String sessionId,
    required String questionAttemptId,
    required Map<String, dynamic> stroke,
  }) async {
    final response = await http.post(
      Uri.parse(
        '${ApiConfig.baseUrl}/api/solution-sessions/$sessionId/canvas/strokes',
      ),
      headers: await _headers(),
      body: jsonEncode({
        'questionAttemptId': questionAttemptId,
        'tool': stroke['tool'] as String? ?? 'pen',
        'color': stroke['color'] as String? ?? '#fb923c',
        'width': stroke['width'] as num? ?? 3,
        'opacity': stroke['opacity'] as num? ?? 1,
        'pressure': stroke['pressure'] as num?,
        'pointsJson': jsonEncode(stroke['points'] ?? const []),
      }),
    );
    _ensureSuccess(response, 'Çizim kaydedilemedi');
  }

  Future<void> saveSnapshot({
    required String sessionId,
    required String questionAttemptId,
    required String dataUrl,
  }) async {
    final response = await http.post(
      Uri.parse(
        '${ApiConfig.baseUrl}/api/solution-sessions/$sessionId/canvas/snapshot',
      ),
      headers: await _headers(),
      body: jsonEncode({
        'questionAttemptId': questionAttemptId,
        'dataUrl': dataUrl,
      }),
    );
    _ensureSuccess(response, 'Çizim görüntüsü kaydedilemedi');
  }

  Future<SolutionSummaryRecord> complete(String sessionId) async {
    final response = await http.post(
      Uri.parse(
        '${ApiConfig.baseUrl}/api/solution-sessions/$sessionId/complete',
      ),
      headers: await _headers(json: false),
    );
    _ensureSuccess(response, 'Sınav tamamlanamadı');
    return SolutionSummaryRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<PdfReportRecord> queuePdf(String sessionId) async {
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/solution-sessions/$sessionId/pdf'),
      headers: await _headers(json: false),
    );
    _ensureSuccess(response, 'PDF oluşturulamadı');
    return PdfReportRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  SolutionSessionRecord _decodeSession(
    http.Response response,
    String fallback,
  ) {
    _ensureSuccess(response, fallback);
    return SolutionSessionRecord.fromMap(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  void _ensureSuccess(http.Response response, String fallback) {
    if (response.statusCode >= 200 && response.statusCode < 300) return;
    throw SolutionSessionApiException(
      _extractMessage(response.body) ?? '$fallback (${response.statusCode}).',
    );
  }

  String? _extractMessage(String body) {
    if (body.isEmpty) return null;
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        final message = decoded['message'];
        if (message is String && message.trim().isNotEmpty) return message;
      }
    } catch (_) {
      return null;
    }
    return null;
  }
}
