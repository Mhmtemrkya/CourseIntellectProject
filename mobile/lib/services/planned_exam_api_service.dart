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
          if (className != null && className.trim().isNotEmpty) 'className': className.trim(),
          if (teacherName != null && teacherName.trim().isNotEmpty) 'teacherName': teacherName.trim(),
          if (studentName != null && studentName.trim().isNotEmpty) 'studentName': studentName.trim(),
          if (studentUsername != null && studentUsername.trim().isNotEmpty) 'studentUsername': studentUsername.trim(),
        },
      ),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PlannedExamApiException('Planlı sınavlar alınamadı (${response.statusCode}).');
    }

    return (jsonDecode(response.body) as List<dynamic>)
        .map((item) => PlannedExamRecord.fromMap(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<PlannedExamRecord> createPlannedExam(Map<String, dynamic> payload) async {
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
      throw PlannedExamApiException('Planlı sınav oluşturulamadı (${response.statusCode}).');
    }

    return PlannedExamRecord.fromMap(Map<String, dynamic>.from(jsonDecode(response.body) as Map));
  }

  Future<void> deletePlannedExam(String id) async {
    final session = await _session();
    final response = await http.delete(
      Uri.parse('${ApiConfig.baseUrl}/api/plannedexams/$id'),
      headers: {'Authorization': 'Bearer ${session.accessToken}'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw PlannedExamApiException('Planlı sınav silinemedi (${response.statusCode}).');
    }
  }

  Future<AuthSession> _session() async {
    final session = await AuthSessionStore.instance.load();
    if (session == null) {
      throw const PlannedExamApiException('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
    }
    return session;
  }
}
